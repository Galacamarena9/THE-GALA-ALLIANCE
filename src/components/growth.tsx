'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Button, inputClass } from '@/components/ui';
import { postAthleteUpdate, requestPlan, saveAcademyAttempt, saveSearch, sendFeedback } from '@/app/actions/growth';
import type { Question } from '@/content/academy';

export function SaveSearchForm({ filters }: { filters: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  if (!Object.keys(filters).length) return null;
  if (!open) {
    return <Button variant="secondary" type="button" onClick={() => setOpen(true)}>Guardar búsqueda y recibir alertas</Button>;
  }
  return (
    <ActionForm action={saveSearch} className="flex flex-wrap items-center gap-2">
      {() => (
        <>
          {Object.entries(filters).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="label" required minLength={2} maxLength={80} placeholder="Nombre, p. ej. Bases 2027 con vídeo" aria-label="Nombre de la búsqueda" className={`${inputClass} w-72`} />
          <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function AthleteUpdateForm() {
  return (
    <ActionForm action={postAthleteUpdate} className="grid gap-3">
      {() => (
        <>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <select name="kind" aria-label="Tipo de novedad" className={inputClass} defaultValue="result">
              <option value="result">Resultado</option>
              <option value="stat">Estadística</option>
              <option value="video">Vídeo nuevo</option>
              <option value="academic">Académico</option>
              <option value="availability">Disponibilidad</option>
              <option value="other">Otra</option>
            </select>
            <input name="link_url" type="url" placeholder="Enlace opcional (https://…)" aria-label="Enlace" className={inputClass} />
          </div>
          <textarea name="body" required minLength={3} maxLength={280} rows={2} placeholder="Ej.: 24 puntos y 8 rebotes en la final autonómica" aria-label="Novedad" className={inputClass} />
          <div><SubmitButton pendingText="Publicando…">Publicar novedad</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function PlanRequestForm({ planCode, organizations = [] }: { planCode: string; organizations?: { id: string; name: string }[] }) {
  return (
    <ActionForm action={requestPlan} className="grid gap-2">
      {() => (
        <>
          <input type="hidden" name="plan_code" value={planCode} />
          {organizations.length > 0 && (
            <select name="organization_id" aria-label="Organización" className={inputClass} defaultValue={organizations[0].id}>
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <textarea name="message" rows={2} maxLength={1000} placeholder="Cuéntanos tu caso (opcional)" aria-label="Mensaje" className={inputClass} />
          <SubmitButton pendingText="Enviando…">Solicitar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function FeedbackForm({ page }: { page: string }) {
  return (
    <ActionForm action={sendFeedback} className="grid gap-2">
      {() => (
        <>
          <input type="hidden" name="page" value={page} />
          <textarea name="message" required minLength={3} maxLength={2000} rows={3} placeholder="¿Qué te falta o qué no funciona?" aria-label="Comentario" className={inputClass} />
          <div className="flex items-center gap-2">
            <select name="rating" aria-label="Valoración" className={`${inputClass} w-40`} defaultValue="">
              <option value="">Valoración</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
            </select>
            <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Barajado determinista (misma semilla en servidor y cliente: sin desajustes de hidratación). */
function shuffle<T>(items: T[], seed: number) {
  const a = [...items];
  let x = seed % 2147483647 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Práctica SAT/TOEFL. Versión corregida del motor de Lovable:
 * sin XP ni combos, temporizador opcional con el ritmo real del SAT y resultado guardado al terminar.
 */
export function PracticeEngine({ exam, questions, seed }: { exam: 'sat' | 'toefl'; questions: Question[]; seed: number }) {
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<Question[]>(() => shuffle(questions, seed).slice(0, 10));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timed, setTimed] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [saved, setSaved] = useState<'idle' | 'ok' | 'error'>('idle');
  const started = useRef(0);

  useEffect(() => {
    started.current = Date.now();
  }, [round]);

  // Reloj del modo cronometrado: solo actualiza estado dentro del intervalo.
  useEffect(() => {
    if (!deadline || picked !== null || finished) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline, picked, finished]);

  const q = order[idx];
  if (!q) return null;

  const left = deadline && now ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const shown = picked ?? (left === 0 ? -1 : null);
  const deadlineFor = (question: Question | undefined, on: boolean) =>
    on && question?.paceSeconds ? Date.now() + question.paceSeconds * 1000 : null;

  const choose = (i: number) => {
    if (shown !== null) return;
    setPicked(i);
    if (i === q.answer) setCorrect((c) => c + 1);
  };

  const toggleTimed = (on: boolean) => {
    setTimed(on);
    setNow(Date.now());
    setDeadline(shown === null ? deadlineFor(q, on) : null);
  };

  const next = async () => {
    if (idx < order.length - 1) {
      setIdx(idx + 1);
      setPicked(null);
      setNow(Date.now());
      setDeadline(deadlineFor(order[idx + 1], timed));
      return;
    }
    setFinished(true);
    const res = await saveAcademyAttempt({
      exam, correct, total: order.length, durationSeconds: Math.round((Date.now() - started.current) / 1000),
    });
    setSaved(res.ok ? 'ok' : 'error');
  };

  const restart = () => {
    const nextRound = round + 1;
    const fresh = shuffle(questions, seed + nextRound * 7919).slice(0, 10);
    setRound(nextRound);
    setOrder(fresh);
    setIdx(0); setPicked(null); setCorrect(0); setFinished(false); setSaved('idle');
    setNow(Date.now());
    setDeadline(deadlineFor(fresh[0], timed));
  };

  if (finished) {
    const pct = Math.round((correct / order.length) * 100);
    return (
      <div className="rounded-[var(--radius-card)] border border-brass/40 bg-surface p-6 text-center">
        <p className="font-display text-4xl text-brass">{correct}/{order.length}</p>
        <p className="mt-1 text-sm text-muted">Aciertos: {pct} %. {pct >= 80 ? 'Muy bien: sube la dificultad con un examen oficial en Bluebook o ETS.' : 'Repasa los conceptos de los temas en los que has fallado.'}</p>
        <p className="mt-2 text-xs text-faint" role="status">{saved === 'ok' ? 'Resultado guardado en tu progreso.' : saved === 'error' ? 'No se ha podido guardar el resultado.' : 'Guardando…'}</p>
        <Button className="mt-4" type="button" onClick={restart}>Otra ronda</Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="font-mono">{idx + 1}/{order.length}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-brass transition-all" style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
        </div>
        <span>{correct} aciertos</span>
        {exam === 'sat' && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={timed} onChange={(e) => toggleTimed(e.target.checked)} className="accent-[var(--color-brass)]" />
            Ritmo real
          </label>
        )}
        {timed && left !== null && shown === null && <span className={left <= 10 ? 'font-semibold text-danger' : ''} aria-live="polite">{left} s</span>}
      </div>
      <p className="text-[15px] leading-relaxed text-paper">{q.prompt}</p>
      <div className="mt-4 grid gap-2">
        {q.options.map((opt, i) => {
          const state = shown === null ? 'idle' : i === q.answer ? 'right' : i === shown ? 'wrong' : 'idle';
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={shown !== null}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                state === 'right' ? 'border-ok/60 bg-ok/10' : state === 'wrong' ? 'border-danger/60 bg-danger/10' : 'border-line hover:border-brass/50'
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-[11px]">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {shown !== null && (
        <div className="mt-4 rounded-lg border border-brass/30 bg-brass/5 p-3 text-sm">
          <p className="font-medium text-brass">{shown === q.answer ? 'Correcto' : shown === -1 ? 'Tiempo agotado' : 'No es esa'}</p>
          <p className="mt-1 text-muted">{q.explanation}</p>
          <Button className="mt-3" type="button" onClick={next}>{idx < order.length - 1 ? 'Siguiente' : 'Terminar'}</Button>
        </div>
      )}
    </div>
  );
}

type ThemeMode = 'dark' | 'light' | 'contrast';
const THEME_KEY = 'tga_theme';

function subscribeTheme(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}
const readTheme = (): ThemeMode => {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'contrast' ? t : 'dark';
};

/** Tema claro/oscuro/alto contraste (recuperado de Lovable). Preferencia de interfaz pedida por el usuario: sin consentimiento de cookies. */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark' as ThemeMode);
  const apply = (m: ThemeMode) => {
    if (m === 'dark') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = m;
    try { localStorage.setItem(THEME_KEY, m); } catch { /* sin persistencia */ }
  };
  const labels: Record<ThemeMode, string> = { dark: 'Oscuro', light: 'Claro', contrast: 'Alto contraste' };
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="sr-only">Tema</span>
      <select value={mode} onChange={(e) => apply(e.target.value as ThemeMode)} className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-paper" aria-label="Tema de color">
        {(Object.keys(labels) as ThemeMode[]).map((m) => <option key={m} value={m}>{labels[m]}</option>)}
      </select>
    </label>
  );
}
