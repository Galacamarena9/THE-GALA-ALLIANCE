import type { ReactNode } from 'react';
import { Award, BadgeCheck, Crown, ExternalLink, Flag, GraduationCap, Lock, Medal, Star, Target, Trophy } from 'lucide-react';
import type { AthleteAcademics, AthleteGoals, AthleteProfile, AthleteVideo, CareerEntry, DataSource, Visibility } from '@/lib/types';
import type { StatRow } from '@/lib/data/athlete';
import { VideoFacade } from './VideoFacade';
import {
  ACHIEVEMENT_KIND_LABEL, ACHIEVEMENT_LEVEL_LABEL, CAMPUS_LABEL, COUNTRY_NAME, EDUCATION_SYSTEM_LABEL, PATHWAY_LABEL,
  PROVENANCE_LABEL, SCHOLARSHIP_LABEL, SCHOOL_SIZE_LABEL, SPORT_LEVEL_LABEL, VIDEO_KIND_LABEL, VISIBILITY_LABEL,
} from '@/lib/domain/passport';
import { LINK_KIND_LABEL, domainOf } from '@/lib/domain/labels';
import { initials } from '@/lib/domain/portfolio';

/**
 * VIEW PASSPORT: la presentación del atleta (sin formularios). La misma pieza sirve para el enlace público,
 * la vista de un coach y la previsualización del propio atleta. Lo que la RLS no deja ver llega vacío
 * y se muestra como bloque privado, nunca como "sin datos" inventado.
 */
export interface PassportViewData {
  athleteId: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  age: number | null;
  profile: AthleteProfile;
  academics: AthleteAcademics | null;
  stats: StatRow[];
  languages: { language_code: string; level: string }[];
  achievements: { id: string; title: string; year: number | null; description: string | null; source: string; kind?: string; level?: string | null }[];
  career: CareerEntry[];
  videos: AthleteVideo[];
  goals: AthleteGoals | null;
  links: { id: string; kind: string; url: string; verified: boolean }[];
  recs: { id: string; body: string; org: string; verified: boolean }[];
  sportName: string | null;
  position: string | null;
  position2: string | null;
}

