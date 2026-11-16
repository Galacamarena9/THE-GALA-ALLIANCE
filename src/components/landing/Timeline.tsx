'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const STAGES = [
  { key: 'eso', label: '3.º–4.º ESO', title: 'Construye la base', items: ['Graba partidos y empieza tu vídeo de highlights', 'Cuida las notas: cuentan desde ya', 'Empieza a preparar el inglés con calma'] },
  { key: 'b1', label: '1.º Bachillerato', title: 'Hazte visible', items: ['Crea y completa tu Passport', 'Haz tu shortlist de universidades reales', 'Presenta el examen de inglés (y el SAT si alguna lo pide)'] },
  { key: 'b2', label: '2.º Bachillerato', title: 'Decide', items: ['Recibe ofertas y compáralas con su coste real', 'Revisa el sello de confianza de cada una', 'Firma y pide el I-20 a la universidad'] },
  { key: 'summer', label: 'Verano', title: 'Prepara el viaje', items: ['Paga la tasa SEVIS y rellena el DS-160', 'Entrevista del visado F-1', 'Documentos médicos, seguro y vuelo'] },
];

/** Calendario interactivo por curso: qué hacer en cada momento. */
export function Timeline() {
  const [k, setK] = useState('b1');
  const i = STAGES.findIndex((s) => s.key === k);
  const s = STAGES[i];
  return (
    <div>
      <div className="relative mb-10">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-line" aria-hidden />
        <div className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-brass to-brass-soft transition-all duration-500" style={{ width: `${(i / (STAGES.length - 1)) * 100}%` }} aria-hidden />
        <ol aria-label="Etapas" className="relative grid grid-cols-4 gap-2">
          {STAGES.map((st, n) => (
            <li key={st.key} className="flex flex-col items-center">
              <button aria-pressed={st.key === k} aria-label={`Etapa ${n + 1}: ${st.label}`} onClick={() => setK(st.key)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${n <= i ? 'border-brass bg-brass text-ink shadow-[var(--shadow-gold)]' : 'border-line-strong bg-ink text-muted hover:border-brass/60'}`}>
                {n + 1}
              </button>
              <span className={`mt-2 text-center text-xs sm:text-xs ${st.key === k ? 'font-semibold text-paper' : 'text-muted'}`}>{st.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div key={k} className="animate-fade-in-up mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6">
        <p className="text-[13px] font-semibold text-brass">{s.label}</p>
        <h3 className="mt-1 text-xl font-bold text-paper">{s.title}</h3>
        <ul className="mt-4 space-y-2">{s.items.map((t) => <li key={t} className="flex items-start gap-2.5 text-sm text-muted"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{t}</li>)}</ul>
        <p className="mt-4 text-xs text-faint">Dentro de la plataforma, este calendario se calcula con tu año de graduación y te avisa de cada plazo.</p>
      </div>
    </div>
  );
}
