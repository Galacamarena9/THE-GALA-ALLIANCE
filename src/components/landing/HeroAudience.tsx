'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, Eye, GraduationCap, Lock, Search, Star, Users } from 'lucide-react';

type Key = 'athlete' | 'family' | 'university' | 'club';

const AUDIENCES: Record<Key, { tab: string; Icon: typeof Users; title: [string, string]; text: string; cta: [string, string]; alt: [string, string] }> = {
  athlete: {
    tab: 'Soy atleta', Icon: GraduationCap,
    title: ['Si tienes nivel, tienes que poder optar.', 'Tengas o no los contactos.'],
    text: 'Crea tu Passport deportivo y académico gratis y deja que universidades y clubes verificados te encuentren. Sin pagar por visibilidad.',
    cta: ['Crear mi Passport gratis', '/signup?role=athlete'], alt: ['¿Tengo opciones? Haz el test', '#test'],
  },
  family: {
    tab: 'Soy familia', Icon: Users,
    title: ['Todo el proceso, claro y en un solo lugar.', 'Sin letra pequeña.'],
    text: 'Coste real a 4 años, plazos, documentos y cada oferta con su sello de confianza. Con menores, tú apruebas cada contacto.',
    cta: ['Empezar como familia', '/signup?role=parent'], alt: ['Calcular el coste real', '/calculadora'],
  },
  university: {
    tab: 'Soy universidad', Icon: Building2,
    title: ['Talento internacional comparable,', 'listo para evaluar.'],
    text: 'Perfiles con vídeo, notas, inglés y origen de cada dato. Publica becas, guarda búsquedas con alertas y gestiona tu pipeline.',
    cta: ['Crear cuenta de universidad', '/signup?role=university'], alt: ['Ver qué incluye', '/para/universidades'],
  },
  club: {
    tab: 'Soy club o academia', Icon: Star,
    title: ['Tu cantera, visible en EE. UU.', 'Y tú, con el control.'],
    text: 'Invita a tu roster con un enlace, confirma estadísticas como club y sigue las colocaciones de quien lo comparte. Gratis en el piloto.',
    cta: ['Registrar mi club', '/signup?role=coach'], alt: ['Ver el portal de clubes', '/para/coaches'],
  },
};

