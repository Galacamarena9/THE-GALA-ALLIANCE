import type { Metadata } from 'next';
import { publicMeta } from '@/lib/seo/page-meta';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { AgentHomeView } from '@/app/app/AgentHome';
import { AthletesCrm } from '@/app/app/portfolio/AthletesCrm';
import { DEFAULT_CRM } from '@/lib/domain/athletes-crm';
import { previewAgentHome, previewCrmRows } from '@/lib/preview/agent-home';
import { PLANS } from '@/content/plans';
import { PipelineBoard } from '@/components/agency/PipelineBoard';
import { previewCases, previewSports } from '@/lib/preview/fixtures';
import { previewPipelineActions } from '@/lib/preview/pipeline';
import { getT } from '@/lib/i18n/server-t';

export const metadata: Metadata = publicMeta({
  title: 'Demo para agencias',
  description: 'Mira el espacio de trabajo de una agencia con datos de ejemplo, sin registrarte: tareas del día, procesos en 5 fases y cartera de atletas.',
  path: '/demo/agente',
  // follow:false: la demo contiene enlaces de la app real (/app/*) que fuera de una sesión no llevan a nada.
  robots: { index: false, follow: false },
});

/**
 * Demo pública del espacio del agente (cliente que paga): la pantalla real «Hoy» y la cartera,
 * con datos FICTICIOS y sin base de datos. Sirve para que una agencia vea el producto antes de registrarse.
 */
export default async function AgentDemoPage() {
  const tx = await getT();
  const solo = PLANS.find((p) => p.code === 'agent_solo');
  return (
    <div className="bg-ink">
      <PublicHeader />
      <main id="main-content">
        <div className="sticky top-16 z-30 border-b border-line bg-night text-[#f6f3ec]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <p className="text-sm"><strong className="font-semibold">Demo con datos de ejemplo.</strong> Así es tu agencia en The Gala Alliance; nada de lo que ves es real.</p>
            <Link href="/signup?role=agent&plan=agent_solo" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-night">
              Probar 30 días gratis <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl space-y-12 px-5 py-10 sm:px-8">
          <p className="text-xs text-faint">En la demo los botones no abren nada: es una vista de ejemplo.</p>
          {/* `inert`: ni ratón, ni teclado, ni lector de pantalla llegan a los enlaces de la app (antes solo pointer-events-none). */}
          <div inert className="select-none space-y-12" aria-describedby="demo-nota">
          <AgentHomeView displayName="Carlos Ruiz" data={previewAgentHome('full')} />
          <section aria-labelledby="demo-procesos">
            <p className="eyebrow text-gold">Procesos</p>
            <h2 id="demo-procesos" className="mt-2 text-3xl text-paper">Cada atleta con cada universidad, en <em>5 fases</em></h2>
            <p className="mt-2 max-w-2xl text-muted">{tx('Introducción, evaluación, visita o prueba, oferta y decisión. Cada tarjeta dice qué toca, a quién le toca y para cuándo. Lo bloqueado y lo vencido salen primero.')}</p>
            <div className="mt-6"><PipelineBoard cases={previewCases} view="board" sportName={new Map(previewSports.map((s) => [s.id, s.name_es]))} actions={previewPipelineActions()} /></div>
          </section>
          <section aria-labelledby="demo-cartera">
            <p className="eyebrow text-gold">Atletas</p>
            <h2 id="demo-cartera" className="mt-2 text-3xl text-paper">Tu cartera, filtrable y en un solo sitio</h2>
            <div className="mt-6 overflow-x-auto"><AthletesCrm rows={previewCrmRows()} initial={DEFAULT_CRM} agency={{ name: 'Norte Sports Management', verified: true }} /></div>
          </section>
          </div>
          <p id="demo-nota" className="sr-only">Vista de ejemplo con datos ficticios; los enlaces están desactivados.</p>
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
            <h2 className="text-3xl text-paper">¿Lo montamos con tus atletas?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              {solo ? `${solo.name}: ${solo.price}${solo.priceNote ? ` (${solo.priceNote})` : ''}. ` : ''}Importa tus procesos y contactos desde Excel (CSV) y empieza hoy. Sin comisiones ni cobro por contactar.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup?role=agent&plan=agent_solo" className="inline-flex min-h-12 items-center rounded-full bg-paper px-6 font-semibold text-ink">Crear mi agencia</Link>
              <Link href="/precios" className="inline-flex min-h-12 items-center rounded-full border border-line-strong px-6 font-semibold text-paper">Ver precios</Link>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter audience="agent" />
    </div>
  );
}
