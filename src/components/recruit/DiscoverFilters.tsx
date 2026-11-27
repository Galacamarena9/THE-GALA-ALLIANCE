import Link from 'next/link';
import { ISO_COUNTRIES } from '@/lib/domain/passport';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { DIVISIONS, ENGLISH_LABEL, ENGLISH_LEVELS, SORT_LABEL, classYears, startTerms, termLabel, type DiscoverSort } from '@/lib/domain/recruit-search';
import { inputClass } from '@/components/ui';

type Opt = { id: string | number; name: string };
type SP = Record<string, string | undefined>;

/**
 * Formulario de filtros del buscador del staff (servidor: GET a la misma URL, funciona sin JavaScript).
 * Las filas «Académico e inglés» y «Objetivos» solo filtran a atletas que permiten filtrar esos bloques; el texto lo dice.
 */
export function DiscoverFilters({ tx, sp, sports, positions, sport, hasNeed, isCollege, count, clearHref, action = '/app/recruit/discover', now = new Date() }: {
  tx: (s: string) => string; sp: SP; sports: Opt[]; positions: Opt[]; sport: string | undefined; hasNeed: boolean; isCollege: boolean;
  count: number; clearHref: string; action?: string; now?: Date;
}) {
  const thisYear = now.getUTCFullYear();
  const sorts: DiscoverSort[] = hasNeed ? ['fit', 'grad', 'recent'] : ['recent', 'grad'];
  const sel = (name: string, label: string, opts: [string, string][], all = tx('Todos'), extra?: { disabled?: boolean; hint?: string }) => (
    <label className="text-xs text-muted">
      {label}{extra?.hint ? ` (${extra.hint})` : ''}
      <select name={name} defaultValue={sp[name] ?? ''} disabled={extra?.disabled} className={inputClass}>
        <option value="">{all}</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  const check = (name: string, label: string) => (
    <label className="flex min-h-11 items-center gap-2 text-sm text-paper">
      <input type="checkbox" name={name} value="1" defaultChecked={sp[name] === '1'} className="h-4 w-4" />{label}
    </label>
  );
  return (
    <form method="get" action={action} className="space-y-3" aria-label={tx('Filtros de búsqueda')}>
      {sp.org && <input type="hidden" name="org" value={sp.org} />}
      {sp.need && <input type="hidden" name="need" value={sp.need} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="dq" className="sr-only">{tx('Buscar por nombre')}</label>
          <input id="dq" name="q" defaultValue={sp.q} placeholder={tx('Nombre…')} className={inputClass} />
        </div>
        <label className="text-xs text-muted">
          <span className="sr-only">{tx('Ordenar por')}</span>
          <select name="sort" defaultValue={sp.sort && sorts.includes(sp.sort as DiscoverSort) ? sp.sort : sorts[0]} aria-label={tx('Ordenar por')} className={inputClass}>
            {sorts.map((s) => <option key={s} value={s}>{tx('Ordenar:')} {tx(SORT_LABEL[s])}</option>)}
          </select>
        </label>
      </div>
      <details className="rounded-2xl border border-line bg-surface p-3" open={!count}>
        <summary className="cursor-pointer text-sm font-semibold text-paper">{tx('Filtros')}{count ? ` (${count})` : ''}</summary>
        <fieldset className="mt-3">
          <legend className="text-[11px] font-bold uppercase tracking-wide text-faint">{tx('Deporte y perfil')}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!hasNeed && sel('sport', tx('Deporte'), sports.map((s) => [String(s.id), s.name]))}
            {sel('position', tx('Posición'), positions.map((p) => [String(p.id), p.name]), tx('Todas'), { disabled: !sport, hint: sport ? undefined : tx('elige deporte') })}
            {sel('grad', tx('Promoción'), classYears(now).map((y) => [String(y), y < thisYear ? `${y} · ${tx('ya graduado')}` : String(y)]), tx('Todas'))}
            {sel('country', tx('País'), ISO_COUNTRIES.map(([c, n]) => [c, n]))}
            <label className="text-xs text-muted">{tx('Altura mínima (cm)')}<input name="h" type="number" min={140} max={230} defaultValue={sp.h} className={inputClass} /></label>
            {check('video', tx('Con vídeo'))}
            {check('vstats', tx('Estadísticas verificadas'))}
            {check('open', tx('Abierto a ofertas como las vuestras'))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-[11px] font-bold uppercase tracking-wide text-faint">{tx('Académico e inglés')}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-muted">{tx('GPA mínimo (estimado, escala 4.0)')}<input name="gpa" type="number" min={0.5} max={4} step={0.1} defaultValue={sp.gpa} className={inputClass} /></label>
            {sel('eng', tx('Nivel de inglés'), ENGLISH_LEVELS.map((l) => [l, tx(ENGLISH_LABEL[l])]), tx('Cualquiera'))}
            {check('etest', tx('Con test de inglés (TOEFL, IELTS, Duolingo…)'))}
            {check('acad', tx('Académico documentado'))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-[11px] font-bold uppercase tracking-wide text-faint">{tx('Objetivos y disponibilidad')}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isCollege && sel('div', tx('División objetivo'), DIVISIONS.map((d) => [d, DIVISION_LABEL[d]]), tx('Cualquiera'))}
            {sel('start', tx('Incorporación'), startTerms(now).map((t) => [t, termLabel(t)]), tx('Cualquiera'))}
            {isCollege && check('ncaa', tx('Contacto NCAA ya abierto'))}
          </div>
        </fieldset>
        <p className="mt-3 text-[11px] text-faint">{tx('Cada filtro solo se aplica a atletas que permiten filtrar ese dato; los menores no se filtran por nota. Nunca se filtra por presupuesto familiar.')}</p>
        <div className="sticky bottom-0 mt-3 flex items-center gap-3 bg-surface py-2">
          <button className="min-h-11 flex-1 rounded-full bg-brass px-5 text-sm font-semibold text-ink sm:flex-none">{tx('Aplicar filtros')}</button>
          <Link href={clearHref} className="text-sm text-muted underline">{tx('Borrar todo')}</Link>
        </div>
      </details>
    </form>
  );
}
