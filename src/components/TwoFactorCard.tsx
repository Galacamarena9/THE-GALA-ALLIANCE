'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { Notice, inputClass } from '@/components/ui';

type Factor = { id: string; friendly_name?: string; created_at: string };

/** Activar o quitar la verificación en dos pasos con una app de autenticación (TOTP). */
export function TwoFactorCard({ required }: { required: boolean }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function fetchVerified(): Promise<Factor[]> {
    const { data } = await createBrowserSupabase().auth.mfa.listFactors();
    return (data?.totp ?? []).filter((f) => f.status === 'verified');
  }
  async function load() { setFactors(await fetchVerified()); }
  useEffect(() => {
    let alive = true;
    fetchVerified().then((f) => { if (alive) setFactors(f); });
    return () => { alive = false; };
  }, []);

  async function start() {
    setMsg(null); setBusy(true);
    const supabase = createBrowserSupabase();
    // Limpia intentos a medias para que el alta no falle por un nombre repetido.
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `App de autenticación ${new Date().toLocaleDateString('es-ES')}` });
    setBusy(false);
    if (error || !data) { setMsg({ tone: 'danger', text: 'No se ha podido empezar. Inténtalo de nuevo.' }); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) { setMsg({ tone: 'danger', text: 'Código incorrecto. Espera al siguiente código y vuelve a probar.' }); return; }
    setEnroll(null); setCode('');
    setMsg({ tone: 'ok', text: 'Listo: a partir de ahora te pediremos el código al iniciar sesión.' });
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) { setMsg({ tone: 'danger', text: 'Para quitarla, cierra sesión, vuelve a entrar con tu código y repite.' }); return; }
    setMsg({ tone: 'ok', text: 'Verificación en dos pasos desactivada.' });
    await load();
  }

  return (
    <div id="doble-factor" className="space-y-4">
      {required && !factors?.length && <Notice tone="danger">Las cuentas de administración deben activar la verificación en dos pasos para entrar al panel.</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {factors === null ? <div className="skeleton h-12 rounded-xl" /> : factors.length ? (
        <ul className="divide-y divide-line">
          {factors.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <ShieldCheck className="h-5 w-5 text-ok" aria-hidden />
              <span className="font-medium text-paper">Activada</span>
              <span className="text-xs text-faint">{f.friendly_name}</span>
              <button type="button" disabled={busy} onClick={() => remove(f.id)} className="ml-auto text-xs text-muted hover:text-danger">Desactivar</button>
            </li>
          ))}
        </ul>
      ) : enroll ? (
        <form onSubmit={confirm} className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR en SVG generado por Supabase (data URL) */}
          <img src={enroll.qr} alt="Código QR para tu app de autenticación" className="h-44 w-44 rounded-xl bg-white p-2" />
          <div className="space-y-3 text-sm">
            <p className="text-muted">1. Escanea el código con tu app de autenticación (Google Authenticator, 1Password, Authy…).</p>
            <p className="text-muted">¿No puedes escanear? Escribe esta clave: <code className="break-all rounded bg-surface-2 px-1.5 py-0.5 text-xs text-paper">{enroll.secret}</code></p>
            <label className="block text-muted" htmlFor="totp">2. Escribe el código de 6 cifras que te muestra</label>
            <input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} max-w-[200px] text-center text-lg tracking-[0.3em]`} />
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">Activar</button>
              <button type="button" onClick={() => setEnroll(null)} className="rounded-lg border border-line-strong px-4 py-2 text-sm text-paper">Cancelar</button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">Añade un código de tu móvil al iniciar sesión: aunque alguien sepa tu contraseña, no podrá entrar.</p>
          <button type="button" disabled={busy} onClick={start} className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">Activar verificación en dos pasos</button>
        </div>
      )}
    </div>
  );
}
