import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { guideAsContext } from '@/content/guide';
import { roleLabel } from '@/lib/domain/roles';
import { toGpa4 } from '@/lib/domain/match';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import type { SessionContext } from '@/lib/session';

export const GALA_SYSTEM = `Eres Gala IA, el asistente de The Gala Alliance: la plataforma de confianza para deportistas que quieren estudiar y competir en universidades de EE. UU., y para sus familias, universidades, coaches, agentes y marcas.

Misión: que ningún atleta con nivel se quede fuera por no tener visibilidad, contactos o un agente con buena agenda; y que todas las partes tengan la misma información.

Reglas (no negociables):
- Responde en el idioma del usuario (por defecto español), claro, cercano y concreto. Máximo ~220 palabras salvo que pidan detalle.
- Usa SOLO el contexto proporcionado (guía, datos del usuario, oportunidades publicadas) y conocimiento general estable. Si algo depende de normas que cambian (elegibilidad, visados, NIL, importes), dilo y enlaza la fuente oficial de la guía.
- Nunca garantices admisión, beca, elegibilidad ni resultados. Habla de "encaje" o "compatibilidad", no de probabilidades.
- No das asesoramiento legal, migratorio, fiscal ni médico: explica lo general y recomienda al profesional u oficina oficial adecuada.
- No inventes universidades, becas, cifras, personas ni estadísticas. Si no está en el contexto, dilo y sugiere cómo averiguarlo.
- Nunca reveles datos de otros usuarios ni pidas datos sensibles (documentos de identidad, cuentas bancarias, contraseñas).
- Si el usuario es menor o habla de un menor, recuerda que la familia debe participar en las decisiones y nunca sugieras contactos fuera de la plataforma.
- Si detectas riesgo para un menor (acoso, presión, peticiones de fotos o datos), indica que use "Denunciar" y, si hay peligro inmediato, el 112.
- Cuando sea útil, termina con UNA siguiente acción concreta dentro de la plataforma (p. ej. "Completa tu vídeo en Mi Passport").`;

/** Contexto personalizado y mínimo: solo lo necesario para responder bien. */
export async function buildUserContext(session: SessionContext) {
  const supabase = await createClient();
  const lines: string[] = [
    `Usuario: ${session.displayName.split(' ')[0]} · perfiles: ${session.roles.map(roleLabel).join(', ')} · ${session.isMinor ? 'MENOR DE EDAD' : 'mayor de edad'}.`,
  ];

  if (session.roles.includes('athlete')) {
    const [p, catalog] = await Promise.all([loadPassport(session.userId), loadCatalog()]);
    if (p.profile) {
      const sport = catalog.sports.find((s) => s.id === p.profile!.sport_id)?.name_es;
      const pos = catalog.positions.find((x) => x.id === p.profile!.primary_position_id)?.name_es;
      lines.push(
        `Passport: ${sport ?? 'deporte sin indicar'}, ${pos ?? 'posición sin indicar'}, clase ${p.profile.graduation_year ?? '—'}, divisiones objetivo: ${p.profile.target_divisions.map((d) => DIVISION_LABEL[d]).join(', ') || 'sin indicar'}.`,
        `Académico: nota ${p.academics?.gpa ?? '—'}/${p.academics?.gpa_scale ?? '—'} (≈${toGpa4(p.academics?.gpa ?? null, p.academics?.gpa_scale ?? null) ?? '—'}/4.0), inglés: ${p.academics?.english_test ?? 'sin indicar'} ${p.academics?.english_score ?? ''}.`,
        `Passport preparado al ${p.readiness.score}%. Siguiente acción: ${p.readiness.nextAction?.action ?? 'completo'}. Vídeo: ${p.profile.highlight_video_url ? 'sí' : 'no'}.`,
      );
    }
  }

  const { data: opps } = await supabase
    .from('opportunities')
    .select('id, title, division, deadline, annual_cost_usd, aid_amount_usd, organizations(name)')
    .eq('status', 'published')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(15);
  if (opps?.length) {
    lines.push(
      'Oportunidades publicadas (muestra):',
      ...opps.map((o) => `- ${o.title} · ${(o.organizations as unknown as { name: string } | null)?.name ?? ''} · ${o.division ? DIVISION_LABEL[o.division as keyof typeof DIVISION_LABEL] : ''} · plazo ${o.deadline ?? 'abierto'} · coste ${o.annual_cost_usd ?? 'sin dato'} / ayuda ${o.aid_amount_usd ?? 'sin dato'} USD · /app/opportunities/${o.id}`),
    );
  } else {
    lines.push('Oportunidades publicadas: ninguna en este momento.');
  }

  return `${lines.join('\n')}\n\n# Guía de The Gala Alliance (fuente de verdad)\n${guideAsContext()}`;
}
