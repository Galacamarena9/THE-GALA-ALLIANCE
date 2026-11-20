'use server';

import { logEvent } from '@/lib/events';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { roleHome } from '@/lib/domain/roles';
import { SPAIN_DIGITAL_CONSENT_AGE } from '@/lib/domain/age';
import type { FormState } from './auth';

const LEGAL_VERSION = '2026-11-borrador';

const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Código de país de 2 letras (ES, US…)');
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const athleteSchema = z.object({
  role: z.literal('athlete'),
  country,
  city: optionalText(120),
  sport_id: z.string().min(1, 'Elige tu deporte'),
  primary_position_id: z.coerce.number().int().positive('Elige tu posición'),
  graduation_year: z.coerce.number().int().min(2024).max(2040),
  current_team: optionalText(160),
});

const orgSchema = z.object({
  role: z.enum(['university', 'coach', 'agent', 'brand']),
  country,
  // Un coach puede unirse después al equipo de su universidad mediante invitación.
  org_mode: z.enum(['create', 'join_later']).default('create'),
  org_name: z.string().trim().max(160).optional().default(''),
  org_type: z.enum(['university', 'college', 'club', 'academy', 'agency', 'brand']),
  org_website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? (v.startsWith('http') ? v.replace(/^http:/, 'https:') : `https://${v}`) : null)),
  division: z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', '']).optional().transform((v) => v || null),
});

const parentSchema = z.object({ role: z.literal('parent'), country });

const ORG_TYPES_BY_ROLE = {
  university: ['university', 'college'],
  coach: ['club', 'academy'],
  agent: ['agency'],
  brand: ['brand'],
} as const;

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const addingRole = session.onboardingCompleted;
  if (session.age == null) return { error: 'Falta tu fecha de nacimiento. Contacta con soporte.' };

  const raw = Object.fromEntries(formData);
  const schema = z.discriminatedUnion('role', [athleteSchema, orgSchema, parentSchema]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors, error: 'Revisa los campos marcados.' };
  }
  const data = parsed.data;

  if (data.role !== 'athlete' && session.isMinor) {
    return { error: 'Este tipo de cuenta es solo para mayores de edad.' };
  }

  const supabase = await createClient();

  // 1. Rol (idempotente: reintentar no duplica).
  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: session.userId, role: data.role }, { onConflict: 'user_id,role', ignoreDuplicates: true });
  if (roleError) return { error: 'No hemos podido guardar tu rol. Inténtalo de nuevo.' };

  // 2. Datos específicos del actor.
  if (data.role === 'athlete') {
    const needsGuardian = session.age < SPAIN_DIGITAL_CONSENT_AGE;
    const { error } = await supabase.from('athlete_profiles').upsert(
      {
        user_id: session.userId,
        sport_id: data.sport_id,
        primary_position_id: data.primary_position_id,
        graduation_year: data.graduation_year,
        city: data.city,
        current_team: data.current_team,
        // Menores de 14: perfil privado hasta que la familia se vincule (art. 7 LOPDGDD).
        profile_visibility: needsGuardian ? 'private' : 'members',
        stats_visibility: needsGuardian ? 'private' : 'members',
        academics_visibility: 'connections',
      },
      { onConflict: 'user_id' },
    );
    if (error) return { error: 'No hemos podido crear tu Passport. Revisa deporte y posición.' };
  }

  if (data.role === 'university' || data.role === 'coach' || data.role === 'agent' || data.role === 'brand') {
    const createOrg = data.role !== 'coach' || data.org_mode === 'create';
    if (createOrg && data.org_name.length < 2) return { fieldErrors: { org_name: 'Nombre de la organización' } };
    if (createOrg && !(ORG_TYPES_BY_ROLE[data.role] as readonly string[]).includes(data.org_type)) {
      return { fieldErrors: { org_type: 'Tipo de organización no válido para tu perfil' } };
    }
    const { data: existing } = await supabase
      .from('organization_members')
      .select('organization_id, organizations!inner(type)')
      .eq('user_id', session.userId)
      .in('organizations.type', ORG_TYPES_BY_ROLE[data.role] as unknown as string[])
      .limit(1);
    if (createOrg && !existing?.length) {
      const { error } = await supabase.from('organizations').insert({
        name: data.org_name,
        type: data.org_type,
        country: data.country,
        website: data.org_website,
        division: data.role === 'university' ? data.division : null,
        created_by: session.userId,
        verification_status: 'submitted',
        // Señal para la verificación: ¿el email coincide con el dominio oficial?
        requester_email_domain: session.email?.split('@')[1]?.toLowerCase() ?? null,
      });
      if (error?.message.includes('organization_exists')) {
        return { fieldErrors: { org_name: 'Esta organización ya existe en Gala.' }, error: `«${data.org_name}» ya está en Gala: no crees otra. Termina el registro eligiendo «Unirme a una existente» y verifica tu afiliación desde Verificación.` };
      }
      if (error) return { error: 'No hemos podido crear tu organización. Revisa los datos.' };
    }
  }

  // 3. Consentimientos con versión (prueba de aceptación), solo la primera vez.
  if (!addingRole) await supabase.from('consents').insert([
    { user_id: session.userId, purpose: 'terms', document_version: LEGAL_VERSION, granted: true },
    { user_id: session.userId, purpose: 'privacy_notice', document_version: LEGAL_VERSION, granted: true },
  ]);

  // 4. Perfil completado.
  const { error: profileError } = await supabase
    .from('profiles')
    .update(addingRole ? { onboarding_completed: true } : { primary_role: data.role, country: data.country, onboarding_completed: true })
    .eq('id', session.userId);
  if (profileError) return { error: 'No hemos podido completar el registro. Inténtalo de nuevo.' };

  const pendingInvite = typeof raw.invite === 'string' && /^[a-f0-9]{64}$/.test(raw.invite) ? raw.invite : null;
  const teamInvite = typeof raw.team === 'string' && /^[a-f0-9]{64}$/.test(raw.team) ? raw.team : null;
  await logEvent('onboarding_completed', { role: data.role });
  // 20 · Atribución de la invitación (si llegó con ?ref=): una vez, nunca a uno mismo; lo valida la base de datos.
  const ref = (await cookies()).get('tga_ref')?.value;
  if (!addingRole && ref && /^[a-z0-9]{8}$/.test(ref)) {
    try { await supabase.rpc('referral_claim', { p_code: ref }); } catch { /* nunca bloquea el alta */ }
  }
  redirect(pendingInvite ? `/invite/${pendingInvite}` : teamInvite ? `/join/${teamInvite}` : roleHome(data.role));
}
