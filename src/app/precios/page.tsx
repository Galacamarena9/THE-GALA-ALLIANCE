import { I18nProvider } from '@/lib/i18n/client';
import { getT } from '@/lib/i18n/server-t';
import { founderSeats } from '@/lib/domain/fee-attestation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { ButtonLink } from '@/components/ui';
import { PlanRequestForm } from '@/components/growth';
import { startCheckout } from '@/app/actions/autonomy';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AUDIENCE_LABEL, PLANS, VISIBILITY_PROMISE, type Plan, type PlanAudience } from '@/content/plans';

/** Tipo de cuenta con el que se da de alta cada público (para que el alta no diga «gratis para atletas» a una agencia). */
const SIGNUP_ROLE: Record<PlanAudience, string> = { athlete: 'athlete', family: 'parent', organization: 'university', academy: 'coach', agent: 'agent', brand: 'brand' };
/** Alta con el plan elegido; tras crear la cuenta vuelve a /precios con la sesión abierta para enviar la solicitud. */
const signupHref = (p: Plan, withNext = false) =>
  `/signup?role=${SIGNUP_ROLE[p.audience]}&plan=${p.code}${withNext ? `&next=${encodeURIComponent(`/precios?plan=${p.code}`)}` : ''}`;

export async function generateMetadata(): Promise<Metadata> {
  const tx = await getT();
  return {
    title: tx('Planes y precios'),
    description: tx('Gratis para atletas, para siempre. Servicios de pago único para familias y planes para organizaciones verificadas.'),
  };
}

/** Agencias primero: es quien paga (QA web-admin #6). */
const GROUPS: { id: string; title: string; intro: string; audiences: PlanAudience[]; cols: string }[] = [
  { id: 'agencias', title: 'Agencias', intro: 'Programa fundador: las 15 primeras agencias pagan un 40 % menos de por vida (47 €/mes Agente, 119 €/mes Agencia). Todas empiezan con 30 días gratis y cancelan cuando quieran. Precios sin IVA. Nunca cobramos comisión por atleta ni por contactar.', audiences: ['agent'], cols: 'md:grid-cols-3' },
  { id: 'personas', title: 'Atletas y familias', intro: 'El perfil es gratis. Core y Elite se generan al momento desde tu Passport, sin esperas ni citas. Signature es el acompañamiento personal de la fundadora.', audiences: ['athlete', 'family'], cols: 'md:grid-cols-2 xl:grid-cols-4' },
  { id: 'organizaciones', title: 'Universidades, academias y marcas', intro: 'Se verifican solas con el correo de su dominio oficial. Gratis durante el piloto.', audiences: ['organization', 'academy', 'brand'], cols: 'md:grid-cols-3' },
];

