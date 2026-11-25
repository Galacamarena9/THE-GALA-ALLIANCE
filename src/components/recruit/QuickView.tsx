'use client';

import { useT, useLocale } from '@/lib/i18n/client';
import { formatHeight } from '@/lib/i18n/format';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadQuickView, type QuickView as QV } from '@/app/actions/recruit';
import { MediaSwitcher } from './MediaSwitcher';
import { AddToShortlist } from './RecruitForms';
import { ScoutSheets } from './ScoutSheets';
import type { NeedFit } from '@/lib/domain/recruit';

export type QVRow = {
  user_id: string; display_name: string; avatar_url: string | null; meta: string; height_cm: number | null;
  has_video: boolean; verified_stats: number | null; fit: NeedFit | null;
};
type Ctx = { open: (i: number) => void };
const QVContext = createContext<Ctx | null>(null);
const CONF = { high: 'Confianza alta', medium: 'Confianza media', low: 'Confianza baja' } as const;

/**
 * Vista rápida para responder «¿sigo revisando a este atleta?» sin salir de la búsqueda:
 * vídeo a un toque, 3–5 datos, encaje explicado y «+ Shortlist». Anterior/siguiente con botones (sin gestos obligatorios,
 * sin decisiones sí/no). Al cerrar, la búsqueda y el scroll siguen donde estaban.
 */