function Preview({ k }: { k: Key }) {
  if (k === 'athlete') {
    return (
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-premium)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brass to-brass-deep font-display text-xl font-bold text-ink">LM</span>
          <div><p className="font-display text-lg font-bold text-paper">Lucía M.</p><p className="text-xs text-muted">Baloncesto · Base · Promoción 2027</p></div>
          <span className="ml-auto rounded-full border border-trust/40 bg-trust/15 px-2.5 py-1 text-xs font-semibold text-ok">Verificado</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[['14,2', 'Puntos'], ['8,7', 'Nota media'], ['C1', 'Inglés']].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-line bg-ink/60 p-3"><p className="font-display text-lg font-bold text-paper">{v}</p><p className="text-xs text-faint">{l}</p></div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[['State University · NCAA D-I', 'Encaje alto', 'text-ok'], ['Lakeside College · NAIA', 'Encaje medio', 'text-brass']].map(([u, f, c]) => (
            <div key={u} className="flex items-center justify-between rounded-xl border border-line bg-ink/40 px-3 py-2.5 text-xs"><span className="text-paper">{u}</span><span className={c}>{f}</span></div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-brass/30 bg-brass/10 px-3 py-2.5 text-xs">
          <Eye className="h-4 w-4 text-brass" aria-hidden /><span className="text-paper">Una universidad verificada quiere contactar contigo</span>
        </div>
      </div>
    );
  }
  if (k === 'family') {
    return (
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-premium)] backdrop-blur-xl">
        <p className="text-[13px] font-semibold text-brass">Coste real a 4 años</p>
        <p className="mt-2 font-display text-4xl font-bold text-paper">42.800 $</p>
        <p className="text-xs text-faint">State University · beca del 70 %</p>
        <div className="mt-5 space-y-2.5 text-xs">
          {[['Matrícula y alojamiento', 82], ['Seguro médico', 9], ['Viajes', 6], ['Tasas (SEVIS, visado)', 3]].map(([l, v]) => (
            <div key={l as string}>
              <div className="mb-1 flex justify-between text-muted"><span>{l}</span><span className="tabular-nums text-paper">{v} %</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-brass to-brass-soft" style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-trust/30 bg-trust/10 px-3 py-2.5 text-xs text-paper"><Lock className="h-4 w-4 text-ok" aria-hidden />Tú apruebas cada contacto con tu hijo o hija</div>
      </div>
    );
  }
  if (k === 'university') {
    return (
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-premium)] backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 py-2.5 text-xs text-muted"><Search className="h-4 w-4" aria-hidden />Base · 2027 · inglés B2+ · nota 7+</div>
        <div className="mt-3 flex flex-wrap gap-1.5">{['Baloncesto', 'NCAA D-I', 'Con vídeo', 'Verificado'].map((t) => <span key={t} className="rounded-full border border-brass/30 bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">{t}</span>)}</div>
        <ul className="mt-4 space-y-2">
          {[['Lucía M.', 'Base · 1,78 m · 8,7', 92], ['Paula R.', 'Base · 1,74 m · 8,1', 87], ['Marta G.', 'Escolta · 1,80 m · 7,9', 81]].map(([n, d, s]) => (
            <li key={n as string} className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-paper">{(n as string).split(' ').map((w) => w[0]).join('')}</span>
              <span className="min-w-0 flex-1 text-xs"><span className="block font-medium text-paper">{n}</span><span className="text-faint">{d}</span></span>
              <span className="text-xs font-bold text-ok">{s}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint"><BadgeCheck className="h-3.5 w-3.5 text-brass" aria-hidden />Cada dato indica si es declarado, documentado o verificado</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-premium)] backdrop-blur-xl">
      <p className="text-[13px] font-semibold text-brass">Roster 2026-27</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[['24', 'Atletas'], ['11', 'Con candidaturas'], ['3', 'Colocados']].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-ink/60 p-3"><p className="font-display text-xl font-bold text-paper">{v}</p><p className="text-xs text-faint">{l}</p></div>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-xs">
        {[['Paula R. · Puntos por partido 16,4', 'Confirmar'], ['Marta G. · Rebotes 7,2', 'Confirmado']].map(([t, a]) => (
          <li key={t} className="flex items-center justify-between rounded-xl border border-line bg-ink/40 px-3 py-2.5"><span className="text-paper">{t}</span><span className={a === 'Confirmado' ? 'text-ok' : 'text-brass'}>{a}</span></li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-faint">Cada atleta decide si comparte su progreso con el club.</p>
    </div>
  );
}

/** Hero con selector de perfil: cada tipo de usuario ve su promesa, su vista previa y su botón. */
export function HeroAudience() {
  const [k, setK] = useState<Key>('athlete');
  const a = AUDIENCES[k];
  return (
    <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-20">
      <div className="max-w-3xl">
        <div role="tablist" aria-label="¿Quién eres?" className="animate-fade-in-up mb-7 inline-flex flex-wrap gap-1 rounded-2xl border border-white/15 bg-white/10 p-1 backdrop-blur-md">
          {(Object.keys(AUDIENCES) as Key[]).map((key) => {
            const { tab, Icon } = AUDIENCES[key];
            const on = key === k;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                aria-controls="hero-panel"
                onClick={() => setK(key)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${on ? 'bg-lime text-night' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> {tab}
              </button>
            );
          })}
        </div>
        <div id="hero-panel" role="tabpanel" key={k} className="space-y-6">
          <h1 className="animate-fade-in-up text-4xl font-bold leading-[1.05] font-display uppercase text-white md:text-6xl lg:text-[4rem]">
            {a.title[0]} <span className="text-lime">{a.title[1]}</span>
          </h1>
          <p className="animate-fade-in-up max-w-2xl text-base leading-relaxed text-lavender [animation-delay:80ms] md:text-lg">{a.text}</p>
          <div className="animate-fade-in-up flex flex-col items-start gap-3 [animation-delay:160ms] sm:flex-row">
            <Link href={a.cta[1]} className="btn-shine group inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-8 text-sm font-bold text-night transition-all hover:scale-[1.02] focus-visible:outline-lime active:scale-[0.97]">
              {a.cta[0]} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href={a.alt[1]} className="inline-flex h-12 items-center rounded-xl border border-white/30 px-8 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-white/10">{a.alt[0]}</Link>
          </div>
        </div>
        <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-lavender">
          <li className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" aria-hidden />Gratis para atletas</li>
          <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Precios publicados, sin llamadas comerciales</li>
          <li className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden />Menores protegidos por diseño</li>
        </ul>
      </div>
      <div className="relative hidden lg:block">
        <div key={k} className="animate-fade-in-up"><div className="animate-float"><Preview k={k} /></div></div>
        <p className="mt-4 text-center text-xs text-lavender">Ejemplo ilustrativo</p>
      </div>
    </div>
  );
}
