'use client';

import { useState } from 'react';

/** Copiar o compartir el enlace de invitación (Web Share en móvil). */
export function ShareInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = 'Te invito a The Gala Alliance: la red donde atletas, familias y organizaciones verificadas se encuentran.';
    if (navigator.share) { try { await navigator.share({ title: 'The Gala Alliance', text, url }); return; } catch { /* cancelado */ } }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={url} aria-label="Tu enlace de invitación" className="min-h-11 flex-1 rounded-xl border border-line bg-ink px-3 text-sm text-paper" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={share} className="min-h-11 rounded-xl bg-brass px-5 text-sm font-semibold text-ink">{copied ? '¡Copiado!' : 'Compartir'}</button>
    </div>
  );
}
