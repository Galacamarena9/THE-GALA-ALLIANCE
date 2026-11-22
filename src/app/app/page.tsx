import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { FeedbackForm } from '@/components/growth';
import { requireSession, type SessionContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { familyPlan } from '@/lib/data/family';
import { PERSONAL_SERVICES, WORKSPACE_HOME } from '@/lib/domain/navigation';
import { roleHome } from '@/lib/domain/roles';
import { NavIcon } from '@/components/NavIcon';
import { Card, CardTitle } from '@/components/ui';
import { AskGala } from '@/components/AskGala';
import { Reveal } from '@/components/Reveal';
import { AgentHome } from './AgentHome';
import { RoleHero } from '@/components/RoleHero';
import { PlanUnlocks } from '@/components/PlanUnlocks';
import { isoDaysAgo } from '@/lib/domain/funnel';
import { loadAthleteDashboard } from '@/lib/data/dashboard';
import { AthleteCommandCenter } from '@/components/dashboard/AthleteCommandCenter';
import { logEvent } from '@/lib/events';

export const metadata: Metadata = { title: 'Inicio' };

interface Step { label: string; href: string; done?: boolean }

/** Primeros pasos por tipo de usuario: lo mínimo para sacar valor el primer día. */
async function stepsFor(session: SessionContext): Promise<{ steps: Step[]; score: number | null }> {
  const supabase = await createClient();
  const r = session.roles;
  if (r.includes('athlete')) {
    const p = await loadPassport(session.userId);
    const [{ count: apps }, { count: docs }, { count: family }] = await Promise.all([
      supabase.from('applications').select('id', { count: 'exact', head: true }).eq('athlete_id', session.userId),
      supabase.from('athlete_documents').select('id', { count: 'exact', head: true }).eq('athlete_id', session.userId),
      supabase.from('parent_athlete_links').select('id', { count: 'exact', head: true }).eq('athlete_id', session.userId).eq('status', 'approved'),
    ]);
    return {
      score: p.readiness.score,
      steps: [
        { label: 'Completa tu Passport (deporte, vídeo, notas e idiomas)', href: '/app/athlete/passport', done: p.readiness.score >= 80 },
        { label: 'Apúntate a tu primera beca', href: '/app/opportunities', done: (apps ?? 0) > 0 },
        { label: 'Crea tu checklist de documentos', href: '/app/documents', done: (docs ?? 0) > 0 },
        { label: 'Invita a tu familia para que te acompañe', href: '/app/settings', done: (family ?? 0) > 0 },
        { label: 'Haz un test de la Academia SAT/TOEFL', href: '/app/academia' },
      ],
    };
  }
  if (r.includes('parent')) {
    const { count } = await supabase.from('parent_athlete_links').select('id', { count: 'exact', head: true }).eq('parent_id', session.userId).eq('status', 'approved');
    return {
      score: null,
      steps: [
        { label: 'Vincúlate con tu hijo o hija (con su aprobación)', href: '/app/family', done: (count ?? 0) > 0 },
        { label: 'Calcula el coste real a 4 años', href: '/app/calculator' },
        { label: 'Prepara la documentación del proceso', href: '/app/documents' },
        { label: 'Lee la guía oficial del proceso', href: '/app/guia' },
      ],
    };
  }
  if (r.some((x) => ['university', 'coach', 'agent', 'brand'].includes(x))) {
    const { data: orgs } = await supabase.from('organization_members').select('organizations(verification_status)').eq('user_id', session.userId);
    const verified = (orgs ?? []).some((o) => (o.organizations as unknown as { verification_status: string } | null)?.verification_status === 'verified');
    return {
      score: null,
      steps: [
        { label: 'Registra tu organización con el correo de tu dominio oficial', href: '/app/organization', done: (orgs ?? []).length > 0 },
        { label: 'Verificación de la organización', href: '/app/organization', done: verified },
        { label: r.includes('brand') ? 'Publica tu primera campaña' : 'Explora el escaparate de atletas', href: r.includes('brand') ? '/app/campaigns?view=mine' : '/app/discover' },
        { label: 'Guarda una búsqueda con alertas', href: '/app/discover' },
      ],
    };
  }
  return { score: null, steps: [{ label: 'Revisa el panel de mando', href: '/app/admin/panel' }] };
}

/** Lo nuevo para cada actor: la cifra que más le importa al abrir la app, con su enlace. Datos reales filtrados por RLS. */
async function roleSignal(session: SessionContext, supabase: Awaited<ReturnType<typeof createClient>>, role: string | undefined) {
  const weekAgo = isoDaysAgo(7);
  if (role === 'athlete') {
    const { count } = await supabase.from('recruiting_link_views').select('id, recruiting_links!inner(athlete_id)', { count: 'exact', head: true }).eq('recruiting_links.athlete_id', session.userId).gte('viewed_at', weekAgo);
    return { label: 'Aperturas de tu enlace (7 días)', value: count ?? 0, href: '/app/share', cta: (n: number) => `Mira quién ha abierto tu perfil (${n})` };
  }
  if (role === 'parent') {
    const { count } = await supabase.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_guardian');
    return { label: 'Contactos por aprobar', value: count ?? 0, href: '/app/family', cta: (n: number) => `Revisa ${n} solicitud${n > 1 ? 'es' : ''} de contacto` };
  }
  if (role === 'university' || role === 'coach') {
    const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'applied');
    return { label: 'Candidaturas nuevas', value: count ?? 0, href: '/app/applications', cta: (n: number) => `Revisa ${n} candidatura${n > 1 ? 's' : ''} nueva${n > 1 ? 's' : ''}` };
  }
  if (role === 'brand') {
    const { count } = await supabase.from('campaign_applications').select('id', { count: 'exact', head: true }).eq('status', 'applied');
    return { label: 'Candidaturas a tus campañas', value: count ?? 0, href: '/app/campaigns?view=mine', cta: (n: number) => `Revisa ${n} candidatura${n > 1 ? 's' : ''}` };
  }
  return null;
}

