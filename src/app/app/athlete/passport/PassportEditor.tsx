'use client';

import { useMemo, useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, CardTitle, Field, inputClass, Notice } from '@/components/ui';
import { addAchievement, addLanguage, addStat, deleteAchievement, deleteLanguage, deleteStat, saveAcademics, saveProfile } from '@/app/actions/passport';
import { DIVISION_LABEL, VISIBILITY_LABEL } from '@/lib/domain/labels';
import type { AthleteAcademics, AthleteProfile, Division, Visibility } from '@/lib/types';
import type { StatRow } from '@/lib/data/athlete';

interface Catalog {
  sports: { id: string; name_es: string }[];
  positions: { id: number; sport_id: string; name_es: string }[];
  statDefs: { id: number; sport_id: string; label_es: string; unit: string | null }[];
}

const SOURCE_LABEL = { self_reported: 'Declarado', documented: 'Documentado', club_verified: 'Verificado por el club' } as const;
const LANGS = [['es', 'Español'], ['en', 'Inglés'], ['ca', 'Valenciano / catalán'], ['fr', 'Francés'], ['de', 'Alemán'], ['it', 'Italiano'], ['pt', 'Portugués']] as const;

function VisibilitySelect({ name, value, isMinor, label }: { name: string; value: Visibility; isMinor: boolean; label: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <select id={name} name={name} defaultValue={value} className={inputClass}>
        {(Object.keys(VISIBILITY_LABEL) as Visibility[])
          .filter((v) => !(isMinor && v === 'public'))
          .map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
      </select>
    </Field>
  );
}

export function PassportEditor({
  isMinor,
  profile,
  academics,
  stats,
  languages,
  achievements,
  catalog,
  annualBudgetUsd,
}: {
  annualBudgetUsd: number | null;
  isMinor: boolean;
  profile: AthleteProfile | null;
  academics: AthleteAcademics | null;
  stats: StatRow[];
  languages: { language_code: string; level: string }[];
  achievements: { id: string; title: string; year: number | null; description: string | null; source: string }[];
  catalog: Catalog;
}) {
  const [sport, setSport] = useState(profile?.sport_id ?? '');
  const positions = useMemo(() => catalog.positions.filter((p) => p.sport_id === sport), [catalog.positions, sport]);
  const statDefs = catalog.statDefs.filter((d) => d.sport_id === profile?.sport_id);
  const thisYear = new Date().getFullYear();
  const season = new Date().getMonth() >= 7 ? `${thisYear}-${String(thisYear + 1).slice(2)}` : `${thisYear - 1}-${String(thisYear).slice(2)}`;

  if (!profile) return <Notice tone="warn">Aún no tienes Passport. Completa el registro de atleta.</Notice>;

  return (
    <div className="space-y-5">
      <Card id="perfil">
        <CardTitle kicker="Bloque 1">Perfil deportivo</CardTitle>
        <ActionForm action={saveProfile} className="space-y-5">
          {(fe) => (
            <>
              <Field label="Titular" htmlFor="headline" hint="Una línea: posición, nivel y lo que buscas. Ej.: Base zurda, 1,78 m, Liga EBA · busco NCAA D1/D2 para 2027." error={fe.headline}>
                <input id="headline" name="headline" defaultValue={profile.headline ?? ''} maxLength={160} className={inputClass} />
              </Field>
              <div id="deporte" className="grid gap-5 sm:grid-cols-3">
                <Field label="Deporte" htmlFor="sport_id">
                  <select id="sport_id" name="sport_id" value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass}>
                    {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                  </select>
                </Field>
                <Field label="Posición principal" htmlFor="primary_position_id" error={fe.primary_position_id}>
                  <select key={`p-${sport}`} id="primary_position_id" name="primary_position_id" defaultValue={sport === profile.sport_id ? (profile.primary_position_id ?? '') : ''} className={inputClass}>
                    <option value="">Elige…</option>
                    {positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                  </select>
                </Field>
                <Field label="Posición secundaria" htmlFor="secondary_position_id" error={fe.secondary_position_id}>
                  <select key={`s-${sport}`} id="secondary_position_id" name="secondary_position_id" defaultValue={sport === profile.sport_id ? (profile.secondary_position_id ?? '') : ''} className={inputClass}>
                    <option value="">Ninguna</option>
                    {positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-4">
                <Field label="Fin de instituto" htmlFor="graduation_year">
                  <select id="graduation_year" name="graduation_year" defaultValue={profile.graduation_year ?? thisYear + 1} className={inputClass}>
                    {Array.from({ length: 8 }, (_, i) => thisYear - 2 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="Altura (cm)" htmlFor="height_cm" error={fe.height_cm}>
                  <input id="height_cm" name="height_cm" type="number" min={100} max={250} defaultValue={profile.height_cm ?? ''} className={inputClass} />
                </Field>
                <Field label="Lado dominante" htmlFor="dominant_side">
                  <select id="dominant_side" name="dominant_side" defaultValue={profile.dominant_side ?? ''} className={inputClass}>
                    <option value="">—</option>
                    <option value="right">Diestro/a</option>
                    <option value="left">Zurdo/a</option>
                    <option value="both">Ambos</option>
                  </select>
                </Field>
                <Field label="Ciudad" htmlFor="city">
                  <input id="city" name="city" defaultValue={profile.city ?? ''} className={inputClass} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Equipo actual" htmlFor="current_team">
                  <input id="current_team" name="current_team" defaultValue={profile.current_team ?? ''} className={inputClass} />
                </Field>
                <Field label="Nivel / liga" htmlFor="competitive_level" hint="Ej.: Liga EBA, Primera Nacional, ranking RFET.">
                  <input id="competitive_level" name="competitive_level" defaultValue={profile.competitive_level ?? ''} className={inputClass} />
                </Field>
              </div>
              <Field label="Sobre ti" htmlFor="bio" hint="Opcional. Qué te hace diferente dentro y fuera de la pista." error={fe.bio}>
                <textarea id="bio" name="bio" rows={4} defaultValue={profile.bio ?? ''} maxLength={2000} className={inputClass} />
              </Field>
              <div id="video">
                <Field label="Vídeo de highlights" htmlFor="highlight_video_url" hint="Enlace https de YouTube, Vimeo o Hudl. Lo primero que mira un coach." error={fe.highlight_video_url}>
                  <input id="highlight_video_url" name="highlight_video_url" inputMode="url" placeholder="https://" defaultValue={profile.highlight_video_url ?? ''} className={inputClass} />
                </Field>
                <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-xs leading-relaxed text-muted">
                  <input type="checkbox" name="media_rights" className="mt-0.5 h-4 w-4 accent-[var(--color-brass)]" />
                  <span>
                    Confirmo que puedo publicar este vídeo y que las personas que aparecen lo consienten. No incluiré caras de menores que no sean yo sin permiso de sus familias.
                    {fe.media_rights && <span className="mt-1 block font-semibold text-danger">{fe.media_rights}</span>}
                  </span>
                </label>
              </div>

              <div id="objetivos" className="rounded-xl border border-line bg-ink/40 p-4">
                <p className="mb-3 text-sm font-medium text-paper">Objetivos</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIVISION_LABEL) as Division[]).map((d) => (
                    <label key={d} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper has-[:checked]:border-brass has-[:checked]:text-brass">
                      <input type="checkbox" name="target_divisions" value={d} defaultChecked={profile.target_divisions.includes(d)} className="accent-[var(--color-brass)]" />
                      {DIVISION_LABEL[d]}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="Qué te gustaría estudiar" htmlFor="intended_major">
                    <input id="intended_major" name="intended_major" defaultValue={profile.intended_major ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Presupuesto familiar anual (USD)" htmlFor="annual_budget_usd" hint="Privado: solo lo veis tú y tu familia. Sirve para calcular el encaje de coste." error={fe.annual_budget_usd}>
                    <input id="annual_budget_usd" name="annual_budget_usd" type="number" min={0} step={500} defaultValue={annualBudgetUsd ?? ''} className={inputClass} />
                  </Field>
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-paper">
                  <input type="checkbox" name="open_to_opportunities" defaultChecked={profile.open_to_opportunities} className="accent-[var(--color-brass)]" />
                  Abierto/a a oportunidades
                </label>
              </div>

              <div className="rounded-xl border border-line bg-ink/40 p-4">
                <p className="mb-1 text-sm font-medium text-paper">Quién puede ver cada bloque</p>
                <p className="mb-4 text-xs text-faint">
                  {isMinor
                    ? 'Como eres menor, tu perfil nunca es visible para anónimos, marcas ni agentes: solo para universidades y clubes verificados y para tu familia vinculada.'
                    : 'Tu familia vinculada siempre puede ver tu perfil si se lo permites.'}
                </p>
                <div className="grid gap-5 sm:grid-cols-3">
                  <VisibilitySelect name="profile_visibility" label="Perfil" value={profile.profile_visibility} isMinor={isMinor} />
                  <VisibilitySelect name="stats_visibility" label="Estadísticas" value={profile.stats_visibility} isMinor={isMinor} />
                  <VisibilitySelect name="academics_visibility" label="Académico" value={profile.academics_visibility} isMinor={isMinor} />
                </div>
              </div>
              <SubmitButton>Guardar perfil</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>

      <Card id="academico">
        <CardTitle kicker="Bloque 2">Académico</CardTitle>
        <ActionForm action={saveAcademics} className="space-y-5">
          {(fe) => (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Nota media" htmlFor="gpa" error={fe.gpa}>
                  <input id="gpa" name="gpa" type="number" step="0.01" min={0} defaultValue={academics?.gpa ?? ''} className={inputClass} />
                </Field>
                <Field label="Escala" htmlFor="gpa_scale" hint="En España, normalmente sobre 10.">
                  <select id="gpa_scale" name="gpa_scale" defaultValue={academics?.gpa_scale ?? 10} className={inputClass}>
                    <option value={10}>Sobre 10</option>
                    <option value={4}>Sobre 4 (GPA)</option>
                    <option value={5}>Sobre 5</option>
                    <option value={20}>Sobre 20</option>
                  </select>
                </Field>
                <Field label="Curso actual" htmlFor="school_year">
                  <select id="school_year" name="school_year" defaultValue={academics?.school_year ?? ''} className={inputClass}>
                    <option value="">—</option>
                    <option value="eso_3">3.º ESO</option>
                    <option value="eso_4">4.º ESO</option>
                    <option value="bach_1">1.º Bachillerato</option>
                    <option value="bach_2">2.º Bachillerato</option>
                    <option value="graduated">Graduado/a</option>
                    <option value="college">Universidad</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-4">
                <Field label="Examen de inglés" htmlFor="english_test">
                  <select id="english_test" name="english_test" defaultValue={academics?.english_test ?? ''} className={inputClass}>
                    <option value="">—</option>
                    <option value="toefl">TOEFL</option>
                    <option value="ielts">IELTS</option>
                    <option value="duolingo">Duolingo English Test</option>
                    <option value="cambridge">Cambridge</option>
                    <option value="none">Aún no</option>
                  </select>
                </Field>
                <Field label="Resultado" htmlFor="english_score">
                  <input id="english_score" name="english_score" defaultValue={academics?.english_score ?? ''} className={inputClass} />
                </Field>
                <Field label="SAT" htmlFor="sat_score" hint="Opcional." error={fe.sat_score}>
                  <input id="sat_score" name="sat_score" type="number" min={400} max={1600} defaultValue={academics?.sat_score ?? ''} className={inputClass} />
                </Field>
                <Field label="ACT" htmlFor="act_score" hint="Opcional." error={fe.act_score}>
                  <input id="act_score" name="act_score" type="number" min={1} max={36} defaultValue={academics?.act_score ?? ''} className={inputClass} />
                </Field>
              </div>
              <p className="text-xs text-faint">Para calcular encajes convertimos tu nota a escala 4.0 de forma aproximada. La conversión oficial la hace el centro de elegibilidad.</p>
              <SubmitButton>Guardar académico</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>

      <Card id="estadisticas">
        <CardTitle kicker="Bloque 3">Estadísticas</CardTitle>
        {stats.length > 0 && (
          <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
            {stats.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-paper">{s.sport_stat_definitions?.label_es} <span className="text-faint">· {s.season}</span></span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-paper">{s.value}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''}</span>
                  <Badge tone={s.source === 'self_reported' ? 'neutral' : 'ok'}>{SOURCE_LABEL[s.source]}</Badge>
                  {s.source === 'self_reported' && (
                    <form action={deleteStat}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-faint hover:text-danger" aria-label="Eliminar estadística">Eliminar</button></form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addStat} className="grid items-end gap-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
          {(fe) => (
            <>
              <Field label="Estadística" htmlFor="stat_definition_id">
                <select id="stat_definition_id" name="stat_definition_id" className={inputClass}>
                  {statDefs.map((d) => <option key={d.id} value={d.id}>{d.label_es}{d.unit ? ` (${d.unit})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Temporada" htmlFor="season" error={fe.season}>
                <input id="season" name="season" defaultValue={season} className={inputClass} />
              </Field>
              <Field label="Valor" htmlFor="value" error={fe.value}>
                <input id="value" name="value" type="number" step="0.01" min={0} required className={inputClass} />
              </Field>
              <SubmitButton variant="secondary">Añadir</SubmitButton>
            </>
          )}
        </ActionForm>
        <p className="mt-4 text-xs text-faint">Las estadísticas que añades aparecen como &quot;Declarado&quot;. Tu club podrá verificarlas cuando se active el portal de clubes.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="idiomas">
          <CardTitle kicker="Bloque 4">Idiomas</CardTitle>
          {languages.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2">
              {languages.map((l) => (
                <li key={l.language_code}>
                  <form action={deleteLanguage} className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-sm text-paper">
                    {LANGS.find(([c]) => c === l.language_code)?.[1] ?? l.language_code} · {l.level.toUpperCase()}
                    <input type="hidden" name="language_code" value={l.language_code} />
                    <button className="text-faint hover:text-danger" aria-label="Quitar idioma">×</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addLanguage} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
            {() => (
              <>
                <Field label="Idioma" htmlFor="language_code">
                  <select id="language_code" name="language_code" className={inputClass}>
                    {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Nivel" htmlFor="level">
                  <select id="level" name="level" className={inputClass} defaultValue="b2">
                    {['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'].map((l) => <option key={l} value={l}>{l === 'native' ? 'Nativo' : l.toUpperCase()}</option>)}
                  </select>
                </Field>
                <SubmitButton variant="secondary">Añadir</SubmitButton>
              </>
            )}
          </ActionForm>
        </Card>

        <Card id="logros">
          <CardTitle kicker="Bloque 5">Logros</CardTitle>
          {achievements.length > 0 && (
            <ul className="mb-4 space-y-2">
              {achievements.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  <span><span className="text-paper">{a.title}</span>{a.year && <span className="text-faint"> · {a.year}</span>}</span>
                  <form action={deleteAchievement}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-faint hover:text-danger">Eliminar</button></form>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addAchievement} className="space-y-4">
            {(fe) => (
              <>
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                  <Field label="Logro o convocatoria" htmlFor="title" error={fe.title}>
                    <input id="title" name="title" className={inputClass} />
                  </Field>
                  <Field label="Año" htmlFor="year" error={fe.year}>
                    <input id="year" name="year" type="number" min={2000} max={2040} className={inputClass} />
                  </Field>
                </div>
                <SubmitButton variant="secondary">Añadir logro</SubmitButton>
              </>
            )}
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
