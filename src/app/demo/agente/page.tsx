import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { AgentHomeView } from '@/app/app/AgentHome';
import { AthletesCrm } from '@/app/app/portfolio/AthletesCrm';
import { DEFAULT_CRM } from '@/lib/domain/athletes-crm';
import { previewAgentHome, previewCrmRows } from '@/lib/preview/agent-home';
import { PLANS } from '@/content/plans';

export const metadata: Metadata = {
  title: 'Demo para agentes',
  description: 'Prueba el espacio de trabajo de la agencia con datos de ejemplo, sin registrarte.',
  robots: { index: false, follow: true },
};

/**
 * Demo pública del espacio del agente (cliente que paga): la pantalla real «Hoy» y la cartera,
 * con datos FICTICIOS y sin base de datos. Sirve para que una agencia vea el producto antes de registrarse.
 */
export default function AgentDemoPage() {
  const solo = PLANS.find((p) => p.code === 'agent_solo');
  return (
    <div className="bg-ink">
      <PublicHeader />
      <main id="main-content">
        <div className="sticky top-16 z-30 border-b border-line bg-night text-[#f6f3ec]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <p className="text-sm"><strong className="font-semibold">Demo con datos de ejemplo.</strong> Así es tu agencia en The Gala Alliance; nada de lo que ves es real.</p>
            <Link href="/signup?role=agent" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-night">
              Probar 30 días gratis <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:px-8">
          <AgentHomeView displayName="Carlos Ruiz" data={previewAgentHome('full')} />
          <section aria-labelledby="demo-cartera">
            <p className="eyebrow text-gold">Atletas</p>
            <h2 id="demo-cartera" className="mt-2 text-3xl text-paper">Tu cartera, filtrable y en un solo sitio</h2>
            <div className="mt-6"><AthletesCrm rows={previewCrmRows()} initial={DEFAULT_CRM} agency={{ name: 'Norte Sports Management', verified: true }} /></div>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
            <h2 className="text-3xl text-paper">¿Lo montamos con tus atletas?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              {solo ? `${solo.name}: ${solo.price}${solo.priceNote ? ` (${solo.priceNote})` : ''}. ` : ''}Importa tus contactos desde Excel y empieza hoy. Sin comisiones ni cobro por contactar.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup?role=agent" className="inline-flex min-h-12 items-center rounded-full bg-paper px-6 font-semibold text-ink">Crear mi agencia</Link>
              <Link href="/precios" className="inline-flex min-h-12 items-center rounded-full border border-line-strong px-6 font-semibold text-paper">Ver precios</Link>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
