'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';

type Answers = { level?: number; grades?: number; english?: number; budget?: number };

const QUESTIONS: { key: keyof Answers; q: string; options: [string, number][] }[] = [
  { key: 'level', q: '¿A qué nivel compites?', options: [['Selección nacional o primera categoría', 3], ['Liga nacional o autonómica alta', 2], ['Liga autonómica o regional', 1], ['Local o escolar', 0]] },
  { key: 'grades', q: '¿Cuál es tu nota media?', options: [['8 o más', 3], ['Entre 7 y 8', 2], ['Entre 6 y 7', 1], ['Menos de 6', 0]] },
  { key: 'english', q: '¿Qué nivel de inglés tienes?', options: [['C1 o más', 3], ['B2', 2], ['B1', 1], ['A2 o menos', 0]] },
  { key: 'budget', q: '¿Cuánto podría aportar tu familia al año?', options: [['Más de 20.000 €', 3], ['Entre 10.000 y 20.000 €', 2], ['Entre 3.000 y 10.000 €', 1], ['Menos de 3.000 €', 0]] },
];

/** Recorrido de recruiting: de la identidad deportiva a la decisión. */
const STAGES = ['Identidad', 'Elegibilidad', 'Académico', 'Vídeo', 'Oportunidades', 'Contacto', 'Decisión'] as const;
type Stage = (typeof STAGES)[number];

/** Resultado orientativo y explicado (no es una evaluación profesional ni una promesa de beca). */
function result(a: Required<Answers>) {
  const fits: string[] = [];
  if (a.level >= 3) fits.push('NCAA División I y II');
  if (a.level === 2) fits.push('NCAA División II', 'NAIA');
  if (a.level <= 1) fits.push('NAIA', 'JUCO (NJCAA)');
  if (a.grades >= 2) fits.push('NCAA División III con ayudas académicas');
  const gaps: string[] = [];
  if (a.english <= 1) gaps.push('Subir tu inglés: la mayoría de universidades piden un examen oficial para la admisión.');
  if (a.grades <= 1) gaps.push('Cuidar la nota: abre becas académicas y más universidades.');
  if (a.level <= 1) gaps.push('Un buen vídeo de highlights pesa mucho: es lo primero que mira un coach.');
  if (a.budget <= 1) gaps.push('Prioriza ofertas con ayuda alta y compara el coste real de cada una.');
  // Etapas del roadmap que tus respuestas señalan como prioritarias (no "en qué etapa estás": eso lo sabrá tu Passport).
  const priority = new Set<Stage>();
  if (a.english <= 1 || a.grades <= 1) priority.add('Académico');
  if (a.level <= 1) priority.add('Vídeo');
  if (a.budget <= 1) priority.add('Oportunidades');
  const score = a.level * 3 + a.grades * 2 + a.english * 2 + a.budget;
  const headline = score >= 18 ? 'Tienes un perfil muy competitivo' : score >= 11 ? 'Tienes opciones reales' : 'Hay camino, con un plan';
  return { headline, priority, fits: [...new Set(fits)], gaps: gaps.length ? gaps : ['Completa tu Passport con vídeo y datos: tu perfil ya es sólido.'] };
}

export function OptionsQuiz() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({});
  const done = step >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const r = done ? result(a as Required<Answers>) : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-brass/25 bg-surface p-6 shadow-[var(--shadow-premium)] sm:p-8">
      <div className="glow-gold pointer-events-none absolute -right-24 -top-24 h-72 w-72" aria-hidden />
      <div className="relative mb-6 flex items-center gap-3">
        {QUESTIONS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < step || done ? 'bg-brass' : i === step ? 'bg-brass/50' : 'bg-line'}`} />
        ))}
      </div>

      {!done ? (
        <div key={step} className="animate-fade-in-up relative">
          <p className="text-[13px] font-semibold text-brass">Pregunta {step + 1} de {QUESTIONS.length}</p>
          <h3 className="mt-2 text-xl font-bold text-paper sm:text-2xl">{q.q}</h3>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {q.options.map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => { setA((prev) => ({ ...prev, [q.key]: v })); setStep((s) => s + 1); }}
                className={`rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brass/60 hover:bg-brass/5 ${a[q.key] === v ? 'border-brass bg-brass/10 text-paper' : 'border-line bg-ink/40 text-paper'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="mt-5 inline-flex items-center gap-1.5 text-xs text-faint hover:text-paper"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Atrás</button>
          )}
        </div>
      ) : r && (
        <div className="animate-fade-in-up relative" aria-live="polite">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok"><Sparkles className="h-3.5 w-3.5" aria-hidden />Tu resultado</p>
          <h3 className="mt-2 text-2xl font-bold text-paper sm:text-3xl">{r.headline}</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-ink/40 p-4">
              <p className="mb-2 text-xs font-semibold text-paper">Dónde encajarías</p>
              <ul className="space-y-1.5">{r.fits.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-muted"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />{f}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-line bg-ink/40 p-4">
              <p className="mb-2 text-xs font-semibold text-paper">Qué te haría subir de nivel</p>
              <ul className="space-y-1.5">{r.gaps.map((g) => <li key={g} className="flex items-start gap-2 text-sm text-muted"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden />{g}</li>)}</ul>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-ink/40 p-4">
            <p className="mb-3 text-xs font-semibold text-paper">Tu roadmap de recruiting</p>
            <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas del recorrido" tabIndex={0}>
              {STAGES.map((st, i) => {
                const prio = r.priority.has(st);
                return (
                  <li key={st} className="min-w-[4.75rem] flex-1" aria-current={i === 0 ? 'step' : undefined}>
                    <span className={`block h-1.5 rounded-full ${i === 0 ? 'bg-brass' : prio ? 'bg-warn' : 'bg-line-strong'}`} aria-hidden />
                    <span className={`mt-1.5 block text-xs ${i === 0 ? 'font-semibold text-brass' : 'text-muted'}`}>{st}</span>
                    {i === 0 && <span className="block text-[11px] text-faint">Estás aquí</span>}
                    {prio && <span className="block text-[11px] font-semibold text-warn">Prioridad</span>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-faint">Todo el mundo empieza en Identidad: tu Passport. Las etapas marcadas como prioridad salen de tus respuestas.</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup?role=athlete" className="btn-shine group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brass px-7 text-sm font-bold text-ink shadow-[var(--shadow-gold)] transition-all hover:scale-[1.02]">
              Guardar mi roadmap en un Passport <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <button type="button" onClick={() => { setStep(0); setA({}); }} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-paper"><RotateCcw className="h-4 w-4" aria-hidden />Repetir</button>
          </div>
          <p className="mt-4 text-xs text-faint">Resultado orientativo, no una evaluación profesional ni una promesa de beca. La NCAA División III no da becas deportivas, pero sí ayudas académicas.</p>
        </div>
      )}
    </div>
  );
}
