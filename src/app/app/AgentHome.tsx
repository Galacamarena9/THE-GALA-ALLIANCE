import { Suspense } from 'react';
import Link from 'next/link';
import { MessageSquare, RotateCw, Search } from 'lucide-react';
import type { SessionContext } from '@/lib/session';
import { loadAgentHome, type AgentHomeData } from '@/lib/data/agent-home';
import { EmptyState, Notice, buttonClass, cx } from '@/components/ui';
import { AgentHomeSkeleton, AthletesPreview, AttentionList, PipelineStrip, SummaryStrip } from '@/components/agent/HomeParts';
import { logEvent } from '@/lib/events';

/**
 * Inicio del agente «Hoy» (reforma 180°): lo que toca hoy → mis atletas → procesos por fase.
 * Todo sale de `loadAgentHome` (proyección segura con la sesión del agente; ver docs/AGENT-HOME.md).
 */
export function AgentHome({ session }: { session: SessionContext }) {
  return (
    <Suspense fallback={<AgentHomeSkeleton />}>
      <AgentHomeLoader session={session} />
    </Suspense>
  );
}

async function AgentHomeLoader({ session }: { session: SessionContext }) {
  const data = await loadAgentHome(session.userId);
  void logEvent('agent_home_viewed', { attention: data.attention.length, partial: data.partial.length > 0, state: data.state }, `agent_home:${new Date().toISOString().slice(0, 13)}`);
  return <AgentHomeView displayName={session.displayName} data={data} />;
}

export function AgentHomeView({ displayName, data, today = new Date().toISOString().slice(0, 10) }: { displayName: string; data: AgentHomeData; today?: string }) {
  const first = displayName.split(' ')[0] || 'agente';
  const date = new Date(`${today}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (data.state === 'error') {
    return (
      <div className="space-y-5">
        <Header first={first} date={date} />
        <div role="alert" className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-6">
          <p className="font-semibold text-paper">No hemos podido cargar tu inicio.</p>
          <p className="mt-1 text-sm text-muted">Tus datos están a salvo. Vuelve a intentarlo en unos segundos; si sigue fallando, escríbenos desde Ayuda.</p>
          <Link href="/app" className={cx(buttonClass('secondary', 'sm'), 'mt-4')}><RotateCw className="h-4 w-4" aria-hidden /> Reintentar</Link>
        </div>
      </div>
    );
  }

  if (data.state === 'no_agency') {
    return (
      <div className="space-y-5">
        <Header first={first} date={date} />
        <EmptyState title="Aún no tienes agencia" action={<Link href="/app/organization" className={buttonClass('primary')}>Registrar mi agencia</Link>}>
          Para ver atletas, procesos y ofertas necesitas una agencia verificada. Los datos de cada atleta solo se ven con su permiso.
        </EmptyState>
      </div>
    );
  }

  const noAthletes = data.summary.athletes === 0;
  return (
    <div className="flex flex-col gap-5">
      <Header first={first} date={date} agency={data.agency} />

      {!data.agency?.verified && (
        <Notice>Tu agencia está pendiente de verificación: los atletas verán tus propuestas cuando Gala la verifique. <Link href="/app/organization" className="font-semibold underline">Ver estado</Link></Notice>
      )}
      {data.partial.length > 0 && (
        <Notice tone="warn">No hemos podido cargar {data.partial.join(', ')}. El resto está al día; vuelve a cargar en un momento.</Notice>
      )}

      {/* Escritorio: resumen arriba. Móvil: Hoy → Mis atletas → Mensajes → Pipeline, y el resumen al final. */}
      <SummaryStrip s={data.summary} className="order-last sm:order-none" />

      {noAthletes ? (
        <EmptyState
          title="Tu cartera está vacía"
          action={<Link href="/app/discover" className={buttonClass('primary')}><Search className="h-4 w-4" aria-hidden /> Buscar talento</Link>}
        >
          {data.pendingProposals
            ? `Tienes ${data.pendingProposals} ${data.pendingProposals === 1 ? 'propuesta' : 'propuestas'} esperando respuesta. Mientras tanto, busca atletas por deporte, posición, físico y nivel.`
            : 'Busca atletas por deporte, posición, físico, nacionalidad y nivel, y propón representarlos. Solo verás sus datos con su permiso.'}
        </EmptyState>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <AttentionList items={data.attention} today={today} className="lg:col-start-1 lg:row-start-1" />
          <AthletesPreview rows={data.athletes} total={data.summary.athletes} today={today} className="lg:col-start-1 lg:row-start-2" />
          <div className="flex flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Link href="/app/inbox" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-sm font-semibold text-paper hover:border-brass/50 focus-visible:outline-2 focus-visible:outline-brass">
              <MessageSquare className="h-5 w-5 text-brass" aria-hidden /> Mensajes
              <span className="ml-auto text-xs font-normal text-muted">Abrir bandeja</span>
            </Link>
            <PipelineStrip stages={data.pipeline} />
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ first, date, agency }: { first: string; date: string; agency?: AgentHomeData['agency'] }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-gold">Agencia · Hoy</p>
        <h1 className="mt-2 font-display text-4xl text-paper sm:text-5xl">Hola, {first}</h1>
        <p className="mt-2 text-muted">Tus atletas, sus procesos y lo que hay que mover hoy. Nada más.</p>
        <p className="mt-1 text-xs text-faint"><span className="inline-block first-letter:uppercase">{date}</span>{agency ? ` · ${agency.name}${agency.verified ? ' ✓' : ''}` : ''}</p>
      </div>
      <Link href="/app/discover" className={buttonClass('primary')}><Search className="h-4 w-4" aria-hidden /> Buscar talento</Link>
    </header>
  );
}