export default async function HomePage() {
  const session = await requireSession();
  const primary = session.primaryRole ?? session.roles[0];
  // El agente tiene un inicio propio (Agent Workspace) centrado en su cartera.
  if (primary === 'agent') return <AgentHome session={session} />;
  // El atleta tiene su Command Center: qué hacer ahora, por qué y qué se acerca, con datos reales.
  if (primary === 'athlete') {
    const d = await loadAthleteDashboard(session.userId, session.isMinor);
    if (d) {
      void logEvent('dashboard_viewed', { stage: d.stage, actions: d.actions.length });
      return (
        <>
          <AthleteCommandCenter d={d} firstName={session.displayName.split(' ')[0] || 'atleta'} isMinor={session.isMinor} />
          <Card className="mt-6"><AskGala compact /></Card>
        </>
      );
    }
  }
  const supabase = await createClient();
  const [{ steps, score }, plan, { data: activity }, { count: unreadCount }, signal] = await Promise.all([
    stepsFor(session),
    session.roles.some((r) => r === 'athlete' || r === 'parent') ? familyPlan([session.userId]) : Promise.resolve(null),
    supabase.from('notifications').select('id, title, body, link, created_at, read_at').eq('user_id', session.userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.userId).is('read_at', null),
    roleSignal(session, supabase, primary),
  ]);
  const done = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);
  const unread = unreadCount ?? 0;
  // Con los primeros pasos hechos, cada organización y la familia van directas a su espacio de trabajo:
  // el inicio genérico solo existe para arrancar, no para repetir el menú.
  const workspace = primary ? WORKSPACE_HOME[primary] : undefined;
  if (workspace && done === steps.length && !(signal && signal.value > 0)) redirect(workspace);
  const mine = primary ? { items: PERSONAL_SERVICES[primary] } : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <RoleHero
        role={primary ?? 'athlete'}
        firstName={session.displayName.split(' ')[0]}
        status={done === steps.length ? 'Todo al día' : `${steps.length - done} paso${steps.length - done > 1 ? 's' : ''} por completar`}
        next={signal && signal.value > 0 ? { label: signal.cta(signal.value), href: signal.href } : nextStep ? { label: nextStep.label, href: nextStep.href } : primary ? { label: 'Ir a mi espacio', href: roleHome(primary) } : undefined}
        stats={[
          ...(score != null ? [{ label: 'Passport listo', value: score, suffix: '%' }] : []),
          ...(signal ? [{ label: signal.label, value: signal.value, href: signal.href }] : []),
          { label: 'Primeros pasos', value: done, note: `de ${steps.length}` },
          { label: 'Avisos sin leer', value: unread },
        ]}
      />

      {done < steps.length && (
        <Reveal delay={60}>
          <Card>
            <CardTitle kicker="Para empezar" action={<span className="text-sm text-muted">{done} de {steps.length}</span>}>Tus primeros pasos</CardTitle>
            <ol className="grid gap-3 sm:grid-cols-2" aria-label="Primeros pasos">
              {steps.map((s, i) => {
                const current = !s.done && s === nextStep;
                return (
                  <li key={s.label}>
                    <Link href={s.href} className={`group flex items-center gap-3 rounded-xl border p-3 transition-colors ${current ? 'border-brass/50 bg-brass/5' : 'border-line hover:border-brass/40'}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${s.done ? 'border-brass bg-brass text-ink' : current ? 'border-brass text-brass' : 'border-line text-faint'}`}>
                        {s.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
                      </span>
                      <span className={`text-sm font-semibold ${s.done ? 'text-muted line-through decoration-faint/60' : 'text-paper group-hover:text-brass'}`}>{s.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        </Reveal>
      )}

      {mine && (
        <section aria-labelledby="mine">
          <h2 id="mine" className="mb-3 text-[13px] font-semibold text-faint">Lo que más vas a usar</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mine.items.filter((i) => !i.more).slice(0, 4).map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass/10 text-brass"><NavIcon name={s.icon} className="h-5 w-5" /></span>
                  <span className="text-sm font-semibold text-paper">{s.label}</span>
                  {s.desc && <span className="text-xs leading-relaxed text-muted">{s.desc}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="paper-grain"><AskGala compact /></Card>
        <Card>
          <CardTitle kicker="Avisos" action={<Link href="/app/notifications" className="text-sm font-semibold text-brass">Todos</Link>}>Lo último</CardTitle>
          {activity?.length ? (
            <ul className="space-y-3">
              {activity.slice(0, 4).map((n) => (
                <li key={n.id} className="text-sm">
                  <Link href={n.link ?? '/app/notifications'} className="group block">
                    <span className={`block ${n.read_at ? 'text-muted' : 'font-medium text-paper'} group-hover:text-brass`}>{n.title}</span>
                    <span className="block text-xs text-faint">{new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Aquí verás respuestas, cambios de estado y avisos.</p>}
        </Card>
      </div>

      {plan && plan === 'free' && <PlanUnlocks plan={plan} />}

      <details className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold text-paper">¿Algo que mejorar? Cuéntanoslo</summary>
        <div className="mt-3"><FeedbackForm page="/app" /></div>
      </details>
    </div>
  );
}
