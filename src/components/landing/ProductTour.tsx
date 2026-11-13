'use client';

import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Bot, Columns3, IdCard, LayoutGrid, ShieldCheck } from 'lucide-react';

const TABS = [
  { key: 'passport', label: 'Passport', Icon: IdCard, title: 'Tu perfil, comparable y verificable', text: 'Vídeo, estadísticas, notas, idiomas y objetivos. Cada dato indica si es declarado, documentado o confirmado por tu club.' },
  { key: 'showcase', label: 'Escaparate', Icon: LayoutGrid, title: 'Te encuentran por encaje, no por fama', text: 'Universidades y clubes verificados filtran por deporte, posición, año, división, nota e inglés. Nadie paga por salir primero.' },
  { key: 'trust', label: 'Sello y alarmas', Icon: ShieldCheck, title: 'Cada beca con su sello de confianza', text: 'Cinco niveles de verificación y un detector de señales de alarma: pagos por adelantado, becas "garantizadas", prisas o cifras sin fuente.' },
  { key: 'compare', label: 'Comparador', Icon: Columns3, title: 'Decide con números, no con intuiciones', text: 'Hasta cinco ofertas lado a lado con coste neto, riesgos y un memo imprimible con la opción más sólida.' },
  { key: 'ai', label: 'Gala IA', Icon: Bot, title: 'Tu asistente del proceso, a cualquier hora', text: 'Resuelve dudas de divisiones, documentos, visado o plazos con la guía oficial como base. Nunca promete becas.' },
] as const;

function Screen({ k }: { k: (typeof TABS)[number]['key'] }) {
  const frame = 'rounded-2xl border border-line bg-ink/70 p-5';
  if (k === 'passport') return (
    <div className={frame}>
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brass to-brass-deep font-bold text-ink">AP</span><div><p className="font-bold text-paper">Álex P.</p><p className="text-xs text-muted">Fútbol · Mediocentro · 2027</p></div></div>
      <div className="mt-4 space-y-2 text-xs">
        {[['Goles 2025-26', '11', 'Confirmado por el club', 'text-ok'], ['Nota media', '7,9', 'Documentado', 'text-brass'], ['Inglés', 'B2', 'Declarado', 'text-muted']].map(([l, v, s, c]) => (
          <div key={l} className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span className="text-muted">{l}</span><span className="flex items-center gap-3"><span className="font-bold text-paper">{v}</span><span className={c}>{s}</span></span></div>
        ))}
      </div>
    </div>
  );
  if (k === 'showcase') return (
    <div className={frame}>
      <div className="mb-3 flex flex-wrap gap-1.5">{['Fútbol', 'Mediocentro', '2027', 'Nota 7+', 'Inglés B2+'].map((t) => <span key={t} className="rounded-full border border-brass/30 bg-brass/10 px-2.5 py-1 text-[10px] text-brass">{t}</span>)}</div>
      {[['Álex P.', 'Mediocentro · 7,9 · B2', 'Encaje alto'], ['Hugo S.', 'Mediocentro · 7,4 · C1', 'Encaje alto'], ['Iker M.', 'Pivote · 8,2 · B2', 'Encaje medio']].map(([n, d, f]) => (
        <div key={n} className="mb-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs"><span><span className="block font-medium text-paper">{n}</span><span className="text-faint">{d}</span></span><span className={f === 'Encaje alto' ? 'text-ok' : 'text-brass'}>{f}</span></div>
      ))}
    </div>
  );
  if (k === 'trust') return (
    <div className={frame}>
      <div className="flex items-center justify-between"><p className="text-sm font-bold text-paper">Beca parcial · State University</p><span className="font-display text-2xl font-bold text-paper">4<span className="text-sm text-faint">/5</span></span></div>
      <div className="mt-3 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= 4 ? 'bg-brass' : 'bg-line'}`} />)}</div>
      <ul className="mt-4 space-y-1.5 text-xs">{['Organización verificada', 'Requisitos y plazo revisados', 'Importes documentados'].map((t) => <li key={t} className="flex items-center gap-2 text-paper"><BadgeCheck className="h-3.5 w-3.5 text-ok" aria-hidden />{t}</li>)}</ul>
      <div className="mt-4 rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-paper"><AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-warn" aria-hidden />Otra oferta pide un «depósito de reserva»: señal de alarma.</div>
    </div>
  );
  if (k === 'compare') return (
    <div className={frame}>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-faint"><th className="pb-2 font-normal">Oferta</th><th className="pb-2 text-right font-normal">Neto/año</th><th className="pb-2 text-right font-normal">Riesgos</th></tr></thead>
        <tbody>{[['State University', '9.800 $', '0', 'text-ok'], ['Lakeside College', '6.200 $', '1 grave', 'text-danger'], ['River College', '12.400 $', '1 aviso', 'text-warn']].map(([n, c, r, cl]) => <tr key={n} className="border-t border-line"><td className="py-2 text-paper">{n}</td><td className="py-2 text-right tabular-nums text-paper">{c}</td><td className={`py-2 text-right ${cl}`}>{r}</td></tr>)}</tbody>
      </table>
      <p className="mt-3 rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-paper">Memo: la opción más sólida hoy es <strong>State University</strong>.</p>
    </div>
  );
  return (
    <div className={`${frame} space-y-3 text-xs`}>
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brass/15 px-3 py-2 text-paper">¿Necesito el SAT para jugar en la NCAA?</p>
      <p className="max-w-[90%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-2 text-muted">La NCAA ya no lo exige para competir, pero algunas universidades lo piden para la admisión o para becas académicas. Te digo cuáles de tu shortlist lo piden.</p>
    </div>
  );
}

/** Recorrido por el producto con pestañas: se ve qué hace la plataforma sin registrarse. */
export function ProductTour() {
  const [k, setK] = useState<(typeof TABS)[number]['key']>('passport');
  const t = TABS.find((x) => x.key === k)!;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div role="tablist" aria-label="Funciones" className="flex flex-wrap gap-2">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} role="tab" aria-selected={k === key} onClick={() => setK(key)} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-all ${k === key ? 'border-brass bg-brass/10 text-paper' : 'border-line text-muted hover:border-brass/40 hover:text-paper'}`}>
              <Icon className={`h-4 w-4 ${k === key ? 'text-brass' : ''}`} aria-hidden />{label}
            </button>
          ))}
        </div>
        <div key={k} className="animate-fade-in-up mt-8">
          <h3 className="text-2xl font-bold text-paper sm:text-3xl">{t.title}</h3>
          <p className="mt-3 max-w-lg leading-relaxed text-muted">{t.text}</p>
        </div>
      </div>
      <div className="relative">
        <div className="glow-gold pointer-events-none absolute inset-0 -z-10 scale-110" aria-hidden />
        <div className="rounded-3xl border border-line-strong bg-surface p-3 shadow-[var(--shadow-premium)]">
          <div className="mb-3 flex items-center gap-1.5 px-2 pt-1" aria-hidden><span className="h-2.5 w-2.5 rounded-full bg-danger/60" /><span className="h-2.5 w-2.5 rounded-full bg-warn/60" /><span className="h-2.5 w-2.5 rounded-full bg-ok/60" /><span className="ml-3 rounded-md bg-ink/60 px-3 py-0.5 text-[10px] text-faint">thegalaalliance.app</span></div>
          <div key={k} className="animate-fade-in-up"><Screen k={k} /></div>
        </div>
      </div>
    </div>
  );
}
