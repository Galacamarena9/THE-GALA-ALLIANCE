'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { listPrograms, searchInstitutions, submitVerification, type OrgHit, type SubmitResult } from '@/app/actions/verification';
import { Button, Field, inputClass } from '@/components/ui';

const STEPS = ['Quién eres', 'Tu institución', 'Tu programa', 'Correo institucional', 'Listo'] as const;
const ROLES = ['Head Coach', 'Assistant Coach', 'Recruiting Coordinator', 'Athletic Director', 'Sporting Director', 'Admissions', 'Compliance', 'Scout', 'Otro'];

/**
 * Verificación desde el móvil, paso a paso. Nada se guarda hasta el final (una sola operación en el servidor).
 * El CTA principal de cada paso va abajo, al alcance del pulgar.
 */
export function VerifyWizard({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [step, setStep] = useState(0);
  const [who, setWho] = useState({ first_name: firstName, last_name: lastName, title: '' });
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<OrgHit[] | null>(null);
  const [target, setTarget] = useState<OrgHit | null>(null);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [program, setProgram] = useState('');
  const [role, setRole] = useState(ROLES[1]);
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, start] = useTransition();

  // Búsqueda con espera corta (no una petición por tecla).
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await searchInstitutions(q))), 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (h: OrgHit) => {
    setTarget(h); setProgram(''); setPrograms([]);
    if (h.kind === 'organization') start(async () => setPrograms(await listPrograms(h.id)));
    setStep(2);
  };
  const submit = () => start(async () => {
    const r = await submitVerification({ ...who, kind: target!.kind, target: target!.id, program, role, email });
    setResult(r);
    if (r.ok) setStep(4);
  });

  const canNext = [who.first_name.trim() && who.last_name.trim() && who.title.trim().length >= 2, !!target, !!role, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email), true][step];

  return (
    <div className="flex min-h-[70vh] flex-col">
      <ol className="mb-5 flex gap-1" aria-label="Pasos">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brass' : 'bg-line'}`}><span className="sr-only">{s}</span></li>)}
      </ol>
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">Paso {step + 1} de {STEPS.length}</p>
      <h2 className="mb-4 font-display text-2xl font-bold text-paper">{STEPS[step]}</h2>

      <div className="flex-1 space-y-4">
        {step === 0 && <>
          <Field label="Nombre" htmlFor="v_fn"><input id="v_fn" autoComplete="given-name" value={who.first_name} onChange={(e) => setWho({ ...who, first_name: e.target.value })} className={inputClass} /></Field>
          <Field label="Apellidos" htmlFor="v_ln"><input id="v_ln" autoComplete="family-name" value={who.last_name} onChange={(e) => setWho({ ...who, last_name: e.target.value })} className={inputClass} /></Field>
          <Field label="Cargo" htmlFor="v_t" hint="Tal como aparece en la web oficial del programa"><input id="v_t" value={who.title} onChange={(e) => setWho({ ...who, title: e.target.value })} placeholder="Assistant Coach" className={inputClass} /></Field>
        </>}

        {step === 1 && <>
          <Field label="Busca tu universidad o club" htmlFor="v_q"><input id="v_q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="University of…" className={inputClass} autoFocus /></Field>
          {pending && <p className="text-sm text-muted" role="status">Buscando…</p>}
          {hits && (hits.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {hits.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button type="button" onClick={() => pick(h)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <span><span className="block font-semibold text-paper">{h.name}</span><span className="text-xs text-muted">{h.place || '—'}{h.verified ? ' · Organización verificada ✓' : h.kind === 'institution' ? ' · Aún sin equipo en Gala' : ''}</span></span>
                    <span className="text-sm font-semibold text-brass">Elegir</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No la encontramos. Revisa el nombre oficial o <Link href="/app/organization" className="text-brass underline">crea la organización</Link> (quedará pendiente de verificar).</p>)}
        </>}

        {step === 2 && target && <>
          <p className="rounded-xl border border-line p-3 text-sm text-paper">{target.name}<span className="block text-xs text-muted">{target.place}</span></p>
          {programs.length > 0 ? (
            <Field label="Programa" htmlFor="v_p" hint="Tendrás acceso solo a este programa">
              <select id="v_p" value={program} onChange={(e) => setProgram(e.target.value)} className={inputClass}>
                <option value="">Toda la organización (lo decide el revisor)</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          ) : <p className="text-sm text-muted">{target.kind === 'institution' ? 'Esta universidad aún no tiene equipo en Gala: tu solicitud será la primera y la revisaremos con más detalle.' : 'Esta organización aún no tiene programas; el revisor confirmará el tuyo.'}</p>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-paper">Tu rol</legend>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <label key={r} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${role === r ? 'border-brass bg-brass/10 text-brass' : 'border-line text-paper'}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />{r}
                </label>
              ))}
            </div>
          </fieldset>
        </>}

        {step === 3 && <>
          <Field label="Correo institucional" htmlFor="v_e" hint="El de tu universidad o club (p. ej. coach@university.edu). Te enviaremos un enlace.">
            <input id="v_e" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@university.edu" className={inputClass} />
          </Field>
          <p className="text-xs text-muted">Confirmar el correo no te convierte en coach verificado: además revisamos tu afiliación, tu programa y tu cargo.</p>
          {result && !result.ok && <p role="alert" className="text-sm text-danger">{result.message}</p>}
        </>}

        {step === 4 && result && (
          <div className="space-y-3" role="status">
            <p className="text-lg font-semibold text-paper">✓ Solicitud enviada</p>
            <p className="text-sm text-muted">{result.message}</p>
            <p className="text-sm text-muted">Mientras revisamos, ya puedes completar el perfil de tu organización, tus programas y tus preferencias de recruiting.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-6 flex gap-3 bg-ink/95 py-3 lg:bottom-0">
        {step > 0 && step < 4 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} className="min-h-12">Atrás</Button>}
        {step < 3 && step !== 1 && <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="min-h-12 flex-1">Continuar</Button>}
        {step === 3 && <Button type="button" disabled={!canNext || pending} onClick={submit} className="min-h-12 flex-1">{pending ? 'Enviando…' : 'Enviar enlace de verificación'}</Button>}
        {step === 4 && <Link href="/app/verify" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold text-ink">Ver mi estado de verificación</Link>}
      </div>
    </div>
  );
}
