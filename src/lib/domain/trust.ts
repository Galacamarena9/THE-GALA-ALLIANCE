/**
 * Confianza de una oportunidad y señales de alarma (dossier: "Trust Score de la oportunidad").
 * No puntúa a personas: describe qué se ha comprobado de la oferta y de quién la publica.
 */
export type TrustLevel = 1 | 2 | 3 | 4 | 5;

export const TRUST_LABEL: Record<TrustLevel, string> = {
  1: 'Publicada',
  2: 'Organización verificada',
  3: 'Oportunidad revisada',
  4: 'Cifras documentadas',
  5: 'Altamente verificada',
};

export interface TrustInput {
  status: string;
  orgVerified: boolean;
  reviewed: boolean;
  financialSource: string | null;
  updatedAt: string;
  institutionLinksVerified: boolean;
}

/** Cada nivel exige el anterior. "Altamente verificada" caduca si no se actualiza en 90 días. */
export function trustLevel(o: TrustInput, now: number = Date.now()): { level: TrustLevel; checks: { label: string; ok: boolean }[] } {
  const fresh = now - new Date(o.updatedAt).getTime() <= 90 * 86_400_000;
  const checks = [
    { label: 'Publicada por una cuenta autorizada', ok: o.status === 'published' },
    { label: 'Organización y representante verificados', ok: o.orgVerified },
    { label: 'Requisitos, plazo y condiciones revisados', ok: o.reviewed },
    { label: 'Importes respaldados por documentación o fuente institucional', ok: o.financialSource === 'platform_verified' },
    { label: 'Enlaces oficiales comprobados y datos actualizados en los últimos 90 días', ok: o.institutionLinksVerified && fresh },
  ];
  let level = 0;
  for (const c of checks) {
    if (!c.ok) break;
    level++;
  }
  return { level: Math.max(1, level) as TrustLevel, checks };
}

export interface RedFlagInput {
  description: string;
  deadline: string | null;
  aidUsd: number | null;
  costUsd: number | null;
  financialSource: string | null;
  orgVerified: boolean;
  orgType?: string | null;
  orgWebsite?: string | null;
}

export interface RedFlag {
  code: string;
  severity: 'high' | 'medium';
  text: string;
}

const PAYMENT = /(pago por adelantado|pago anticipado|adelanto|dep[oó]sito|transferencia|western union|bizum|bitcoin|cripto|upfront|deposit|wire transfer|processing fee|tasa de reserva)/i;
const GUARANTEE = /(beca garantizada|guaranteed scholarship|plaza garantizada|100 ?% seguro)/i;
const URGENCY = /(solo hoy|últimas plazas|ultimas plazas|decide ya|responde en 24|act now|last chance)/i;

/** Detector de señales de alarma para familias (no es un juicio sobre la organización). */
export function redFlags(o: RedFlagInput, now: number = Date.now()): RedFlag[] {
  const flags: RedFlag[] = [];
  if (!o.orgVerified) flags.push({ code: 'org_unverified', severity: 'high', text: 'La organización no está verificada en la plataforma.' });
  if (PAYMENT.test(o.description)) flags.push({ code: 'payment', severity: 'high', text: 'Menciona pagos o depósitos previos. Una universidad no cobra por ofrecerte una beca.' });
  if (GUARANTEE.test(o.description)) flags.push({ code: 'guarantee', severity: 'high', text: 'Promete una beca o plaza "garantizada": nadie puede garantizarla antes de la admisión.' });
  if (URGENCY.test(o.description)) flags.push({ code: 'urgency', severity: 'medium', text: 'Usa mensajes de prisa. Tómate el tiempo de comparar.' });
  if (o.deadline && new Date(`${o.deadline}T23:59:59`).getTime() - now < 3 * 86_400_000) {
    flags.push({ code: 'deadline', severity: 'medium', text: 'El plazo cierra en menos de 3 días.' });
  }
  if (o.aidUsd != null && !o.financialSource) flags.push({ code: 'aid_source', severity: 'medium', text: 'La ayuda no indica de dónde sale la cifra.' });
  if (o.aidUsd != null && o.costUsd != null && o.aidUsd >= o.costUsd && o.financialSource !== 'platform_verified') {
    flags.push({ code: 'full_aid', severity: 'medium', text: 'Promete cubrir el 100 % del coste sin documentación verificada: pídela por escrito.' });
  }
  if (o.orgType && ['university', 'college'].includes(o.orgType) && o.orgWebsite) {
    try {
      const host = new URL(o.orgWebsite).hostname;
      if (!host.endsWith('.edu')) flags.push({ code: 'domain', severity: 'medium', text: `La web de la universidad (${host}) no es un dominio .edu: compruébala.` });
    } catch {
      flags.push({ code: 'domain', severity: 'medium', text: 'La web de la organización no es válida.' });
    }
  }
  return flags;
}

