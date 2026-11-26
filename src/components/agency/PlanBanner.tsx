'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { Notice, buttonClass, cx } from '@/components/ui';
import { useT } from '@/lib/i18n/client';
import { planBanner, usageLabel, type AgencyPlanStatus } from '@/lib/domain/plan-limits';

/**
 * Aviso del plan de la agencia en Hoy y Mis atletas (QA agente, hallazgo 1): días de prueba que quedan, atletas
 * usados frente al límite y un acceso directo a Facturación. Sin estado (p. ej. error al cargarlo) no se muestra nada.
 */
export function PlanBanner({ status, now, className }: { status: AgencyPlanStatus | null | undefined; now?: Date; className?: string }) {
  const tx = useT();
  const b = planBanner(status, now);
  if (!b) return null;
  const d = b.daysLeft;
  const head = {
    trial: d === 1 ? tx('Prueba gratuita: queda 1 día.') : tx(`Prueba gratuita: quedan ${d} días.`),
    trial_ending: d === 1 ? tx('Tu prueba gratuita acaba mañana.') : tx(`Tu prueba gratuita acaba en ${d} días.`),
    ended: tx('La prueba gratuita ha terminado.'),
    limit_near: tx('Estás cerca del límite de atletas de tu plan.'),
    limit_full: tx('Has llegado al límite de atletas de tu plan.'),
  }[b.kind];
  const detail = {
    trial: tx('Tienes el plan Agencia completo mientras dure la prueba.'),
    trial_ending: tx('Elige un plan para seguir añadiendo atletas e invitando a tu equipo. Lo que ya tienes se conserva.'),
    ended: tx('Conservas todo lo que tienes, pero para añadir atletas, invitaciones o miembros necesitas un plan.'),
    limit_near: tx('Las propuestas, los representados y las invitaciones abiertas cuentan.'),
    limit_full: tx('No podrás proponer ni invitar a más atletas hasta que amplíes el plan o canceles invitaciones que no uses.'),
  }[b.kind];
  const cta = b.kind === 'trial' ? tx('Ver planes') : tx('Elegir plan');
  return (
    <div className={className} data-testid="plan-banner" data-plan-kind={b.kind}>
      <Notice tone={b.tone}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1">
            <span className="font-semibold text-paper">{head}</span>{' '}
            <span>{detail}</span>{' '}
            <span className="whitespace-nowrap font-semibold tabular-nums" data-testid="plan-usage">{tx(`Atletas: ${usageLabel(b.used, b.limit)}`)}</span>
          </p>
          <Link href="/app/billing" className={cx(buttonClass(b.kind === 'trial' ? 'secondary' : 'primary', 'sm'), 'whitespace-nowrap')}>
            <CreditCard className="h-4 w-4" aria-hidden /> {cta}
          </Link>
        </div>
      </Notice>
    </div>
  );
}
