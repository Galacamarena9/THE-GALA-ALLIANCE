import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ButtonLink } from '@/components/ui';
import { PlanRequestForm } from '@/components/growth';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AUDIENCE_LABEL, PLANS, VISIBILITY_PROMISE, type PlanAudience } from '@/content/plans';

export const metadata: Metadata = {
  title: 'Planes y precios',
  description: 'Gratis para atletas, para siempre. Servicios de pago único para familias y planes para organizaciones verificadas.',
};

const GROUPS: { id: string; title: string; intro: string; audiences: PlanAudience[]; cols: string }[] = [
  { id: 'personas', title: 'Atletas y familias', intro: 'El perfil es gratis. Si quieres a un especialista a tu lado, pagas una vez por un resultado concreto.', audiences: ['athlete', 'family'], cols: 'md:grid-cols-3' },
  { id: 'organizaciones', title: 'Organizaciones', intro: 'Universidades, academias, agencias y marcas verificadas. Plazas de programa fundador durante el piloto.', audiences: ['organization', 'academy', 'agent', 'brand'], cols: 'md:grid-cols-2 xl:grid-cols-4' },
];

export default async function PricingPage() {
  // Página pública: si la autenticación no responde, se muestra igualmente como visitante.
  const session = await getSession().catch(() => null);
  let orgs: { id: string; name: string }[] = [];
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.from('organization_members').select('organizations(id, name)').eq('user_id', session.userId);
    orgs = (data ?? []).map((m) => m.organizations as unknown as { id: string; name: string }).filter(Boolean);
  }

  return (
    <div className="relative">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brass">Planes y servicios</p>
        <h1 className="mt-3 max-w-3xl text-4xl text-paper sm:text-5xl">Pagas por ayuda experta, nunca por que te vean</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{VISIBILITY_PROMISE}</p>

        {GROUPS.map((g) => {
          const plans = PLANS.filter((p) => g.audiences.includes(p.audience));
          return (
            <section key={g.id} className="mt-12" aria-labelledby={`grp-${g.id}`}>
              <h2 id={`grp-${g.id}`} className="text-2xl text-paper">{g.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{g.intro}</p>
              <div className={`mt-5 grid gap-4 ${g.cols}`}>
                {plans.map((p) => (
                  <article key={p.code} className={`flex flex-col rounded-[var(--radius-card)] border bg-surface p-6 ${p.highlight ? 'border-brass/60' : 'border-line'}`}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-faint">{AUDIENCE_LABEL[p.audience]}</p>
                    <h3 className="mt-1 text-xl text-paper">{p.name}</h3>
                    <p className="mt-2">
                      <span className={`font-display text-brass ${/\d/.test(p.price) ? 'text-3xl' : 'text-xl'}`}>{p.price}</span>
                      {p.priceNote && <span className="ml-2 text-sm text-faint">{p.priceNote}</span>}
                    </p>
                    <p className="mt-3 text-sm text-muted">{p.pitch}</p>
                    <ul className="mt-4 space-y-2 text-sm text-paper">
                      {p.includes.map((i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-brass" aria-hidden />{i}</li>)}
                    </ul>
                    <div className="mt-auto pt-6">
                      {p.cta === 'signup' ? (
                        <ButtonLink href={session ? '/app' : '/signup?role=athlete'} className="w-full justify-center">{session ? 'Ir a mi espacio' : 'Crear mi Passport gratis'}</ButtonLink>
                      ) : session ? (
                        <PlanRequestForm planCode={p.code} organizations={['organization', 'academy', 'agent', 'brand'].includes(p.audience) ? orgs : []} />
                      ) : (
                        <ButtonLink href="/signup" variant="secondary" className="w-full justify-center">Solicitar plaza</ButtonLink>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mt-14 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-sm text-muted">
          <h2 className="text-lg text-paper">Cómo funciona el pago</h2>
          <ul className="mt-3 space-y-2">
            <li>• Al solicitar un plan no se te cobra nada: te escribimos para confirmar tu caso, el alcance y el precio final antes de cualquier pago.</li>
            <li>• Ningún plan garantiza admisión, beca ni contrato, ni da prioridad en el escaparate.</li>
            <li>• Los servicios a consumidores incluyen el derecho de desistimiento cuando corresponda. Condiciones completas en los <Link href="/legal/terminos" className="text-brass hover:underline">términos</Link>.</li>
          </ul>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