export interface MemoOption {
  title: string;
  orgName: string;
  netCostUsd: number | null;
  matchScore: number | null;
  deadline: string | null;
  flags: RedFlag[];
  missing: string[];
}

/** Memo de decisión: qué opción es más sólida con los datos actuales, riesgos y preguntas pendientes. */
export function decisionMemo(options: MemoOption[]) {
  const scored = options.map((o) => {
    const high = o.flags.filter((f) => f.severity === 'high').length;
    const medium = o.flags.length - high;
    const cost = o.netCostUsd;
    return { ...o, high, medium, sortKey: [high, medium, cost ?? Number.MAX_SAFE_INTEGER, -(o.matchScore ?? 0)] as const };
  });
  scored.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) if (a.sortKey[i] !== b.sortKey[i]) return (a.sortKey[i] as number) - (b.sortKey[i] as number);
    return 0;
  });
  const best = scored[0] ?? null;
  const questions = new Set<string>();
  for (const o of options) {
    if (o.netCostUsd == null) questions.add(`${o.orgName}: pide por escrito el coste total anual y la ayuda (matrícula, alojamiento, comida, seguro y viajes).`);
    for (const m of o.missing) questions.add(`${o.orgName}: ${m}`);
    if (o.flags.some((f) => f.code === 'full_aid' || f.code === 'aid_source')) questions.add(`${o.orgName}: ¿la ayuda se renueva cada año y con qué condiciones?`);
  }
  const nextDeadline = options.map((o) => o.deadline).filter(Boolean).sort()[0] ?? null;
  return {
    recommended: best && best.high === 0 ? best.title : null,
    ranking: scored.map((s) => ({ title: s.title, orgName: s.orgName, highRisks: s.high, mediumRisks: s.medium, netCostUsd: s.netCostUsd })),
    questions: [...questions],
    decideBy: nextDeadline,
  };
}

/** Adaptador desde la fila de la BD. Publicada = ha superado la revisión automática o la del equipo. */
export interface OpportunityTrustRow {
  status: string;
  description?: string | null;
  deadline: string | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  financial_source?: string | null;
  reviewed_by?: string | null;
  /** Versión pública de `reviewed_by`: dice si se revisó, no quién (los anónimos no pueden leer `reviewed_by`). */
  is_reviewed?: boolean | null;
  updated_at?: string | null;
  organizations?: { verification_status: string; website?: string | null; type?: string | null } | null;
}

export function assessOpportunity(o: OpportunityTrustRow, now: number = Date.now()) {
  const org = o.organizations;
  const orgVerified = org?.verification_status === 'verified';
  const flags = redFlags({
    description: o.description ?? '',
    deadline: o.deadline,
    aidUsd: o.aid_amount_usd,
    costUsd: o.annual_cost_usd,
    financialSource: o.financial_source ?? null,
    orgVerified,
    orgType: org?.type ?? null,
    orgWebsite: org?.website ?? null,
  }, now);
  let linksOk = false;
  if (org?.website) {
    try {
      const host = new URL(org.website).hostname;
      linksOk = org.type === 'university' ? host.endsWith('.edu') : true;
    } catch {
      linksOk = false;
    }
  }
  const trust = trustLevel({
    status: o.status,
    orgVerified,
    reviewed: Boolean(o.reviewed_by ?? o.is_reviewed) || (o.status === 'published' && !flags.some((f) => f.severity === 'high')),
    financialSource: o.financial_source ?? null,
    updatedAt: o.updated_at ?? new Date(now).toISOString(),
    institutionLinksVerified: linksOk,
  }, now);
  return { ...trust, flags };
}
