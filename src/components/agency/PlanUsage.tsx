import { Notice } from '@/components/ui';
import { planSummary, usageLabel, usageRatio, type AgencyPlanStatus } from '@/lib/domain/plan-limits';

/** Estado del plan de una agencia: prueba / contratado / sin plan, y uso de atletas y puestos frente al límite. */
export function PlanUsage({ status, now }: { status: AgencyPlanStatus; now?: Date }) {
  const summary = planSummary(status, now);
  const rows: [string, number, number][] = [
    ['Atletas (propuestas, representados e invitaciones abiertas)', status.athletes_used, status.athletes_limit],
    ['Puestos del equipo', status.seats_used, status.seats_limit],
  ];
  return (
    <div className="mt-3 space-y-2" data-testid="plan-status">
      <Notice tone={summary.tone}>{summary.text}</Notice>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {rows.map(([label, used, limit], i) => (
          <div key={label} className={`stat-tile flex flex-col ${i === 0 ? 'is-hero' : ''}`}>
            <dt className="stat-tile-label !mt-0 mb-2">{label}</dt>
            <dd className="stat-tile-value text-[1.9rem]">{usageLabel(used, limit)}</dd>
            <div className={`mt-3 h-2 rounded-full ${i === 0 ? 'bg-white/15' : 'bg-line'}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usageRatio(used, limit) * 100)}>
              <div className={`h-2 rounded-full ${i === 0 ? 'bg-lime' : 'bg-brass'}`} style={{ width: `${Math.round(usageRatio(used, limit) * 100)}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