const LANG_NAME: Record<string, string> = { es: 'Español', en: 'Inglés', ca: 'Valenciano', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués' };
const ACH_ICON: Record<string, typeof Trophy> = { championship: Trophy, national_team: Flag, award: Award, recognition: Star, ranking: Medal, captaincy: Crown, academic: GraduationCap, other: Star };
const PROV_CLS: Record<DataSource, string> = { self_reported: 'prov-self text-white/70', documented: 'prov-doc text-[#b9b2ff]', club_verified: 'prov-club text-lime' };

export function Prov({ source, label = false }: { source: DataSource; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={PROVENANCE_LABEL[source].who}>
      <span className={`prov ${PROV_CLS[source]}`} aria-hidden />
      <span className={label ? 'text-[11px] text-white/70' : 'sr-only'}>{PROVENANCE_LABEL[source].short}</span>
    </span>
  );
}

function Section({ id, eyebrow, title, children, aside }: { id?: string; eyebrow: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className="scroll-mt-24">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-lime">{eyebrow}</p>
          <h2 id={id ? `${id}-t` : undefined} className="font-display text-3xl font-bold uppercase leading-none text-white sm:text-4xl">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Locked({ vis, what }: { vis: Visibility; what: string }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/70">
      <Lock className="h-4 w-4 shrink-0" aria-hidden />{what}: {vis === 'private' ? 'privado' : `visible para ${VISIBILITY_LABEL[vis].toLowerCase()}`}.
    </p>
  );
}

const sideLabel = (d: AthleteProfile['dominant_side'], sport: string | null) => {
  if (!d) return null;
  const foot = sport === 'soccer' || sport === 'Fútbol';
  if (d === 'both') return foot ? 'Ambos pies' : 'Ambidiestro/a';
  return foot ? (d === 'left' ? 'Pie izquierdo' : 'Pie derecho') : d === 'left' ? 'Zurdo/a' : 'Diestro/a';
};

export function PassportView({ d, actions, mode = 'public' }: { d: PassportViewData; actions?: ReactNode; mode?: 'public' | 'owner' | 'preview' }) {
  const p = d.profile;
  const featured = d.videos.find((v) => v.is_featured) ?? d.videos.find((v) => v.kind === 'highlight') ?? d.videos[0] ?? null;
  const otherVideos = d.videos.filter((v) => v.id !== featured?.id);

  // Temporada más reciente: cifras clave.
  const latestSeason = d.stats[0]?.season ?? null;
  const keyStats = d.stats.filter((s) => s.season === latestSeason)
    .sort((a, b) => (a.sport_stat_definitions?.sort_order ?? 0) - (b.sport_stat_definitions?.sort_order ?? 0)).slice(0, 4);
  // Temporada → equipo · competición
  const groups = new Map<string, StatRow[]>();
  for (const s of d.stats) {
    const k = `${s.season}|${s.team}|${s.competition}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  const sources: DataSource[] = [
    ...d.stats.map((s) => s.source),
    ...d.achievements.map((a) => a.source as DataSource),
    ...(d.academics ? [d.academics.gpa_source ?? 'self_reported', d.academics.english_source ?? 'self_reported'] as DataSource[] : []),
  ];
  const count = (s: DataSource) => sources.filter((x) => x === s).length;
  const verifiedCount = count('club_verified') + count('documented') + d.links.filter((l) => l.verified).length;

  const facts: [string, string | null][] = [
    ['Altura', p.height_cm ? `${(p.height_cm / 100).toFixed(2).replace('.', ',')} m` : null],
    ['Peso', p.weight_kg ? `${p.weight_kg} kg` : null],
    ['Dominante', sideLabel(p.dominant_side, p.sport_id)],
    ['Experiencia', p.years_experience != null ? `${p.years_experience} años` : null],
  ];
  const a = d.academics;
  const english = a ? [
    a.cambridge_level && `Cambridge ${a.cambridge_level.toUpperCase()}`,
    a.toefl_score != null && `TOEFL ${a.toefl_score}`,
    a.ielts_score != null && `IELTS ${String(a.ielts_score).replace('.', ',')}`,
    a.duolingo_score != null && `Duolingo ${a.duolingo_score}`,
    !a.cambridge_level && a.toefl_score == null && a.ielts_score == null && a.duolingo_score == null && a.english_test && a.english_test !== 'none' && `${a.english_test.toUpperCase()} ${a.english_score ?? ''}`.trim(),
  ].filter(Boolean) as string[] : [];

  return (
    <div className="carbon overflow-hidden rounded-[28px]">
      {/* ===== CABECERA: identidad deportiva ===== */}
      <header className="relative overflow-hidden px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full glow-trust opacity-40" aria-hidden />
        <div className="relative flex items-center justify-between gap-3">
          <span className="eyebrow text-[10px] text-white/60">Gala Passport</span>
          {verifiedCount > 0
            ? <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold text-[#0a0a0c]"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />{verifiedCount} {verifiedCount === 1 ? 'dato verificado' : 'datos verificados'}</span>
            : <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70">Datos declarados por el atleta</span>}
        </div>

        <div className="relative mt-6 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-end lg:grid-cols-[220px_1fr]">
          <div className="passport-portrait relative aspect-[4/5] w-36 overflow-hidden rounded-3xl sm:w-full">
            {d.photoUrl
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración
              ? <img src={d.photoUrl} alt={`Foto de ${d.name}`} className="absolute inset-0 h-full w-full object-cover" />
              : (<>
                <div className="court-lines absolute inset-0 opacity-60" aria-hidden />
                <span className="absolute left-4 top-3 font-display text-4xl font-bold text-white" aria-hidden>{initials(d.name)}</span>
                <span className="absolute -bottom-4 right-2 font-display text-[110px] font-bold leading-none text-white/20" aria-hidden>{String(p.graduation_year ?? '').slice(2) || '·'}</span>
              </>)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.88] text-white sm:text-6xl lg:text-7xl [overflow-wrap:anywhere]">{d.name}</h1>
            <p className="mt-3 text-base font-semibold text-lime">{[d.sportName, d.position].filter(Boolean).join(' · ')}{d.position2 && ` / ${d.position2}`}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {[p.graduation_year && `Clase ${p.graduation_year}`, d.age != null && `${d.age} años`, p.city, p.nationality ? COUNTRY_NAME[p.nationality] ?? p.nationality : d.country]
                .filter(Boolean).map((t) => <li key={String(t)} className="rounded-full border border-white/15 px-3 py-1 text-white/85">{t}</li>)}
            </ul>
            {(p.current_team || p.league || p.competitive_level) && (
              <p className="mt-4 text-sm text-white/80"><span className="font-semibold text-white">{p.current_team ?? 'Equipo'}</span>{[p.league, p.competitive_level].filter(Boolean).map((x) => ` · ${x}`)}</p>
            )}
          </div>
        </div>

        {p.headline && <p className="relative mt-6 max-w-3xl text-lg leading-snug text-white">{p.headline}</p>}

        {facts.some(([, v]) => v) && (
          <dl className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-4">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex flex-col bg-[#121216] px-4 py-3">
                <dt className="order-2 mt-1 flex items-center gap-1.5 text-[11px] text-white/65">{v && <Prov source="self_reported" />}{k}</dt>
                <dd className="font-display text-2xl font-bold leading-none text-white">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          {p.open_to_opportunities && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"><span className="live-dot" aria-hidden />Abierto/a a oportunidades</span>}
          {(d.goals?.pathways?.length ? d.goals.pathways : p.target_divisions).slice(0, 5).map((x) => <span key={x} className="rounded-full border border-lime/40 px-3 py-1.5 text-xs text-lime">{PATHWAY_LABEL[x] ?? x}</span>)}
        </div>
        {actions && <div className="relative mt-6">{actions}</div>}
      </header>

      <div className="space-y-16 border-t border-white/10 px-5 py-10 sm:px-8 sm:py-12">
        {/* ===== VÍDEO ===== */}
        <Section id="video" eyebrow="Highlight Reel" title="En pista">
          {featured ? (
            <div className={otherVideos.length ? "grid gap-4 lg:grid-cols-[1.6fr_1fr]" : "max-w-4xl"}>
              <div>
                <VideoFacade url={featured.url} title={featured.title ?? VIDEO_KIND_LABEL[featured.kind]} label={VIDEO_KIND_LABEL[featured.kind]} />
                <p className="mt-2 text-sm text-white/70">{featured.title ?? VIDEO_KIND_LABEL[featured.kind]}{featured.season && !(featured.title ?? '').includes(featured.season) && ` · ${featured.season}`}</p>
              </div>
              {otherVideos.length > 0 && (
                <ul className="space-y-2">
                  {otherVideos.slice(0, 6).map((v) => (
                    <li key={v.id}>
                      <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm transition-colors hover:border-lime/60">
                        <span className="min-w-0"><span className="block font-semibold text-white">{v.title ?? VIDEO_KIND_LABEL[v.kind]}</span><span className="text-xs text-white/60">{VIDEO_KIND_LABEL[v.kind]}{v.season && ` · ${v.season}`} · {domainOf(v.url)}</span></span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : p.videos_visibility && mode === 'public' && d.videos.length === 0 && p.videos_visibility !== 'public'
            ? <Locked vis={p.videos_visibility} what="Vídeos" />
            : <p className="text-sm text-white/70">Aún no hay vídeos en este Passport.</p>}
        </Section>

        {/* ===== ESTADÍSTICAS ===== */}
        <Section id="estadisticas" eyebrow="Rendimiento" title="Estadísticas" aside={latestSeason && <span className="text-sm text-white/60">{latestSeason}</span>}>
          {d.stats.length ? (
            <>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-4">
                {keyStats.map((s) => (
                  <div key={s.id} className="flex flex-col bg-[#121216] px-4 py-5">
                    <dt className="order-2 mt-2 flex items-center gap-1.5 text-xs text-white/70"><Prov source={s.source} />{s.sport_stat_definitions?.label_es}</dt>
                    <dd className="font-display text-5xl font-bold leading-none tabular-nums text-white">{String(s.value).replace('.', ',')}<span className="ml-1 text-base text-white/60">{s.sport_stat_definitions?.unit === '%' ? '%' : ''}</span></dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 space-y-4">
                {[...groups.entries()].map(([k, rows]) => {
                  const [season, team, comp] = k.split('|');
                  return (
                    <details key={k} className="group rounded-2xl border border-white/10" open={season === latestSeason}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                        <span><span className="font-semibold text-white">{season}</span>{team && <span className="text-white/75"> · {team}</span>}{comp && <span className="text-white/60"> · {comp}</span>}</span>
                        <span className="text-xs text-white/60">{rows.length} datos</span>
                      </summary>
                      <ul className="divide-y divide-white/10 border-t border-white/10">
                        {rows.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <span className="text-white/80">{s.sport_stat_definitions?.label_es}</span>
                            <span className="flex items-center gap-3"><span className="font-display text-xl tabular-nums text-white">{String(s.value).replace('.', ',')}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''}</span><Prov source={s.source} label /></span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </>
          ) : mode === 'public' && p.stats_visibility !== 'public' ? <Locked vis={p.stats_visibility} what="Estadísticas" /> : <p className="text-sm text-white/70">Aún no hay estadísticas.</p>}
        </Section>

        {/* ===== TRAYECTORIA Y LOGROS ===== */}
        <div className="grid gap-12 lg:grid-cols-2">
          <Section id="trayectoria" eyebrow="Trayectoria" title="Equipos">
            {d.career.length || p.current_team ? (
              <ol className="relative space-y-5 border-l border-white/15 pl-6">
                {p.current_team && (
                  <li className="relative">
                    <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full bg-lime" aria-hidden />
                    <p className="font-semibold text-white">{p.current_team}</p>
                    <p className="text-sm text-white/65">{[p.league, 'Actual'].filter(Boolean).join(' · ')}</p>
                  </li>
                )}
                {d.career.map((c) => (
                  <li key={c.id} className="relative">
                    <span className="absolute -left-[28px] top-1.5 h-2.5 w-2.5 rounded-full border border-white/50 bg-[#0a0a0c]" aria-hidden />
                    <p className="font-semibold text-white">{c.team}</p>
                    <p className="text-sm text-white/65">{[c.league, c.country && (COUNTRY_NAME[c.country] ?? c.country), `${c.season_from}${c.season_to ? ` → ${c.season_to}` : ''}`, c.role].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ol>
            ) : mode === 'public' && p.sport_visibility !== 'public' ? <Locked vis={p.sport_visibility} what="Trayectoria" /> : <p className="text-sm text-white/70">Sin trayectoria añadida.</p>}
          </Section>
          <Section id="logros" eyebrow="Palmarés" title="Logros">
            {d.achievements.filter((x) => x.kind !== 'academic').length ? (
              <ul className="space-y-3">
                {d.achievements.filter((x) => x.kind !== 'academic').map((x) => {
                  const Icon = ACH_ICON[x.kind ?? 'other'] ?? Star;
                  return (
                    <li key={x.id} className="flex gap-3 rounded-2xl border border-white/10 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/15 text-lime"><Icon className="h-5 w-5" aria-hidden /></span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-white">{x.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-white/65">
                          {ACHIEVEMENT_KIND_LABEL[(x.kind ?? 'other') as keyof typeof ACHIEVEMENT_KIND_LABEL]}{x.level && ` · ${ACHIEVEMENT_LEVEL_LABEL[x.level as keyof typeof ACHIEVEMENT_LEVEL_LABEL]}`}{x.year && ` · ${x.year}`}
                          <Prov source={x.source as DataSource} label />
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-white/70">Sin logros añadidos.</p>}
          </Section>
        </div>

        {/* ===== ACADÉMICO ===== */}
        <Section id="academico" eyebrow="Académico" title="Estudios">
          {a ? (
            <div className="grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-[#121216] p-5">
                <p className="text-xs text-white/65">Centro</p>
                <p className="mt-1 font-semibold text-white">{a.school_name ?? '—'}</p>
                <p className="text-xs text-white/60">{a.education_system ? EDUCATION_SYSTEM_LABEL[a.education_system as keyof typeof EDUCATION_SYSTEM_LABEL] : 'Sistema no indicado'}</p>
              </div>
              <div className="bg-[#121216] p-5">
                <p className="flex items-center gap-1.5 text-xs text-white/65">{(a.gpa != null || a.grade_display) && <Prov source={a.gpa_source ?? 'self_reported'} />}Nota media</p>
                {/* Se muestra en su sistema original: no convertimos notas internacionales a GPA sin un método fiable. */}
                <p className="mt-1 font-display text-3xl font-bold text-white">{a.grade_display ?? (a.gpa != null ? `${String(a.gpa).replace('.', ',')} / ${a.gpa_scale}` : '—')}</p>
              </div>
              <div className="bg-[#121216] p-5">
                <p className="flex items-center gap-1.5 text-xs text-white/65">{english.length > 0 && <Prov source={a.english_source ?? 'self_reported'} />}Inglés</p>
                <p className="mt-1 font-display text-3xl font-bold text-white">{english[0] ?? '—'}</p>
                {english.length > 1 && <p className="text-xs text-white/60">{english.slice(1).join(' · ')}</p>}
              </div>
              <div className="bg-[#121216] p-5">
                <p className="flex items-center gap-1.5 text-xs text-white/65">{(a.sat_score != null || a.act_score != null) && <Prov source={a.tests_source ?? 'self_reported'} />}Exámenes EE. UU.</p>
                <p className="mt-1 font-display text-3xl font-bold text-white">{[a.sat_score != null && `SAT ${a.sat_score}`, a.act_score != null && `ACT ${a.act_score}`].filter(Boolean).join(' · ') || '—'}</p>
              </div>
            </div>
          ) : mode === 'public' ? <Locked vis={p.academics_visibility} what="Información académica" /> : <p className="text-sm text-white/70">Sin datos académicos.</p>}
          {d.languages.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {d.languages.map((l) => <li key={l.language_code} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85">{LANG_NAME[l.language_code] ?? l.language_code.toUpperCase()} · {l.level === 'native' ? 'Nativo' : l.level.toUpperCase()}</li>)}
            </ul>
          )}
          {d.achievements.some((x) => x.kind === 'academic') && (
            <ul className="mt-4 space-y-1 text-sm text-white/80">{d.achievements.filter((x) => x.kind === 'academic').map((x) => <li key={x.id}>· {x.title}{x.year && ` (${x.year})`}</li>)}</ul>
          )}
        </Section>

        {/* ===== OBJETIVOS ===== */}
        <Section id="objetivos" eyebrow="My Opportunity Goals" title="Qué busca">
          {d.goals ? (
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div>
                <ul className="flex flex-wrap gap-2">{d.goals.pathways.map((x) => <li key={x} className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-[#0a0a0c]">{PATHWAY_LABEL[x] ?? x}</li>)}</ul>
                {d.goals.intended_majors.length > 0 && <p className="mt-4 text-sm text-white/80"><Target className="mr-1.5 inline h-4 w-4 text-lime" aria-hidden />Quiere estudiar: <span className="text-white">{d.goals.intended_majors.join(', ')}</span></p>}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {([
                  ['Países', d.goals.countries.map((c) => COUNTRY_NAME[c] ?? c).join(', ')],
                  ['Regiones', d.goals.regions.join(', ')],
                  ['Incorporación', d.goals.start_term],
                  ['Nivel deportivo', d.goals.sport_level && SPORT_LEVEL_LABEL[d.goals.sport_level]],
                  ['Universidad', d.goals.school_size && SCHOOL_SIZE_LABEL[d.goals.school_size]],
                  ['Campus', d.goals.campus_setting && CAMPUS_LABEL[d.goals.campus_setting]],
                  ['Beca', d.goals.scholarship_need && SCHOLARSHIP_LABEL[d.goals.scholarship_need]],
                ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-white/60">{k}</dt><dd className="text-white">{v}</dd></div>
                ))}
              </dl>
            </div>
          ) : mode === 'public' ? <Locked vis={p.goals_visibility} what="Objetivos" /> : <p className="text-sm text-white/70">Sin objetivos definidos.</p>}
        </Section>

        {/* ===== VERIFICACIÓN ===== */}
        <Section id="verificacion" eyebrow="Confianza" title="Qué está verificado">
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
            {(['club_verified', 'documented', 'self_reported'] as DataSource[]).map((s) => (
              <li key={s} className="bg-[#121216] p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><span className={`prov h-3.5 w-3.5 ${PROV_CLS[s]}`} aria-hidden />{s === 'club_verified' ? 'Verificado' : PROVENANCE_LABEL[s].short}</p>
                <p className="mt-2 font-display text-4xl font-bold text-white">{count(s)}</p>
                <p className="mt-1 text-xs text-white/65">{PROVENANCE_LABEL[s].who}</p>
              </li>
            ))}
          </ul>
          {d.links.length > 0 && (
            <ul className="mt-4 space-y-2">
              {d.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm">
                  <span className="text-white/80">{LINK_KIND_LABEL[l.kind] ?? l.kind}</span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-2 truncate text-lime hover:underline">{domainOf(l.url)} ↗ {l.verified ? <BadgeCheck className="h-4 w-4" aria-label="Enlace verificado" /> : <span className="text-white/60">(sin verificar)</span>}</a>
                </li>
              ))}
            </ul>
          )}
          {d.recs.length > 0 && (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {d.recs.map((r) => (
                <li key={r.id} className="relative overflow-hidden rounded-2xl border border-white/10 p-5">
                  <p className="text-[15px] leading-relaxed text-white/90">“{r.body}”</p>
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-lime">{r.org}{r.verified && <BadgeCheck className="h-4 w-4" aria-label="Club verificado" />}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {p.bio && (
          <Section eyebrow="Sobre mí" title="Presentación">
            <p className="max-w-3xl whitespace-pre-line leading-relaxed text-white/85">{p.bio}</p>
          </Section>
        )}

        <p className="border-t border-white/10 pt-6 text-xs text-white/60">Cada dato indica su origen: declarado por el atleta, documentado o verificado por una organización autorizada. The Gala Alliance no garantiza admisión, beca ni contrato.</p>
      </div>
    </div>
  );
}
