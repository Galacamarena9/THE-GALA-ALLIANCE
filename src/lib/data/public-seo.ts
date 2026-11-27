import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseEnv } from '@/lib/env';

/**
 * Prompt 20 · Datos públicos para SEO, con el cliente anónimo (sin cookies): solo lo que la RLS permite ver a
 * cualquiera — oportunidades publicadas de organizaciones verificadas. Nunca atletas.
 */
function anon() {
  const { url, publishableKey } = supabaseEnv();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface PublicOppRow { id: string; title: string; type: string; sport_id: string | null; deadline: string | null; location: string | null; updated_at: string | null; organization_id: string }
const OPP_COLS = 'id, title, type, sport_id, deadline, location, updated_at, organization_id, organizations!inner(verification_status)';

export const publishedOpportunities = cache(async (limit = 2000): Promise<PublicOppRow[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await anon().from('opportunities').select(OPP_COLS).eq('status', 'published').eq('organizations.verification_status', 'verified')
      .order('updated_at', { ascending: false }).limit(limit);
    return ((data ?? []) as unknown as PublicOppRow[]);
  } catch { return []; }
});

export interface PublicOrg {
  id: string; name: string; type: string; website: string | null; country: string | null; city: string | null; division: string | null;
  state: string | null; conference: string | null; description: string | null; international_support: string | null; sport_ids: string[] | null;
  logo_url: string | null; verified_at: string | null; sports: string[];
}

export const publicOrganization = cache(async (id: string, locale: 'es' | 'en' = 'es'): Promise<{ org: PublicOrg; opportunities: PublicOppRow[] } | null> => {
  if (!/^[0-9a-f-]{36}$/.test(id) || !isSupabaseConfigured()) return null;
  try {
    const db = anon();
    // Solo columnas abiertas a anónimos (fase 8). «Activa» lo responde organization_is_public: org_status no es legible
    // por anon y pedirlo hacía fallar la consulta (la página daba 404 siempre).
    const [{ data: org }, { data: isPublic }] = await Promise.all([
      db.from('organizations').select('id, name, type, website, country, city, state, division, conference, description, international_support, sport_ids, logo_url, verified_at')
        .eq('id', id).eq('verification_status', 'verified').maybeSingle(),
      db.rpc('organization_is_public', { p_org: id }),
    ]);
    if (!org || isPublic !== true) return null;
    const ids = ((org.sport_ids as string[] | null) ?? []).slice(0, 30);
    const [{ data: opps }, { data: sports }] = await Promise.all([
      db.from('opportunities').select(OPP_COLS).eq('organization_id', id).eq('status', 'published').order('deadline', { ascending: true }).limit(100),
      ids.length ? db.from('sports').select('id, name_es, name_en').in('id', ids) : Promise.resolve({ data: [] as { id: string; name_es: string; name_en: string | null }[] }),
    ]);
    const sportNames = (sports ?? []).map((s) => (locale === 'en' ? s.name_en ?? s.name_es : s.name_es));
    return { org: { ...(org as unknown as Omit<PublicOrg, 'sports'>), sports: sportNames }, opportunities: (opps ?? []) as unknown as PublicOppRow[] };
  } catch { return null; }
});
