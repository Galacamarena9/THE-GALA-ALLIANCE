import type { Metadata } from 'next';
import { formatHeight } from '@/lib/i18n/format';
import Link from 'next/link';
import { LayoutGrid, Rows3, SlidersHorizontal, X } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { buildTalentQuery, DIRECTORY_DIVISIONS } from '@/lib/data/directory';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { COUNTRY_NAME, ISO_COUNTRIES } from '@/lib/domain/passport';
import {
  activeChips, ENGLISH_LABEL, ENGLISH_LEVELS, parseSort, parseTalentFilters, SIDE_LABEL, SORTS, talentHref,
  TALENT_FILTER_KEYS, type TalentFilters,
} from '@/lib/domain/talent-search';
import type { Division } from '@/lib/types';
import { AthleteCard, flag, type DirectoryRow } from '@/components/AthleteCard';
import { Badge, EmptyState, Notice, PageHeader, buttonClass, cx, inputClass } from '@/components/ui';
import { saveAthlete } from '@/app/actions/lists';
import { AiSearchBar } from '@/components/AiSearchBar';
import { SaveSearchForm } from '@/components/growth';

export const metadata: Metadata = { title: 'Buscar talento' };

const PAGE_SIZE = 24;
const BASE = '/app/discover';

type Raw = Record<string, string | string[] | undefined>;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const session = await requireSession();
  const canSave = session.roles.some((r) => ['university', 'coach', 'agent', 'brand', 'admin'].includes(r));
  const raw = await searchParams;
  const f = parseTalentFilters(raw, DIRECTORY_DIVISIONS);
  const sort = parseSort(raw.sort);
  const view = raw.view === 'table' ? 'table' : 'cards';
  const page = Math.max(1, Number(raw.page) || 1);
  const supabase = await createClient();
  const catalog = await loadCatalog();

  const { data: orgs } = await supabase
    .from('organization_members')
    .select('organizations(type, verification_status)')
    .eq('user_id', session.userId);
  const verifiedRecruiter = (orgs ?? []).some((m) => {
    const o = m.organizations as unknown as { type: string; verification_status: string } | null;
    return o?.verification_status === 'verified' && ['university', 'college', 'club', 'academy'].includes(o.type);
  });

  const { query, gpaNote } = await buildTalentQuery(supabase, f, { sort, range: [(page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1] });
  const [{ data, count, error }, { data: saved }] = await Promise.all([
    query,
    supabase.from('saved_athletes').select('athlete_id').eq('owner_id', session.userId),
  ]);
  const rows = (data ?? []) as unknown as DirectoryRow[];
  const savedIds = new Set((saved ?? []).map((s) => s.athlete_id));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => thisYear - 1 + i);

  const sportName = (id: string) => catalog.sports.find((s) => s.id === id)?.name_es;
  const positionName = (id: string | number) => catalog.positions.find((p) => String(p.id) === String(id))?.name_es;
  const current: Record<string, string | undefined> = { ...f, sort: sort === 'recent' ? undefined : sort, view: view === 'cards' ? undefined : view };
  const href = (patch: Record<string, string | undefined>) => talentHref(BASE, current, patch);
  const chips = activeChips(f, { sportName, positionName, countryName: (c) => COUNTRY_NAME[c], divisionName: (d) => DIVISION_LABEL[d as Division] });
  const positions = catalog.positions.filter((p) => !f.sport || p.sport_id === f.sport);
  const filterCount = chips.length;

  const saveButton = (id: string) =>
    !canSave ? null : savedIds.has(id) ? (
      <span className="text-xs font-semibold text-ok">✓ Guardado</span>
    ) : (
      <form action={saveAthlete}>
        <input type="hidden" name="athlete_id" value={id} />
        <button className={buttonClass('secondary', 'sm')}>Guardar</button>
      </form>
    );

  const filters = (
    <form method="get" action={BASE} className="space-y-5" aria-label="Filtros de talento">
      {sort !== 'recent' && <input type="hidden" name="sort" value={sort} />}
      {view !== 'cards' && <input type="hidden" name="view" value={view} />}
      <Group title="Deporte">
        <select name="sport" defaultValue={f.sport ?? ''} aria-label="Deporte" className={inputClass}>
          <option value="">Todos los deportes</option>
          {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
        </select>
        <select name="position" defaultValue={f.position ?? ''} aria-label="Posición" className={inputClass}>
          <option value="">{f.sport ? 'Cualquier posición' : 'Posición (elige deporte)'}</option>
          {f.sport
            ? positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)
            : catalog.sports.map((s) => (
                <optgroup key={s.id} label={s.name_es}>
                  {catalog.positions.filter((p) => p.sport_id === s.id).map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                </optgroup>
              ))}
        </select>
        <select name="side" defaultValue={f.side ?? ''} aria-label="Lateralidad (pierna o mano dominante)" className={inputClass}>
          <option value="">Lateralidad: cualquiera</option>
          {Object.entries(SIDE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Group>

      <Group title="Físico">
        <Range label="Altura (cm)" min="min_height" max="max_height" f={f} lo={140} hi={230} />
        <Range label="Peso (kg)" min="min_weight" max="max_weight" f={f} lo={40} hi={150} />
      </Group>

      <Group title="Origen y edad">
        <select name="nationality" defaultValue={f.nationality ?? ''} aria-label="Nacionalidad" className={inputClass}>
          <option value="">Nacionalidad: cualquiera</option>
          {ISO_COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <select name="country" defaultValue={f.country ?? ''} aria-label="País de residencia" className={inputClass}>
          <option value="">Reside en: cualquier país</option>
          {ISO_COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select name="grad_min" defaultValue={f.grad_min ?? f.grad ?? ''} aria-label="Promoción desde" className={inputClass}>
            <option value="">Promoción desde</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select name="grad_max" defaultValue={f.grad_max ?? f.grad ?? ''} aria-label="Promoción hasta" className={inputClass}>
            <option value="">hasta</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </Group>

      <Group title="Nivel">
        <input name="league" defaultValue={f.league ?? ''} placeholder="Liga o competición" aria-label="Liga o competición" className={inputClass} />
        <select name="exp_min" defaultValue={f.exp_min ?? ''} aria-label="Años compitiendo" className={inputClass}>
          <option value="">Experiencia: cualquiera</option>
          {[2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}+ años compitiendo</option>)}
        </select>
        <select name="division" defaultValue={f.division ?? ''} aria-label="División objetivo (EE. UU.)" className={inputClass}>
          <option value="">Objetivo EE. UU.: cualquiera</option>
          {DIRECTORY_DIVISIONS.map((d) => <option key={d} value={d}>{DIVISION_LABEL[d as Division]}</option>)}
        </select>
      </Group>

      <Group title="Académico e idioma">
        <select name="english" defaultValue={f.english ?? ''} aria-label="Inglés mínimo" className={inputClass}>
          <option value="">Inglés: cualquiera</option>
          {ENGLISH_LEVELS.filter((l) => l !== 'a1').map((l) => <option key={l} value={l}>{ENGLISH_LABEL[l]} o más</option>)}
        </select>
        <select name="gpa" defaultValue={f.gpa ?? ''} aria-label="Nota mínima (GPA)" className={inputClass}>
          <option value="">GPA: cualquiera</option>
          {['2.3', '2.5', '3.0', '3.5'].map((g) => <option key={g} value={g}>≥ {g}</option>)}
        </select>
      </Group>

      <Group title="Confianza">
        <Check name="video" checked={!!f.video}>Con vídeo</Check>
        <Check name="verified" checked={!!f.verified}>Estadísticas validadas por su club</Check>
      </Group>

      <div className="flex gap-2">
        <button className={cx(buttonClass('primary'), 'flex-1')}>Aplicar filtros</button>
        {filterCount > 0 && <Link href={talentHref(BASE, { sort: current.sort, view: current.view }, {})} className={buttonClass('ghost')}>Limpiar</Link>}
      </div>
    </form>
  );

  return (
    <>
      <PageHeader
        kicker="Talento"
        title="Encuentra al atleta que buscas"
        description="Filtra por deporte, posición, físico, nacionalidad, promoción, nivel e idioma. Cada dato indica si es declarado o validado, y guarda la búsqueda para recibir los perfiles nuevos."
      />

      <form method="get" action={BASE} className="mb-4 flex gap-2" role="search">
        {Object.entries(current).filter(([k, v]) => v && k !== 'q').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="q" defaultValue={f.q ?? ''} placeholder="Buscar por nombre…" aria-label="Buscar por nombre" className={cx(inputClass, 'flex-1')} />
        <button className={buttonClass('primary')}>Buscar</button>
      </form>
      {canSave && <div className="mb-5"><AiSearchBar /></div>}

      {(session.roles.includes('coach') || session.roles.includes('university')) && !verifiedRecruiter && (
        <div className="mb-5">
          <Notice>Tu organización está pendiente de verificación. Hasta entonces solo ves atletas mayores de edad. <Link href="/app/organization" className="underline">Ver estado</Link></Notice>
        </div>
      )}
      {!verifiedRecruiter && !(session.roles.includes('coach') || session.roles.includes('university')) && (
        <div className="mb-5"><Notice tone="neutral">Por protección de menores, solo se muestran atletas mayores de edad que han elegido ser visibles.</Notice></div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Escritorio: panel fijo. Móvil: plegado para no tapar los resultados. */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-[var(--radius-card)] border border-line bg-surface p-5">{filters}</div>
        </aside>
        <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-paper">
            <SlidersHorizontal className="h-4 w-4 text-brass" aria-hidden /> Filtros{filterCount ? ` (${filterCount})` : ''}
          </summary>
          <div className="mt-4">{filters}</div>
        </details>

        <section aria-labelledby="results" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results" className="text-sm text-muted">
              <span className="font-display text-2xl font-bold text-paper">{total}</span> {total === 1 ? 'atleta' : 'atletas'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <nav aria-label="Ordenar resultados" className="flex flex-wrap gap-1">
                {Object.entries(SORTS).map(([k, l]) => (
                  <Link key={k} href={href({ sort: k === 'recent' ? undefined : k })} aria-current={k === sort ? 'true' : undefined}
                    className={cx('rounded-full px-3 py-1', k === sort ? 'bg-brass/10 font-semibold text-brass' : 'text-muted hover:text-paper')}>{l}</Link>
                ))}
              </nav>
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <Link href={href({ view: undefined })} aria-label="Ver como tarjetas" aria-current={view === 'cards' ? 'true' : undefined} className={cx('rounded-lg p-1.5', view === 'cards' ? 'bg-brass/10 text-brass' : 'text-muted hover:text-paper')}><LayoutGrid className="h-4 w-4" /></Link>
              <Link href={href({ view: 'table' })} aria-label="Ver como tabla" aria-current={view === 'table' ? 'true' : undefined} className={cx('rounded-lg p-1.5', view === 'table' ? 'bg-brass/10 text-brass' : 'text-muted hover:text-paper')}><Rows3 className="h-4 w-4" /></Link>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtros activos">
              {chips.map((c) => (
                <li key={c.key}>
                  <Link href={href(Object.fromEntries(c.remove.map((k) => [k, undefined])))} className="inline-flex items-center gap-1.5 rounded-full border border-brass/30 bg-brass/5 px-3 py-1 text-xs font-medium text-paper hover:border-brass" aria-label={`Quitar filtro ${c.label}`}>
                    {c.label} <X className="h-3 w-3 text-brass" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {canSave && chips.length > 0 && (
            <div className="mb-4">
              <SaveSearchForm filters={Object.fromEntries(TALENT_FILTER_KEYS.filter((k) => f[k]).map((k) => [k, String(f[k])]))} />
            </div>
          )}
          {gpaNote && <p className="mb-4 text-xs text-faint">El filtro de nota solo incluye atletas que comparten su bloque académico contigo.</p>}
          {error && <Notice tone="danger">No se ha podido cargar el directorio.</Notice>}

          {!rows.length ? (
            <EmptyState title="Sin resultados con estos filtros">
              Quita algún filtro (pulsa la ✕ de cada uno). Solo aparecen atletas abiertos a oportunidades que comparten esos datos contigo.
            </EmptyState>
          ) : view === 'table' ? (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
              <table className="data-table w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">Atletas que cumplen los filtros</caption>
                <thead className="border-b border-line text-xs text-faint">
                  <tr>
                    {['Atleta', 'Posición', 'Promoción', 'Altura', 'Peso', 'Lateralidad', 'Inglés', 'Equipo / liga', 'Señales', ''].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((a) => (
                    <tr key={a.user_id} className="hover:bg-surface-2/50">
                      <td className="px-3 py-2.5">
                        <Link href={`/athletes/${a.user_id}`} className="font-semibold text-paper hover:text-brass">{a.display_name ?? 'Atleta'}</Link>{' '}
                        <span aria-label={a.nationality ? COUNTRY_NAME[a.nationality] ?? a.nationality : undefined}>{flag(a.nationality ?? a.country)}</span>
                        <span className="block text-xs text-faint">{a.sport_id ? sportName(a.sport_id) : '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{a.primary_position_id ? positionName(a.primary_position_id) : '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-paper">{a.graduation_year ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-paper">{formatHeight(a.height_cm, 'es') ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-paper">{a.weight_kg ? `${a.weight_kg} kg` : '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{a.dominant_side ? SIDE_LABEL[a.dominant_side] : '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{a.english_level ? ENGLISH_LABEL[a.english_level] : '—'}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-muted">{[a.current_team, a.league].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {a.has_verified_stats && <Badge tone="ok">Validadas</Badge>}
                          {a.has_video && <Badge tone="brass">Vídeo</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{saveButton(a.user_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {rows.map((a) => (
                <li key={a.user_id}>
                  <AthleteCard
                    a={a}
                    sportName={a.sport_id ? sportName(a.sport_id) : undefined}
                    positionName={a.primary_position_id ? positionName(a.primary_position_id) : undefined}
                    footer={canSave ? <div className="flex items-center justify-between gap-2"><Link href={`/athletes/${a.user_id}`} className="text-sm font-semibold text-brass">Ver perfil</Link>{saveButton(a.user_id)}</div> : undefined}
                  />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
              {page > 1 && <Link href={href({ page: String(page - 1) })} className="text-brass hover:underline">← Anterior</Link>}
              <span className="text-muted">Página {page} de {totalPages}</span>
              {page < totalPages && <Link href={href({ page: String(page + 1) })} className="text-brass hover:underline">Siguiente →</Link>}
            </nav>
          )}
        </section>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-[13px] font-semibold text-faint">{title}</legend>
      {children}
    </fieldset>
  );
}

function Range({ label, min, max, f, lo, hi }: { label: string; min: keyof TalentFilters; max: keyof TalentFilters; f: TalentFilters; lo: number; hi: number }) {
  return (
    <div>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" inputMode="numeric" name={min} min={lo} max={hi} defaultValue={f[min] ?? ''} placeholder="Mín." aria-label={`${label} mínimo`} className={inputClass} />
        <input type="number" inputMode="numeric" name={max} min={lo} max={hi} defaultValue={f[max] ?? ''} placeholder="Máx." aria-label={`${label} máximo`} className={inputClass} />
      </div>
    </div>
  );
}

function Check({ name, checked, children }: { name: string; checked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="accent-[var(--color-brass)]" /> {children}
    </label>
  );
}
