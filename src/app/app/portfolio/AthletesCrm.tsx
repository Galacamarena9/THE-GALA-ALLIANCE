'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MoreHorizontal, RotateCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { EmptyState, Notice, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';
import { AthleteAvatar } from '@/components/portfolio';
import {
  CRM_REP_LABEL, CRM_SORT_LABEL, CRM_VIEWS, DEFAULT_CRM, applyCrm, crmOptions, crmQuery, viewCounts,
  type CrmFilters, type CrmRep, type CrmRow, type CrmSort,
} from '@/lib/domain/athletes-crm';
import { dueText } from '@/lib/domain/agent-home';

const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');
const today = () => new Date().toISOString().slice(0, 10);
const rel = (iso: string | null) => {
  if (!iso) return '—';
  const n = Math.round((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 864e5);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : n < 30 ? `hace ${n} días` : new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * «Mis atletas»: filtros, búsqueda, orden y página viven en la URL (compartible y estable), pero se aplican en
 * memoria sobre la proyección que ya envió el servidor: el resultado aparece al teclear, sin ir y volver al servidor.
 */
export function AthletesCrm({ rows, initial, agency, partial = [], importPanel = null }: { rows: CrmRow[]; initial: CrmFilters; agency: { name: string; verified: boolean } | null; partial?: string[]; importPanel?: React.ReactNode }) {
  const [f, setF] = useState<CrmFilters>(initial);
  const set = (patch: Partial<CrmFilters>) => setF((cur) => ({ ...cur, ...patch, page: 'page' in patch ? patch.page! : 1 }));
  const result = useMemo(() => applyCrm(rows, f), [rows, f]);
  const counts = useMemo(() => viewCounts(rows, f), [rows, f]);
  const opts = useMemo(() => crmOptions(rows), [rows]);
  const extra = [f.sport, f.grad, f.country, f.rep !== 'active' ? f.rep : null].filter(Boolean).length;

  // URL estable: se reescribe sin recargar (history.replaceState mantiene useSearchParams sincronizado en Next).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => window.history.replaceState(null, '', `/app/portfolio${crmQuery(f, { page: f.page })}`), 150);
    return () => clearTimeout(t);
  }, [f]);

  const sortBy = (s: CrmSort) => set({ sort: s, dir: f.sort === s && f.dir === 'asc' ? 'desc' : 'asc' });

  return (
    <>
      <PageHeader
        kicker={agency?.name ?? 'Agencia'}
        title="Mis atletas"
        description="Dónde está cada atleta, qué toca ahora y cuándo. Solo ves a quien ha aceptado tu representación, y lo que te permite ver."
        action={<Link href="/app/discover" className={buttonClass('secondary')}><Search className="h-4 w-4" aria-hidden /> Buscar talento</Link>}
      />
      <div className="space-y-4">
        {agency && !agency.verified && <Notice>Tu agencia está pendiente de verificación. Mientras tanto puedes importar tu cartera e invitar a tus atletas; podrás enviarles propuestas en cuanto Gala la verifique.</Notice>}
        {importPanel}
        {partial.length > 0 && <Notice tone="warn">No hemos podido cargar {partial.join(', ')}: algunos recuentos pueden estar incompletos.</Notice>}

        {!rows.length ? (
          <EmptyState title="Tu cartera está vacía" action={<Link href="/app/discover" className={buttonClass('primary')}><Search className="h-4 w-4" aria-hidden /> Buscar talento</Link>}>
            Importa arriba tu cartera actual o busca atletas por deporte, posición y nivel. Aparecerán aquí en cuanto acepten tu propuesta.
          </EmptyState>
        ) : (
          <section aria-label="Mis atletas" className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            <nav aria-label="Vistas" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
              {CRM_VIEWS.map((v) => {
                const on = f.view === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => set({ view: v.id })}
                    aria-pressed={on}
                    className={cx('relative flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brass', on ? 'font-semibold text-paper' : 'text-muted hover:text-paper')}
                  >
                    {v.label}
                    <span className={cx('rounded-full px-1.5 text-xs tabular-nums', on ? 'bg-brass text-ink' : 'bg-surface-2 text-muted', v.id === 'attention' && counts.attention > 0 && !on && 'bg-danger/10 text-danger')}>{counts[v.id]}</span>
                    {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brass" aria-hidden />}
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <label className="relative min-w-[220px] flex-1">
                <span className="sr-only">Buscar atleta</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Nombre, deporte, posición o siguiente acción…" className={cx(inputClass, 'pl-9')} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted lg:hidden">
                <span className="sr-only">Ordenar por</span>
                <select value={f.sort} onChange={(e) => set({ sort: e.target.value as CrmSort, dir: 'asc' })} className={inputClass}>
                  {Object.entries(CRM_SORT_LABEL).map(([k, l]) => <option key={k} value={k}>Ordenar: {l}</option>)}
                </select>
              </label>
              <details className="group relative">
                <summary className={cx(buttonClass('secondary'), 'cursor-pointer list-none')}>
                  <SlidersHorizontal className="h-4 w-4" aria-hidden /> Más filtros{extra ? ` (${extra})` : ''}
                </summary>
                <div className="absolute right-0 z-20 mt-2 grid w-72 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-elevated)]">
                  <Select label="Deporte" value={f.sport ?? ''} onChange={(v) => set({ sport: v || null })} options={opts.sports.map((s) => [s.id, s.name])} />
                  <Select label="Promoción" value={f.grad ? String(f.grad) : ''} onChange={(v) => set({ grad: v ? Number(v) : null })} options={opts.grads.map((g) => [String(g), String(g)])} />
                  <Select label="País" value={f.country ?? ''} onChange={(v) => set({ country: v || null })} options={opts.countries.map((c) => [c, `${flag(c)} ${c}`])} />
                  <Select label="Representación" value={f.rep} onChange={(v) => set({ rep: (v || 'active') as CrmRep })} options={Object.entries(CRM_REP_LABEL)} noAll />
                  {extra > 0 && <button type="button" onClick={() => set({ sport: null, grad: null, country: null, rep: 'active' })} className="text-left text-sm font-semibold text-brass">Quitar filtros</button>}
                </div>
              </details>
            </div>

            <p className="px-4 py-2 text-xs text-muted" aria-live="polite" role="status">
              {result.total} {result.total === 1 ? 'atleta' : 'atletas'}{f.q ? ` para «${f.q}»` : ''}
            </p>

            {result.total === 0 ? (
              <div className="px-4 pb-8 pt-2 text-center">
                <p className="text-sm text-paper">Ningún atleta coincide con estos filtros.</p>
                <button type="button" onClick={() => setF({ ...DEFAULT_CRM })} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brass hover:underline"><X className="h-4 w-4" aria-hidden /> Quitar búsqueda y filtros</button>
              </div>
            ) : (
              <>
                {/* Escritorio y tablet: tabla con semántica completa (caption, th scope, aria-sort).
                    Fase 8 (U8): a 1024 px no desborda; «Recorrido» solo desde xl (sigue en la ficha y en el filtro). */}
                <div className="hidden lg:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Mis atletas · {CRM_VIEWS.find((v) => v.id === f.view)?.label} · ordenado por {CRM_SORT_LABEL[f.sort]}</caption>
                    <thead className="border-y border-line text-xs text-muted">
                      <tr>
                        <SortHead s="name" f={f} onSort={sortBy} className="pl-4">Atleta</SortHead>
                        <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Recorrido</th>
                        <SortHead s="next" f={f} onSort={sortBy}>Siguiente acción</SortHead>
                        <th scope="col" className="px-3 py-2.5 text-right font-semibold">Oportunidades</th>
                        <SortHead s="activity" f={f} onSort={sortBy}>Última actividad</SortHead>
                        <th scope="col" className="relative px-4 py-2.5 text-right font-semibold"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {result.rows.map((r) => (
                        <tr key={r.id} data-athlete={r.id} className="hover:bg-ink">
                          <th scope="row" className="max-w-[260px] py-2.5 pl-4 pr-3 font-normal">
                            <span className="flex items-center gap-3">
                              <AthleteAvatar name={r.name} src={r.avatarUrl} sport={r.sport ?? r.sportId} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-paper"><span data-name>{r.name}</span>{r.attention > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" role="img" aria-label="necesita atención" />}</span>
                                <span className="block truncate text-xs text-muted">{[r.sport, r.position, r.country && `${flag(r.country)} ${r.country}`, r.intake && `Promoción ${r.intake}`].filter(Boolean).join(' · ') || '—'}</span>
                                <span className="block truncate text-xs text-muted">{r.verification}</span>
                              </span>
                            </span>
                          </th>
                          <td className="hidden px-3 py-2.5 text-paper xl:table-cell">{r.journey}</td>
                          <td className="max-w-[220px] px-3 py-2.5 xl:max-w-[260px]">
                            <span className="block truncate text-paper" data-next>{r.nextAction ?? <span className="text-muted">Sin siguiente paso</span>}</span>
                            {r.nextDue && <span className={cx('text-xs font-semibold', r.nextDue < today() ? 'text-danger' : 'text-muted')}>{dueText(r.nextDue, today())}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-paper">{r.processes} {r.processes === 1 ? 'proceso' : 'procesos'}{r.offers ? <span className="block text-xs text-muted">{r.offers} {r.offers === 1 ? 'oferta' : 'ofertas'}</span> : null}</td>
                          <td className="max-w-[180px] px-3 py-2.5 text-xs text-muted"><span className="block text-paper">{rel(r.lastActivityAt)}</span><span className="block truncate">{r.lastActivity}</span></td>
                          <td className="px-4 py-2.5"><RowActions r={r} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Móvil: tarjetas con lo mismo y una sola acción principal. */}
                <ul className="divide-y divide-line lg:hidden" aria-label="Atletas">
                  {result.rows.map((r) => (
                    <li key={r.id} data-athlete={r.id} className="p-4">
                      <article aria-label={r.name} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <AthleteAvatar name={r.name} src={r.avatarUrl} sport={r.sport ?? r.sportId} size="md" />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-paper">{r.name}{r.attention > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" role="img" aria-label="necesita atención" />}</h3>
                            <p className="truncate text-xs text-muted">{[r.sport, r.position, r.country, r.intake].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        <p className="text-sm text-paper"><span className="text-muted">{r.journey} · </span><span data-next>{r.nextAction ?? 'Sin siguiente paso'}</span>{r.nextDue && <span className={cx('ml-1 text-xs font-semibold', r.nextDue < today() ? 'text-danger' : 'text-muted')}>({dueText(r.nextDue, today())})</span>}</p>
                        <p className="text-xs text-muted">{r.processes} {r.processes === 1 ? 'proceso' : 'procesos'} · {r.offers} {r.offers === 1 ? 'oferta' : 'ofertas'} · {r.verification} · {rel(r.lastActivityAt)}</p>
                        <RowActions r={r} wide />
                      </article>
                    </li>
                  ))}
                </ul>

                {result.pages > 1 && (
                  <nav aria-label="Paginación" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                    <button type="button" disabled={result.page <= 1} onClick={() => set({ page: result.page - 1 })} className={cx(buttonClass('ghost', 'sm'), 'disabled:opacity-40')}><ChevronLeft className="h-4 w-4" aria-hidden /> Anterior</button>
                    <span className="text-muted" aria-current="page">Página {result.page} de {result.pages}</span>
                    <button type="button" disabled={result.page >= result.pages} onClick={() => set({ page: result.page + 1 })} className={cx(buttonClass('ghost', 'sm'), 'disabled:opacity-40')}>Siguiente <ChevronRight className="h-4 w-4" aria-hidden /></button>
                  </nav>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}

/** Cabecera ordenable: botón dentro del th y aria-sort en el th (lectores de pantalla). */
function SortHead({ s, f, onSort, children, className }: { s: CrmSort; f: CrmFilters; onSort: (s: CrmSort) => void; children: React.ReactNode; className?: string }) {
  const on = f.sort === s;
  return (
    <th scope="col" aria-sort={on ? (f.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cx('px-3 py-2.5 font-semibold', className)}>
      <button type="button" onClick={() => onSort(s)} className="inline-flex items-center gap-1 rounded hover:text-paper focus-visible:outline-2 focus-visible:outline-brass">
        {children}
        {on && (f.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
      </button>
    </th>
  );
}

/** Una acción principal («Abrir atleta») y un menú secundario. */
function RowActions({ r, wide = false }: { r: CrmRow; wide?: boolean }) {
  const active = r.rep === 'active';
  return (
    <div className={cx('flex items-center justify-end gap-1.5', wide && 'justify-start')}>
      <Link href={`/app/portfolio/${r.id}`} data-cta="primary" className={cx(buttonClass(r.attention ? 'primary' : 'secondary', 'sm'), 'whitespace-nowrap', wide && 'flex-1 justify-center')} aria-label={`Abrir atleta: ${r.name}`}>
        Abrir atleta
      </Link>
      <details className="relative">
        <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-paper focus-visible:outline-2 focus-visible:outline-brass" aria-label={`Más acciones para ${r.name}`}>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </summary>
        <ul className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1 text-sm shadow-[var(--shadow-elevated)]">
          {active && <MenuLink href={`/app/portfolio/${r.id}?tab=actividad#nota`}>Añadir nota</MenuLink>}
          {active && <MenuLink href={`/app/portfolio/${r.id}?tab=recruiting`}>Ver procesos</MenuLink>}
          {active && <MenuLink href={`/app/opportunities${r.sportId ? `?sport=${r.sportId}` : ''}`}>Buscar oportunidades</MenuLink>}
          <MenuLink href={`/athletes/${r.id}`}>Perfil público</MenuLink>
        </ul>
      </details>
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <li><Link href={href} className="block rounded-lg px-3 py-2 text-paper hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brass">{children}</Link></li>;
}

function Select({ label, value, onChange, options, noAll = false }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; noAll?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {!noAll && <option value="">Todos</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function CrmNoAgency() {
  return (
    <>
      <PageHeader title="Mis atletas" />
      <EmptyState title="Primero, registra tu agencia" action={<Link href="/app/organization" className={buttonClass('primary')}>Registrar agencia</Link>}>
        Los atletas se representan desde una agencia verificada: así tu equipo comparte cartera, procesos y seguimientos, siempre con el permiso del atleta.
      </EmptyState>
    </>
  );
}

export function CrmError() {
  return (
    <>
      <PageHeader title="Mis atletas" />
      <div role="alert" className="rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 p-6">
        <p className="font-semibold text-paper">No hemos podido cargar tus atletas.</p>
        <p className="mt-1 text-sm text-muted">Tus datos están a salvo. Vuelve a intentarlo en unos segundos.</p>
        <Link href="/app/portfolio" className={cx(buttonClass('secondary', 'sm'), 'mt-4')}><RotateCw className="h-4 w-4" aria-hidden /> Reintentar</Link>
      </div>
    </>
  );
}
