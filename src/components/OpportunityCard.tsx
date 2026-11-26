import Link from 'next/link';
import { Badge } from '@/components/ui';
import { DIVISION_LABEL, OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_TYPE_LABEL, daysUntil, usd } from '@/lib/domain/labels';
import { OVER_BUDGET_LABEL, TIER_LABEL, type MatchResult } from '@/lib/domain/match';
import type { Division, OpportunityStatus, OpportunityType } from '@/lib/types';
import { assessOpportunity, TRUST_LABEL } from '@/lib/domain/trust';

export interface OpportunityCardData {
  id: string;
  title: string;
  type: OpportunityType;
  division: Division | null;
  location: string | null;
  deadline: string | null;
  annual_cost_usd: number | null;
  aid_amount_usd: number | null;
  status: OpportunityStatus;
  description?: string | null;
  financial_source?: string | null;
  reviewed_by?: string | null;
  is_reviewed?: boolean | null;
  updated_at?: string | null;
  organizations: { name: string; verification_status: string; website?: string | null; type?: string | null } | null;
}

/** `href` permite enlazar a otro destino (p. ej. el marketplace público lleva a crear el Passport). */
export function OpportunityCard({ o, match, showStatus, href }: { o: OpportunityCardData; match?: MatchResult; showStatus?: boolean; href?: string }) {
  const net = o.annual_cost_usd != null && o.aid_amount_usd != null ? o.annual_cost_usd - o.aid_amount_usd : null;
  const daysLeft = o.deadline ? daysUntil(o.deadline) : null;
  // El sello solo se muestra cuando la consulta trae los campos necesarios para calcularlo.
  const assessed = o.updated_at !== undefined ? assessOpportunity(o) : null;
  return (
    <Link href={href ?? `/app/opportunities/${o.id}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">
            {o.organizations?.name}
            {o.organizations?.verification_status === 'verified' && <span className="ml-1.5 text-brass" title="Organización verificada">✓ verificada</span>}
          </p>
          <h3 className="mt-1 text-lg leading-snug text-paper">{o.title}</h3>
        </div>
        {match && (
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl tabular-nums text-paper">{match.score}</p>
            <p className="text-xs font-medium text-faint">compat.</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{OPPORTUNITY_TYPE_LABEL[o.type]}</Badge>
        {o.division && <Badge>{DIVISION_LABEL[o.division]}</Badge>}
        {match && <Badge tone={match.tier === 'strong' ? 'ok' : match.tier === 'not_eligible' ? 'danger' : 'brass'}>{TIER_LABEL[match.tier]}</Badge>}
        {match?.overBudget && <Badge tone="danger">{OVER_BUDGET_LABEL}</Badge>}
        {match?.confidence === 'low' && <Badge tone="warn">Faltan datos</Badge>}
        {assessed && <Badge tone={assessed.level >= 4 ? 'ok' : 'brass'}>Confianza {assessed.level}/5 · {TRUST_LABEL[assessed.level]}</Badge>}
        {assessed && assessed.flags.some((f) => f.severity === 'high') && <Badge tone="danger">Señal de alarma</Badge>}
        {showStatus && <Badge tone={o.status === 'published' ? 'ok' : o.status === 'rejected' ? 'danger' : 'warn'}>{OPPORTUNITY_STATUS_LABEL[o.status]}</Badge>}
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-2 pt-4 text-xs">
        <div><dt className="text-faint">Coste/año</dt><dd className="tabular-nums text-paper">{usd(o.annual_cost_usd)}</dd></div>
        <div><dt className="text-faint">Neto familia</dt><dd className="tabular-nums text-paper">{net == null ? 'Incompleto' : usd(net)}</dd></div>
        <div><dt className="text-faint">Plazo</dt><dd className={daysLeft != null && daysLeft <= 14 ? 'text-warn' : 'text-paper'}>{o.deadline ? (daysLeft! < 0 ? 'Cerrada' : `${daysLeft} días`) : 'Abierto'}</dd></div>
      </dl>
    </Link>
  );
}
