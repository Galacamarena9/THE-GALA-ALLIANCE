import Link from 'next/link';
import { ArrowRight, CalendarDays, CheckCircle2, FileText, GraduationCap, Lock, Plane, Scale, ScrollText, Users } from 'lucide-react';
import { planByCode } from '@/content/plans';
import { PREMIUM_FEATURES, featureState, unlockSummary, type AnyFamilyPlan } from '@/lib/domain/unlocks';
import { FAMILY_ASK_HREF } from '@/lib/domain/minor-guard';

const ICON = { report: FileText, cv: ScrollText, shortlist: GraduationCap, calendar: CalendarDays, offers: Scale, memo: CheckCircle2, visa: Plane, family: Users } as const;

/**
 * Escaparate de funciones de pago: se ven todas, desbloqueadas o no, con una vista previa difuminada
 * de lo que contiene cada una. Así el usuario sabe exactamente qué gana antes de pagar.
 */
export function PlanUnlocks({ plan, askFamily = false }: { plan: AnyFamilyPlan; /** Atleta menor: no hay CTA de pago, se pide a la familia. */ askFamily?: boolean }) {
  const { unlocked, total, next } = unlockSummary(plan);
  const buyHref = askFamily ? FAMILY_ASK_HREF : '/precios';
  const nextPlan = next ? planByCode(next) : null;
  return (
    <section aria-labelledby="unlocks-title" className="rise-in overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-surface-2/60 px-6 py-5">
        <div>
          <p className="text-[13px] font-semibold text-brass">Herramientas de tu plan</p>
          <h2 id="unlocks-title" className="font-display text-[28px] font-bold uppercase leading-none text-paper">{unlocked === total ? 'Lo tienes todo desbloqueado' : 'Lo que puedes desbloquear'}</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-gradient-to-r from-brass to-lime" style={{ width: `${(unlocked / total) * 100}%` }} /></div>
            <span className="text-sm text-muted">{unlocked} de {total} desbloqueadas</span>
          </div>
        </div>
        {nextPlan && (
          <Link href={buyHref} className="group inline-flex items-center gap-2 rounded-xl bg-night px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
            {askFamily ? <>Pídeselo a tu familia · {nextPlan.name}</> : <>Desbloquear con {nextPlan.name} · {nextPlan.price}</>} <ArrowRight className="h-4 w-4 text-lime transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        )}
      </header>
      <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
        {PREMIUM_FEATURES.map((f) => {
          const Icon = ICON[f.key as keyof typeof ICON] ?? FileText;
          const open = featureState(plan, f) === 'unlocked';
          const p = planByCode(f.plan);
          return (
            <li key={f.key} className="group relative bg-surface p-5 transition-colors hover:bg-surface-2/70">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${open ? 'bg-brass text-ink' : 'bg-surface-2 text-muted'}`}><Icon className="h-5 w-5" aria-hidden /></span>
                {open ? (
                  <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">Incluido</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-night px-2.5 py-1 text-xs font-semibold text-lime"><Lock className="h-3 w-3" aria-hidden /> {p?.name}</span>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-paper">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
              {/* Vista previa: nítida si está incluida, difuminada si está bloqueada. */}
              <ul className={`mt-3 space-y-1 rounded-xl border border-line bg-surface-2 p-3 text-xs text-paper ${open ? '' : 'select-none blur-[3px] transition-[filter] duration-500 group-hover:blur-[1.5px]'}`} aria-hidden={!open}>
                {f.preview.map((x) => <li key={x} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{x}</li>)}
              </ul>
              <Link href={open ? f.href : buyHref} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brass after:absolute after:inset-0">
                {open ? 'Abrir' : askFamily ? 'Pídeselo a tu familia' : `Desbloquear con ${p?.name}`} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-6 py-3 text-xs text-faint">Tu perfil, el escaparate, las candidaturas y recibir contacto son gratis para siempre. Los planes solo añaden herramientas.</p>
    </section>
  );
}