export function QuickViewProvider({ rows, org, lists, members = [], children }: { rows: QVRow[]; org: string; lists: { id: string; name: string }[]; members?: { id: string; name: string }[]; children: ReactNode }) {
  const tx = useT();
  const locale = useLocale();
  const [index, setIndex] = useState<number | null>(null);
  const [data, setData] = useState<Record<string, QV>>({});
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const row = index != null ? rows[index] : null;

  const fetchOne = useCallback(async (id: string) => {
    setLoading(true);
    try { const r = await loadQuickView({ org, athlete: id }); setData((d) => ({ ...d, [id]: r })); }
    catch { setData((d) => ({ ...d, [id]: { ok: false, message: tx('No se ha podido cargar. Toca para reintentar.') } })); }
    finally { setLoading(false); }
  }, [org, tx]);

  const open = (i: number) => { setIndex(i); const id = rows[i]?.user_id; if (id && !data[id]?.ok) void fetchOne(id); };
  useEffect(() => {
    if (index == null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIndex(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [index]);

  const d = row ? data[row.user_id] : undefined;
  return (
    <QVContext.Provider value={{ open }}>
      {children}
      {row && index != null && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={tx(`Vista rápida: ${row.display_name}`)}>
          <button className="absolute inset-0 bg-black/60" aria-label={tx('Cerrar vista rápida')} onClick={() => setIndex(null)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-line bg-ink p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[440px] sm:rounded-3xl sm:border">
            <div className="mb-3 flex items-center gap-3">
              {row.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={row.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                : <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brass/15 font-display text-xl font-bold text-brass" aria-hidden>{row.display_name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold uppercase text-paper">{row.display_name}</p>
                <p className="text-xs text-muted">{row.meta || tx('Datos deportivos no compartidos')}</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setIndex(null)} className="grid h-11 w-11 place-items-center rounded-full border border-line" aria-label={tx('Cerrar')}><X className="h-5 w-5" aria-hidden /></button>
            </div>

            {d && !d.ok ? (
              <button type="button" onClick={() => fetchOne(row.user_id)} className="w-full rounded-xl border border-danger/40 p-3 text-sm text-danger">{tx(d.message)}</button>
            ) : (
              <>
                {d?.ok && d.minor && <p className="mb-3 rounded-xl border border-brass/40 bg-brass/5 p-2 text-xs text-paper">{tx('🛡️ Protecciones de menor activas: el contacto pasa por Gala y su familia.')}</p>}
                {/* Vídeo primero: a un toque. No se reproduce solo ni se descarga hasta que el coach pulsa. */}
                {loading && !d ? <div className="aspect-video w-full animate-pulse rounded-2xl bg-surface" aria-label={tx('Cargando')} />
                  : d?.ok && d.videos.length ? <MediaSwitcher videos={d.videos} athlete={row.display_name} />
                  : <p className="rounded-xl border border-line p-3 text-sm text-muted">{row.has_video ? tx('🔒 Vídeo no compartido contigo') : tx('Sin vídeo en el Passport')}</p>}

                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {row.height_cm && <div className="rounded-xl bg-surface p-2"><dt className="text-[11px] text-faint">{tx('Altura')}</dt><dd className="font-semibold text-paper">{formatHeight(row.height_cm, locale)}</dd></div>}
                  {d?.ok && d.stats.slice(0, 4).map((s) => (
                    <div key={s.label} className="rounded-xl bg-surface p-2"><dt className="truncate text-[11px] text-faint">{tx(s.label)}</dt><dd className="font-semibold text-paper">{s.value} {s.verified ? <span className="text-ok" title={tx('Verificada')}>✓</span> : <span className="text-[10px] font-normal text-muted">{tx('declarada')}</span>}</dd></div>
                  ))}
                  {d?.ok && <div className="rounded-xl bg-surface p-2"><dt className="text-[11px] text-faint">{tx('Académico')}</dt><dd className="font-semibold text-paper">{d.academics === 'documented' ? 'Documentado ✓' : d.academics === 'declared' ? tx('Declarado') : '🔒 Privado'}</dd></div>}
                </dl>

                {row.fit && (
                  <details className="mt-3 rounded-xl border border-line p-3 text-sm">
                    <summary className="flex cursor-pointer items-center justify-between">
                      <span className="font-semibold text-paper">{row.fit.blocked ? tx('No cumple un requisito') : row.fit.score != null ? `${row.fit.score}% encaje` : tx('Encaje sin datos suficientes')}</span>
                      <span className="text-xs text-brass">{tx('¿Por qué?')}</span>
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {row.fit.met.map((x) => <li key={x.key} className="text-ok">✓ {tx(x.label)}</li>)}
                      {row.fit.unmet.map((x) => <li key={x.key} className="text-danger">✕ {tx(x.label)}</li>)}
                      {row.fit.missing.map((x) => <li key={x.key} className="text-warn">⚠ {tx(x.label)}: {tx('no disponible')}</li>)}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted">{tx(CONF[row.fit.confidence])}. {tx('Compatibilidad con tus criterios, no valoración del talento.')}</p>
                  </details>
                )}
              </>
            )}

            {d?.ok && <ScoutSheets key={row.user_id} org={org} athlete={row.user_id} members={members} />}

            {/* Acciones frecuentes abajo, al alcance del pulgar. */}
            <div className="sticky bottom-0 mt-4 flex items-center gap-2 bg-ink pt-2">
              <button type="button" disabled={index === 0} onClick={() => open(index - 1)} className="grid h-12 w-12 place-items-center rounded-full border border-line disabled:opacity-40" aria-label={tx('Atleta anterior')}><ChevronLeft className="h-5 w-5" aria-hidden /></button>
              <Link href={`/app/recruit/candidates/${row.user_id}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-line px-3 text-sm font-semibold text-paper">{tx('Ver Passport')}</Link>
              <AddToShortlist athlete={row.user_id} lists={lists} fit={row.fit?.score ?? null} />
              <button type="button" disabled={index === rows.length - 1} onClick={() => open(index + 1)} className="grid h-12 w-12 place-items-center rounded-full border border-line disabled:opacity-40" aria-label={tx('Atleta siguiente')}><ChevronRight className="h-5 w-5" aria-hidden /></button>
            </div>
            <p className="mt-1 text-center text-[11px] text-faint">{index + 1} de {rows.length}</p>
          </div>
        </div>
      )}
    </QVContext.Provider>
  );
}

export function QuickViewButton({ index, label }: { index: number; label: string }) {
  const tx = useT();
  const ctx = useContext(QVContext);
  if (!ctx) return null;
  return <button type="button" onClick={() => ctx.open(index)} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass" aria-label={tx(`Vista rápida de ${label}`)}>{tx('Vista rápida')}</button>;
}

/** Recuerda la posición de scroll de la búsqueda (por URL) para volver exactamente al mismo sitio. */
export function ScrollMemory({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const key = `gala:scroll:${storageKey}`;
    try {
      const y = Number(sessionStorage.getItem(key));
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch { /* almacenamiento no disponible */ }
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(t); t = setTimeout(() => { try { sessionStorage.setItem(key, String(window.scrollY)); } catch { /* */ } }, 150); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, [storageKey]);
  return null;
}
