import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { FeedbackForm } from '@/components/growth';
import { requireSession, type SessionContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { familyPlan } from '@/lib/data/family';
import { sidebarFor } from '@/lib/domain/navigation';
import { roleHome, roleLabel } from '@/lib/domain/roles';
import { NavIcon } from '@/components/NavIcon';
import { Badge, ButtonLink, Card, Meter } from '@/components/ui';
import { AskGala } from '@/components/AskGala';
import { Reveal } from '@/components/Reveal';
import { AgentHome } from './AgentHome';

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

export default async function HomePage() {
  const session = await requireSession();
  const primary = session.primaryRole ?? session.roles[0];
  // El agente tiene un inicio propio (Agent Workspace) centrado en su cartera.
  if (primary === 'agent') return <AgentHome session={session} />;
  const supabase = await createClient();
  const [{ steps, score }, plan, { data: activity }] = await Promise.all([
    stepsFor(session),
    session.roles.some((r) => r === 'athlete' || r === 'parent') ? familyPlan([session.userId]) : Promise.resolve(null),
    supabase.from('notifications').select('id, title, body, link, created_at, read_at').eq('user_id', session.userId).order('created_at', { ascending: false }).limit(5),
  ]);
  const done = steps.filter((s) => s.done).length;
  const sections = sidebarFor(session.roles).filter((s) => s.title !== 'Inicio');
  const initials = session.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const PLAN_NAME: Record<string, string> = { free: 'Passport gratis', family_core: 'Core', family_elite: 'Elite', family_signature: 'Signature' };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      {/* Columna de perfil (como LinkedIn): quién eres, cómo de completo está tu perfil y tu plan. */}
      <div className="space-y-5">
        <Reveal>
          <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            <div className="relative h-20 bg-gradient-to-br from-brass/40 via-brass-deep/30 to-trust/30">
              <div className="bg-grid absolute inset-0" aria-hidden />
            </div>
            <div className="-mt-9 px-5 pb-5">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-surface bg-gradient-to-br from-brass to-brass-deep font-display text-2xl font-bold text-ink shadow-[var(--shadow-gold)]">{initials || 'G'}</span>
              <p className="mt-3 font-display text-lg font-bold text-paper">{session.displayName}</p>
              <p className="text-xs text-muted">{session.roles.map(roleLabel).join(' · ')}</p>
              {plan && <div className="mt-3"><Badge tone={plan === 'free' ? 'neutral' : 'brass'}>{PLAN_NAME[plan]}</Badge></div>}
              {score != null && <div className="mt-4"><Meter value={score} label="Passport listo" /></div>}
              {primary && <ButtonLink href={roleHome(primary)} variant="secondary" className="mt-4 w-full">Ir a mi espacio</ButtonLink>}
            </div>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <Card>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">Actividad reciente</p>
            {activity?.length ? (
              <ul className="space-y-3">
                {activity.map((n) => (
                  <li key={n.id} className="text-sm">
                    <Link href={n.link ?? '/app/notifications'} className="group block">
                      <span className={`block ${n.read_at ? 'text-muted' : 'font-medium text-paper'} group-hover:text-brass`}>{n.title}</span>
                      <span className="block text-xs text-faint">{new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aquí verás respuestas, cambios de estado y avisos.</p>
            )}
          </Card>
        </Reveal>
      </div>

      <div className="min-w-0 space-y-6">
        <Reveal>
          <header>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brass">
              <Sparkles className="h-3 w-3" aria-hidden /> Tu resumen
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-paper sm:text-4xl">Hola, {session.displayName.split(' ')[0]}</h1>
            <p className="mt-2 text-muted">Todo el proceso de becas en EE. UU. en un solo sitio. Empieza por tus primeros pasos.</p>
          </header>
        </Reveal>

        <Reveal delay={60}>
          <Card className="relative overflow-hidden">
            <div className="glow-gold pointer-events-none absolute -right-20 -top-20 h-60 w-60" aria-hidden />
            <div className="relative mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass">Primeros pasos</p>
                <h2 className="text-lg font-bold text-paper">{done === steps.length ? '¡Todo listo! Ya estás en marcha.' : `Te faltan ${steps.length - done} pasos para sacarle todo el partido`}</h2>
              </div>
              <span className="font-display text-3xl font-bold tabular-nums text-paper">{done}<span className="text-base text-faint">/{steps.length}</span></span>
            </div>
            <ol className="relative grid gap-2 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-all ${s.done ? 'border-ok/25 bg-ok/5 text-muted' : 'border-line bg-ink/40 text-paper hover:border-brass/50 hover:bg-brass/5'}`}>
                    {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-faint group-hover:text-brass" aria-hidden />}
                    <span className={`flex-1 ${s.done ? 'line-through decoration-faint/60' : ''}`}>{s.label}</span>
                    {!s.done && <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1 group-hover:text-brass" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </Reveal>

        <Reveal delay={100}>
          <Card className="paper-grain">
            <AskGala compact />
          </Card>
        </Reveal>

        {/* Mapa completo de servicios: cada uno dice para qué sirve, para que nadie se pierda. */}
        {sections.map((section, si) => (
          <Reveal key={section.title} delay={120 + si * 40}>
            <section aria-labelledby={`sec-${si}`}>
              <h2 id={`sec-${si}`} className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-faint">{section.title}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-brass transition-transform group-hover:scale-110"><NavIcon name={s.icon} className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-paper">{s.label}</span>
                        {s.desc && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{s.desc}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        ))}

        <Card>
          <FeedbackForm page="/app" />
        </Card>
      </div>
    </div>
  );
}