export default async function PricingPage() {
  const tx = await getT();
  // Página pública: si la autenticación no responde, se muestra igualmente como visitante.
  const session = await getSession().catch(() => null);
  const payments = Boolean(process.env.STRIPE_SECRET_KEY);
  // Contacto ya existente en la configuración (el de la fundadora, que usa /inversores). Sin él, solo el formulario.
  const contactEmail = process.env.NEXT_PUBLIC_INVESTOR_EMAIL || null;
  let orgs: { id: string; name: string }[] = [];
  const founder = founderSeats(await (async () => {
    try { const { data } = await (await createClient()).rpc('agency_founder_status'); return (data as { cap: number; taken: number; remaining: number }[] | null)?.[0]; } catch { return null; }
  })());
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.from('organization_members').select('organizations(id, name)').eq('user_id', session.userId);
    orgs = (data ?? []).map((m) => m.organizations as unknown as { id: string; name: string }).filter(Boolean);
  }

  return (
    <I18nProvider locale={tx.locale}>
    <div className="relative" lang={tx.locale}>
      <PublicHeader locale={tx.locale} />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brass">{tx('Planes y servicios')}</p>
        <h1 className="mt-3 max-w-3xl text-4xl text-paper sm:text-5xl">{tx('Pagas por ayuda experta, nunca por que te vean')}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{tx(VISIBILITY_PROMISE)}</p>

        {GROUPS.map((g) => {
          const plans = PLANS.filter((p) => g.audiences.includes(p.audience));
          return (
            <section key={g.id} className="mt-12" aria-labelledby={`grp-${g.id}`}>
              <h2 id={`grp-${g.id}`} className="text-2xl text-paper">{tx(g.title)}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{tx(g.intro)}</p>
              {g.id === 'agencias' && <p className="mt-2 text-sm font-semibold text-brass" data-testid="founder-seats">{tx(founder.text)}</p>}
              <div className={`mt-5 grid gap-4 ${g.cols}`}>
                {plans.map((p) => (
                  <article key={p.code} className={`flex flex-col rounded-[var(--radius-card)] border bg-surface p-6 ${p.highlight ? 'border-brass/60' : 'border-line'}`}>
                    <p className="text-xs uppercase tracking-[0.18em] text-faint">{tx(AUDIENCE_LABEL[p.audience])}</p>
                    <h3 className="mt-1 text-xl text-paper">{tx(p.name)}</h3>
                    <p className="mt-2">
                      <span className={`font-display text-brass ${/\d/.test(p.price) ? 'text-3xl' : 'text-xl'}`}>{tx(p.price)}</span>
                      {p.priceNote && <span className="ml-2 text-sm text-faint">{tx(p.priceNote)}</span>}
                    </p>
                    <p className="mt-3 text-sm text-muted">{tx(p.pitch)}</p>
                    <ul className="mt-4 space-y-2 text-sm text-paper">
                      {p.includes.map((i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-brass" aria-hidden />{tx(i)}</li>)}
                    </ul>
                    <div className="mt-auto pt-6">
                      {(p.cta !== 'request' || p.delivery === 'personal') && (
                        <p className="mb-3 text-xs text-faint">
                          {p.delivery === 'personal' ? tx('Incluye trabajo personal 1:1. Plazas limitadas.') : p.cta === 'checkout' ? tx('Se activa al momento tras el pago, sin esperas.') : tx('Alta inmediata, sin esperas.')}
                        </p>
                      )}
                      {p.cta === 'signup' ? (
                        <ButtonLink href={session ? '/app' : signupHref(p)} className="w-full justify-center">{session ? tx('Ir a mi espacio') : p.audience === 'athlete' ? tx('Crear mi Passport gratis') : p.audience === 'agent' ? tx('Probar 30 días gratis') : tx('Crear cuenta gratis')}</ButtonLink>
                      ) : p.cta === 'checkout' && payments && session ? (
                        <form action={startCheckout} className="grid gap-2">
                          <input type="hidden" name="plan_code" value={p.code} />
                          <label className="flex gap-2 text-xs text-muted">
                            <input type="checkbox" name="withdrawal_waiver" required className="mt-0.5 accent-[var(--color-brass)]" />
                            <span>{tx('Quiero acceso inmediato y acepto que, al empezar la entrega del contenido digital, pierdo el derecho de desistimiento.')}</span>
                          </label>
                          <button className="rounded-lg bg-brass px-4 py-2.5 text-sm font-medium text-ink hover:brightness-110">{tx('Pagar')} {tx(p.price)} {tx('y empezar')}</button>
                        </form>
                      ) : session ? (
                        <PlanRequestForm planCode={p.code} organizations={['organization', 'academy', 'agent', 'brand'].includes(p.audience) ? orgs : []} />
                      ) : p.cta === 'checkout' ? (
                        <ButtonLink href={signupHref(p)} className="w-full justify-center">{`${tx('Empezar con')} ${tx(p.name)}`}</ButtonLink>
                      ) : (
                        // «Solicitar plaza» sin sesión: alta con el plan y vuelta aquí para enviar la solicitud (formulario real);
                        // si está configurado el contacto de la fundadora, también se le puede escribir directamente.
                        <div className="grid gap-2">
                          <ButtonLink href={signupHref(p, true)} variant="secondary" className="w-full justify-center">{tx('Solicitar plaza')}</ButtonLink>
                          {contactEmail && (
                            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(`The Gala Alliance · ${tx(p.name)}`)}`} className="text-center text-xs text-brass underline underline-offset-2">{tx('O escribe a la fundadora')}</a>
                          )}
                          <p className="text-center text-[11px] text-faint">{tx('Crea tu cuenta gratis y envía la solicitud: te escribimos para cerrar el alcance. No se cobra nada sin tu confirmación por escrito.')}</p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mt-14 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-sm text-muted">
          <h2 className="text-lg text-paper">{tx('Cómo funciona el pago')}</h2>
          <ul className="mt-3 space-y-2">
            <li>{tx('• Core y Elite se pagan una sola vez con tarjeta (Stripe) y se activan solos en cuanto se confirma el pago. Mientras el pago online no esté activo, la solicitud no te compromete a nada.')}</li>
            <li>{tx('• Signature es a medida: primero hablamos de tu caso y el precio se cierra por escrito antes de cualquier pago.')}</li>
            <li>{tx('• Ningún plan garantiza admisión, beca ni contrato, ni da prioridad en el escaparate.')}</li>
            <li>{tx('• Los servicios a consumidores incluyen el derecho de desistimiento cuando corresponda. Condiciones completas en los')}{' '}<Link href="/legal/terminos" className="text-brass underline underline-offset-2">{tx('términos')}</Link>.</li>
          </ul>
        </section>
      </main>
      <PublicFooter locale={tx.locale} />
    </div>
    </I18nProvider>
  );
}
