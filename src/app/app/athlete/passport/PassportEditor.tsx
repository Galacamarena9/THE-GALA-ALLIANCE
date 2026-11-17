'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Copy, Lock, Share2, Star, Trash2 } from 'lucide-react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, CardTitle, Field, inputClass, Notice } from '@/components/ui';
import {
  addAchievement, addCareer, addLanguage, addStat, addVideo, deleteAchievement, deleteCareer, deleteLanguage, deleteStat, deleteVideo,
  featureVideo, saveAcademics, saveGoals, savePhotoPath, savePrivacy, saveProfile, saveUsername,
} from '@/app/actions/passport';
import {
  ACHIEVEMENT_KIND_LABEL, ACHIEVEMENT_LEVEL_LABEL, CAMPUS_LABEL, EDUCATION_SYSTEM_LABEL, FIXED_PRIVATE, ISO_COUNTRIES, PATHWAY_GROUPS,
  PRIVACY_BLOCKS, PROVENANCE_LABEL, SCHOLARSHIP_LABEL, SCHOOL_SIZE_LABEL, SPORT_LEVEL_LABEL, VIDEO_KIND_LABEL, VISIBILITY_OPTIONS, suggestUsername,
} from '@/lib/domain/passport';
import type { AthleteAcademics, AthleteGoals, AthleteProfile, AthleteVideo, CareerEntry, DataSource } from '@/lib/types';
import type { StatRow } from '@/lib/data/athlete';
import { createBrowserSupabase } from '@/lib/supabase/client';

export interface Catalog {
  sports: { id: string; name_es: string }[];
  positions: { id: number; sport_id: string; name_es: string }[];
  statDefs: { id: number; sport_id: string; label_es: string; unit: string | null }[];
}

const LANGS = [['es', 'Español'], ['en', 'Inglés'], ['ca', 'Valenciano / catalán'], ['fr', 'Francés'], ['de', 'Alemán'], ['it', 'Italiano'], ['pt', 'Portugués']] as const;
const PROV_TONE: Record<DataSource, 'neutral' | 'brass' | 'ok'> = { self_reported: 'neutral', documented: 'brass', club_verified: 'ok' };
const currentSeason = () => {
  const y = new Date().getFullYear();
  return new Date().getMonth() >= 7 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
};
const sel = `${inputClass} appearance-none`;

function ProvBadge({ source }: { source: DataSource }) {
  return <Badge tone={PROV_TONE[source]}>{PROVENANCE_LABEL[source].short}</Badge>;
}

/* ------------------------------------------------------------------ Identidad */
export function IdentitySection({ profile, catalog, photoUrl, athleteId }: { profile: AthleteProfile; catalog: Catalog; photoUrl: string | null; athleteId: string }) {
  const [sport, setSport] = useState(profile.sport_id ?? '');
  const positions = useMemo(() => catalog.positions.filter((p) => p.sport_id === sport), [catalog.positions, sport]);
  return (
    <div className="space-y-5">
      <PhotoUpload athleteId={athleteId} photoUrl={photoUrl} />
      <Card>
        <CardTitle kicker="Identidad del atleta">Quién eres en pista</CardTitle>
        <ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-2">
          {(fe) => (
            <>
              <Field label="Deporte" htmlFor="sport_id" error={fe.sport_id}>
                <select id="sport_id" name="sport_id" required value={sport} onChange={(e) => setSport(e.target.value)} className={sel}>
                  <option value="">Elige…</option>
                  {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                </select>
              </Field>
              <Field label="Año de graduación (Class)" htmlFor="graduation_year" error={fe.graduation_year}>
                <input id="graduation_year" name="graduation_year" type="number" inputMode="numeric" min={2020} max={2040} required defaultValue={profile.graduation_year ?? ''} className={inputClass} />
              </Field>
              <Field label="Posición principal" htmlFor="primary_position_id" error={fe.primary_position_id}>
                <select id="primary_position_id" name="primary_position_id" required defaultValue={profile.primary_position_id ?? ''} key={`p1-${sport}`} className={sel}>
                  <option value="">Elige…</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                </select>
              </Field>
              <Field label="Posición secundaria" htmlFor="secondary_position_id" error={fe.secondary_position_id}>
                <select id="secondary_position_id" name="secondary_position_id" defaultValue={profile.secondary_position_id ?? ''} key={`p2-${sport}`} className={sel}>
                  <option value="">Ninguna</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                </select>
              </Field>
              <Field label="Ciudad" htmlFor="city"><input id="city" name="city" maxLength={120} defaultValue={profile.city ?? ''} className={inputClass} /></Field>
              <Field label="Nacionalidad" htmlFor="nationality" error={fe.nationality}>
                <select id="nationality" name="nationality" defaultValue={profile.nationality ?? ''} className={sel}>
                  <option value="">Elige…</option>
                  {ISO_COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </Field>
              <Field label="Altura (cm)" htmlFor="height_cm" error={fe.height_cm}><input id="height_cm" name="height_cm" type="number" inputMode="numeric" min={100} max={250} defaultValue={profile.height_cm ?? ''} className={inputClass} /></Field>
              <Field label="Peso (kg)" htmlFor="weight_kg" hint="Solo si es relevante en tu deporte" error={fe.weight_kg}><input id="weight_kg" name="weight_kg" type="number" inputMode="numeric" min={30} max={200} defaultValue={profile.weight_kg ?? ''} className={inputClass} /></Field>
              <Field label="Mano / pie dominante" htmlFor="dominant_side">
                <select id="dominant_side" name="dominant_side" defaultValue={profile.dominant_side ?? ''} className={sel}>
                  <option value="">No aplica</option><option value="right">Derecho</option><option value="left">Izquierdo</option><option value="both">Ambos</option>
                </select>
              </Field>
              <Field label="Años de experiencia" htmlFor="years_experience" error={fe.years_experience}><input id="years_experience" name="years_experience" type="number" inputMode="numeric" min={0} max={40} defaultValue={profile.years_experience ?? ''} className={inputClass} /></Field>
              <Field label="Club, academia, instituto o universidad actual" htmlFor="current_team"><input id="current_team" name="current_team" maxLength={160} defaultValue={profile.current_team ?? ''} className={inputClass} /></Field>
              <Field label="Liga" htmlFor="league"><input id="league" name="league" maxLength={120} placeholder="p. ej. Liga EBA, Junior Autonómica" defaultValue={profile.league ?? ''} className={inputClass} /></Field>
              <Field label="Nivel competitivo actual" htmlFor="competitive_level"><input id="competitive_level" name="competitive_level" maxLength={120} placeholder="p. ej. Nacional, Selección autonómica" defaultValue={profile.competitive_level ?? ''} className={inputClass} /></Field>
              <div className="sm:col-span-2">
                <Field label="Titular" htmlFor="headline" hint="Una línea que te presente (mín. 20 caracteres)"><input id="headline" name="headline" maxLength={160} defaultValue={profile.headline ?? ''} className={inputClass} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Presentación" htmlFor="bio"><textarea id="bio" name="bio" rows={4} maxLength={2000} defaultValue={profile.bio ?? ''} className={inputClass} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-paper sm:col-span-2"><input type="checkbox" name="open_to_opportunities" defaultChecked={profile.open_to_opportunities} className="h-4 w-4 accent-[var(--color-brass)]" />Abierto/a a oportunidades</label>
              <div className="sm:col-span-2"><SubmitButton>Guardar identidad</SubmitButton></div>
            </>
          )}
        </ActionForm>
      </Card>
    </div>
  );
}

function PhotoUpload({ athleteId, photoUrl }: { athleteId: string; photoUrl: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  function onFile(file?: File) {
    setError(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Solo JPG, PNG o WebP.');
    if (file.size > 5 * 1024 * 1024) return setError('Máximo 5 MB.');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${athleteId}/photo-${Date.now()}.${ext}`;
    start(async () => {
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage.from('athlete-photos').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return setError('No se ha podido subir la foto.');
      const res = await savePhotoPath(path);
      if (!res.ok) { await supabase.storage.from('athlete-photos').remove([path]); return setError('No se ha podido guardar.'); }
      router.refresh();
    });
  }
  return (
    <Card className="flex items-center gap-4">
      <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada */}
        {photoUrl ? <img src={photoUrl} alt="Tu foto actual" className="h-full w-full object-cover" /> : <Camera className="absolute inset-0 m-auto h-6 w-6 text-faint" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-paper">Foto deportiva</p>
        <p className="text-sm text-muted">Una foto tuya en acción o en pista. Solo la ve quien puede ver tu perfil.</p>
        {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
      </div>
      <label className="inline-flex cursor-pointer items-center rounded-full border border-line-strong px-4 py-2 text-sm text-paper hover:border-brass">
        {pending ? 'Subiendo…' : photoUrl ? 'Cambiar' : 'Subir foto'}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </Card>
  );
}

/* ------------------------------------------------------------------ Deportivo */
export function SportSection({ career, achievements }: { career: CareerEntry[]; achievements: { id: string; title: string; year: number | null; source: string; kind?: string; level?: string | null }[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Trayectoria deportiva">Equipos anteriores</CardTitle>
        {career.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {career.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="font-semibold text-paper">{c.team}</span><span className="block text-xs text-muted">{[c.league, `${c.season_from}${c.season_to ? ` → ${c.season_to}` : ''}`, c.role].filter(Boolean).join(' · ')}</span></span>
                <form action={deleteCareer}><input type="hidden" name="id" value={c.id} /><button aria-label={`Quitar ${c.team}`} className="rounded-lg p-2 text-faint hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button></form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addCareer} className="grid gap-3 sm:grid-cols-2">
          {(fe) => (
            <>
              <Field label="Equipo" htmlFor="c_team" error={fe.team}><input id="c_team" name="team" required minLength={2} maxLength={120} className={inputClass} /></Field>
              <Field label="Liga" htmlFor="c_league"><input id="c_league" name="league" maxLength={120} className={inputClass} /></Field>
              <Field label="Desde (temporada)" htmlFor="c_from" error={fe.season_from}><input id="c_from" name="season_from" required placeholder="2022-23" className={inputClass} /></Field>
              <Field label="Hasta" htmlFor="c_to" error={fe.season_to}><input id="c_to" name="season_to" placeholder="2024-25" className={inputClass} /></Field>
              <Field label="País" htmlFor="c_country"><select id="c_country" name="country" className={sel} defaultValue=""><option value="">—</option>{ISO_COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field>
              <Field label="Rol" htmlFor="c_role"><input id="c_role" name="role" maxLength={120} placeholder="Titular, capitana…" className={inputClass} /></Field>
              <div className="sm:col-span-2"><SubmitButton pendingText="Añadiendo…">Añadir equipo</SubmitButton></div>
            </>
          )}
        </ActionForm>
      </Card>

      <Card>
        <CardTitle kicker="Logros">Palmarés</CardTitle>
        {achievements.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {achievements.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="font-semibold text-paper">{a.title}</span><span className="block text-xs text-muted">{[ACHIEVEMENT_KIND_LABEL[(a.kind ?? 'other') as keyof typeof ACHIEVEMENT_KIND_LABEL], a.level && ACHIEVEMENT_LEVEL_LABEL[a.level as keyof typeof ACHIEVEMENT_LEVEL_LABEL], a.year].filter(Boolean).join(' · ')}</span></span>
                <span className="flex items-center gap-2"><ProvBadge source={a.source as DataSource} />
                  {a.source === 'self_reported' && <form action={deleteAchievement}><input type="hidden" name="id" value={a.id} /><button aria-label={`Quitar ${a.title}`} className="rounded-lg p-2 text-faint hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button></form>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addAchievement} className="grid gap-3 sm:grid-cols-2">
          {(fe) => (
            <>
              <div className="sm:col-span-2"><Field label="Logro" htmlFor="a_title" error={fe.title}><input id="a_title" name="title" required minLength={2} maxLength={160} placeholder="Campeona de España U18" className={inputClass} /></Field></div>
              <Field label="Tipo" htmlFor="a_kind"><select id="a_kind" name="kind" className={sel} defaultValue="championship">{Object.entries(ACHIEVEMENT_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Nivel" htmlFor="a_level"><select id="a_level" name="level" className={sel} defaultValue=""><option value="">—</option>{Object.entries(ACHIEVEMENT_LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Año" htmlFor="a_year" error={fe.year}><input id="a_year" name="year" type="number" inputMode="numeric" min={2000} max={2040} className={inputClass} /></Field>
              <Field label="Detalle" htmlFor="a_desc"><input id="a_desc" name="description" maxLength={600} className={inputClass} /></Field>
              <div className="sm:col-span-2"><SubmitButton pendingText="Añadiendo…">Añadir logro</SubmitButton></div>
            </>
          )}
        </ActionForm>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Estadísticas */
export function StatsSection({ stats, statDefs, sportId }: { stats: StatRow[]; statDefs: Catalog['statDefs']; sportId: string | null }) {
  const defs = statDefs.filter((d) => d.sport_id === sportId);
  const groups = new Map<string, StatRow[]>();
  for (const s of stats) groups.set(`${s.season}|${s.team}|${s.competition}`, [...(groups.get(`${s.season}|${s.team}|${s.competition}`) ?? []), s]);
  if (!sportId) return <Notice tone="warn">Elige primero tu deporte en Identidad: las estadísticas cambian según el deporte.</Notice>;
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Temporada → equipo → competición">Añadir estadística</CardTitle>
        <ActionForm action={addStat} className="grid gap-3 sm:grid-cols-2">
          {(fe) => (
            <>
              <Field label="Temporada" htmlFor="s_season" error={fe.season}><input id="s_season" name="season" required defaultValue={currentSeason()} className={inputClass} /></Field>
              <Field label="Estadística" htmlFor="s_def"><select id="s_def" name="stat_definition_id" required className={sel}>{defs.map((d) => <option key={d.id} value={d.id}>{d.label_es}{d.unit ? ` (${d.unit})` : ''}</option>)}</select></Field>
              <Field label="Equipo" htmlFor="s_team"><input id="s_team" name="team" maxLength={120} placeholder="Tu club o selección" className={inputClass} /></Field>
              <Field label="Competición" htmlFor="s_comp"><input id="s_comp" name="competition" maxLength={120} placeholder="Liga, torneo…" className={inputClass} /></Field>
              <Field label="Valor" htmlFor="s_value" error={fe.value}><input id="s_value" name="value" required type="number" inputMode="decimal" step="any" min={0} className={inputClass} /></Field>
              <div className="self-end"><SubmitButton pendingText="Guardando…">Guardar</SubmitButton></div>
            </>
          )}
        </ActionForm>
        <p className="mt-3 text-xs text-muted">Todo lo que añades aparece como <strong>Declarado</strong>. Una estadística verificada por tu club ya no se puede editar.</p>
      </Card>
      {[...groups.entries()].map(([k, rows]) => {
        const [season, team, comp] = k.split('|');
        return (
          <Card key={k}>
            <CardTitle kicker={season}>{[team || 'Sin equipo', comp].filter(Boolean).join(' · ')}</CardTitle>
            <ul className="divide-y divide-line">
              {rows.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted">{s.sport_stat_definitions?.label_es}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg tabular-nums text-paper">{s.value}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''}</span>
                    <ProvBadge source={s.source} />
                    {s.source === 'self_reported' && <form action={deleteStat}><input type="hidden" name="id" value={s.id} /><button aria-label="Borrar estadística" className="rounded-lg p-2 text-faint hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button></form>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Vídeo */
export function VideoSection({ videos }: { videos: AthleteVideo[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Highlight Reel · partidos · entrenamientos">Añadir vídeo</CardTitle>
        <ActionForm action={addVideo} className="grid gap-3 sm:grid-cols-2">
          {(fe) => (
            <>
              <Field label="Tipo" htmlFor="v_kind"><select id="v_kind" name="kind" className={sel} defaultValue={videos.some((v) => v.kind === 'highlight') ? 'full_game' : 'highlight'}>{Object.entries(VIDEO_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Temporada" htmlFor="v_season" error={fe.season}><input id="v_season" name="season" placeholder={currentSeason()} className={inputClass} /></Field>
              <div className="sm:col-span-2"><Field label="Enlace" htmlFor="v_url" hint="YouTube y Vimeo se ven dentro del Passport; Hudl, Drive u otros, como enlace" error={fe.url}><input id="v_url" name="url" required inputMode="url" placeholder="https://" className={inputClass} /></Field></div>
              <div className="sm:col-span-2"><Field label="Título" htmlFor="v_title"><input id="v_title" name="title" maxLength={120} placeholder="Highlights 2025-26" className={inputClass} /></Field></div>
              <label className="flex items-start gap-2 text-sm text-paper sm:col-span-2"><input type="checkbox" name="media_rights" className="mt-0.5 h-4 w-4 accent-[var(--color-brass)]" />Puedo publicar este vídeo y las personas que aparecen lo consienten.</label>
              {fe.media_rights && <p className="text-xs text-danger sm:col-span-2">{fe.media_rights}</p>}
              <div className="sm:col-span-2"><SubmitButton pendingText="Añadiendo…">Añadir vídeo</SubmitButton></div>
            </>
          )}
        </ActionForm>
      </Card>
      {videos.length > 0 && (
        <Card>
          <CardTitle kicker={`${videos.length} de 30`}>Tus vídeos</CardTitle>
          <ul className="divide-y divide-line">
            {videos.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0"><span className="flex items-center gap-2 font-semibold text-paper">{v.is_featured && <Star className="h-4 w-4 fill-current text-brass" aria-label="Destacado" />}{v.title ?? VIDEO_KIND_LABEL[v.kind]}</span><a href={v.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-brass">{v.url}</a></span>
                <span className="flex shrink-0 items-center gap-1">
                  {!v.is_featured && <form action={featureVideo}><input type="hidden" name="id" value={v.id} /><button className="rounded-full border border-line px-3 py-1.5 text-xs text-paper hover:border-brass">Destacar</button></form>}
                  <form action={deleteVideo}><input type="hidden" name="id" value={v.id} /><button aria-label="Borrar vídeo" className="rounded-lg p-2 text-faint hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button></form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Académico */
export function AcademicSection({ academics, languages }: { academics: AthleteAcademics | null; languages: { language_code: string; level: string }[] }) {
  const a = academics;
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Tu sistema educativo, tal cual">Perfil académico</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">Introduce tu nota en tu sistema original. No la convertimos a GPA: cada universidad aplica su propio método.</p>
        <ActionForm action={saveAcademics} className="grid gap-4 sm:grid-cols-2">
          {(fe) => (
            <>
              <Field label="Sistema educativo" htmlFor="education_system"><select id="education_system" name="education_system" className={sel} defaultValue={a?.education_system ?? ''}><option value="">Elige…</option>{Object.entries(EDUCATION_SYSTEM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Colegio, instituto o universidad" htmlFor="school_name"><input id="school_name" name="school_name" maxLength={160} defaultValue={a?.school_name ?? ''} className={inputClass} /></Field>
              <Field label="Nota media (como aparece en tu boletín)" htmlFor="grade_display" hint="p. ej. 8,7 / 10 · 16,5 / 20 · A*AA" error={fe.grade_display}><input id="grade_display" name="grade_display" maxLength={40} defaultValue={a?.grade_display ?? ''} className={inputClass} /></Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="Nota numérica" htmlFor="gpa" error={fe.gpa}><input id="gpa" name="gpa" type="number" inputMode="decimal" step="0.01" min={0} max={20} defaultValue={a?.gpa ?? ''} className={inputClass} /></Field>
                <Field label="Sobre" htmlFor="gpa_scale"><select id="gpa_scale" name="gpa_scale" className={sel} defaultValue={a?.gpa_scale ?? 10}>{[4, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
              </div>
              <Field label="Curso actual" htmlFor="school_year"><select id="school_year" name="school_year" className={sel} defaultValue={a?.school_year ?? ''}><option value="">—</option><option value="eso_3">3º ESO / Year 10</option><option value="eso_4">4º ESO / Year 11</option><option value="bach_1">1º Bachillerato / Year 12</option><option value="bach_2">2º Bachillerato / Year 13</option><option value="graduated">Graduado/a</option><option value="college">Universidad</option></select></Field>
              <Field label="Cambridge" htmlFor="cambridge_level"><select id="cambridge_level" name="cambridge_level" className={sel} defaultValue={a?.cambridge_level ?? ''}><option value="">—</option>{['b1', 'b2', 'c1', 'c2'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></Field>
              <Field label="TOEFL iBT" htmlFor="toefl_score" error={fe.toefl_score}><input id="toefl_score" name="toefl_score" type="number" inputMode="numeric" min={0} max={120} defaultValue={a?.toefl_score ?? ''} className={inputClass} /></Field>
              <Field label="IELTS" htmlFor="ielts_score" error={fe.ielts_score}><input id="ielts_score" name="ielts_score" type="number" inputMode="decimal" step="0.5" min={0} max={9} defaultValue={a?.ielts_score ?? ''} className={inputClass} /></Field>
              <Field label="Duolingo English Test" htmlFor="duolingo_score" error={fe.duolingo_score}><input id="duolingo_score" name="duolingo_score" type="number" inputMode="numeric" min={10} max={160} defaultValue={a?.duolingo_score ?? ''} className={inputClass} /></Field>
              <Field label="SAT" htmlFor="sat_score" error={fe.sat_score}><input id="sat_score" name="sat_score" type="number" inputMode="numeric" min={400} max={1600} defaultValue={a?.sat_score ?? ''} className={inputClass} /></Field>
              <Field label="ACT" htmlFor="act_score" error={fe.act_score}><input id="act_score" name="act_score" type="number" inputMode="numeric" min={1} max={36} defaultValue={a?.act_score ?? ''} className={inputClass} /></Field>
              {a && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted sm:col-span-2">Nota: <ProvBadge source={a.gpa_source ?? 'self_reported'} /> Inglés: <ProvBadge source={a.english_source ?? 'self_reported'} /> Exámenes: <ProvBadge source={a.tests_source ?? 'self_reported'} /></p>
              )}
              <div className="sm:col-span-2"><SubmitButton>Guardar académico</SubmitButton></div>
            </>
          )}
        </ActionForm>
      </Card>
      <Card>
        <CardTitle kicker="Idiomas">Otros idiomas</CardTitle>
        {languages.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {languages.map((l) => (
              <li key={l.language_code} className="flex items-center gap-1 rounded-full border border-line py-1 pl-3 pr-1 text-sm text-paper">
                {LANGS.find(([c]) => c === l.language_code)?.[1] ?? l.language_code} · {l.level === 'native' ? 'Nativo' : l.level.toUpperCase()}
                <form action={deleteLanguage}><input type="hidden" name="language_code" value={l.language_code} /><button aria-label="Quitar idioma" className="rounded-full p-1.5 text-faint hover:text-danger"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button></form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addLanguage} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          {() => (
            <>
              <Field label="Idioma" htmlFor="l_code"><select id="l_code" name="language_code" className={sel}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field>
              <Field label="Nivel" htmlFor="l_level"><select id="l_level" name="level" className={sel}>{['native', 'c2', 'c1', 'b2', 'b1', 'a2', 'a1'].map((l) => <option key={l} value={l}>{l === 'native' ? 'Nativo' : l.toUpperCase()}</option>)}</select></Field>
              <SubmitButton pendingText="…">Añadir</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Objetivos */
export function GoalsSection({ goals, budget, legacyDivisions }: { goals: AthleteGoals | null; budget: number | null; legacyDivisions: string[] }) {
  const pathways = new Set(goals?.pathways?.length ? goals.pathways : legacyDivisions);
  const countries = new Set(goals?.countries ?? []);
  return (
    <Card>
      <CardTitle kicker="My Opportunity Goals">Qué estás buscando</CardTitle>
      <p className="-mt-2 mb-5 text-sm text-muted">Con esto Gala Match te propondrá oportunidades que encajan contigo. Tu presupuesto nunca se muestra a nadie.</p>
      <ActionForm action={saveGoals} className="space-y-6">
        {(fe) => (
          <>
            {PATHWAY_GROUPS.map((g) => (
              <fieldset key={g.label}>
                <legend className="mb-2 text-sm font-semibold text-paper">{g.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.items.map(([k, label]) => (
                    <label key={k} className="cursor-pointer">
                      <input type="checkbox" name="pathways" value={k} defaultChecked={pathways.has(k)} className="peer sr-only" />
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-sm text-paper transition-colors peer-checked:border-brass peer-checked:bg-brass peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass"><Check className="h-3.5 w-3.5" aria-hidden />{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-paper">Países preferidos</legend>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {ISO_COUNTRIES.slice(0, 14).map(([c, n]) => (
                  <label key={c} className="cursor-pointer">
                    <input type="checkbox" name="countries" value={c} defaultChecked={countries.has(c)} className="peer sr-only" />
                    <span className="inline-block rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper peer-checked:border-brass peer-checked:bg-brass peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass">{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estados o regiones preferidas" htmlFor="regions" hint="Separadas por comas: Florida, California…"><input id="regions" name="regions" defaultValue={goals?.regions?.join(', ') ?? ''} className={inputClass} /></Field>
              <Field label="Carrera universitaria deseada" htmlFor="intended_majors" hint="Hasta 5, separadas por comas"><input id="intended_majors" name="intended_majors" defaultValue={goals?.intended_majors?.join(', ') ?? ''} className={inputClass} /></Field>
              <Field label="Tamaño de universidad" htmlFor="school_size"><select id="school_size" name="school_size" className={sel} defaultValue={goals?.school_size ?? ''}><option value="">—</option>{Object.entries(SCHOOL_SIZE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Nivel deportivo" htmlFor="sport_level"><select id="sport_level" name="sport_level" className={sel} defaultValue={goals?.sport_level ?? ''}><option value="">—</option>{Object.entries(SPORT_LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Beca necesaria" htmlFor="scholarship_need"><select id="scholarship_need" name="scholarship_need" className={sel} defaultValue={goals?.scholarship_need ?? ''}><option value="">—</option>{Object.entries(SCHOLARSHIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Campus" htmlFor="campus_setting"><select id="campus_setting" name="campus_setting" className={sel} defaultValue={goals?.campus_setting ?? ''}><option value="">—</option>{Object.entries(CAMPUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Fecha prevista de incorporación" htmlFor="start_term" error={fe.start_term}><input id="start_term" name="start_term" type="month" defaultValue={goals?.start_term ?? ''} className={inputClass} /></Field>
              <Field label="Presupuesto familiar máximo al año (USD)" htmlFor="annual_budget_usd" hint="Privado: solo tú y tu familia" error={fe.annual_budget_usd}><input id="annual_budget_usd" name="annual_budget_usd" type="number" inputMode="numeric" min={0} max={200000} step={500} defaultValue={budget ?? ''} className={inputClass} /></Field>
            </div>
            <SubmitButton>Guardar objetivos</SubmitButton>
          </>
        )}
      </ActionForm>
    </Card>
  );
}

/* ------------------------------------------------------------------ Privacidad */
export function PrivacySection({ profile, isMinor }: { profile: AthleteProfile; isMinor: boolean }) {
  return (
    <div className="space-y-5">
      {isMinor && <Notice tone="ok">Como eres menor, tu Passport nunca es público: solo lo ven organizaciones verificadas y tu familia. Tu contacto pasa siempre por la aprobación familiar.</Notice>}
      <Card>
        <CardTitle kicker="Tú decides">Quién ve cada parte</CardTitle>
        <ActionForm action={savePrivacy} className="space-y-5">
          {() => (
            <>
              {PRIVACY_BLOCKS.map((b) => (
                <fieldset key={b.key} className="rounded-2xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold text-paper">{b.label}</legend>
                  <p className="mb-3 text-xs text-muted">{b.text}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {VISIBILITY_OPTIONS.filter((o) => !(isMinor && o.value === 'public')).map((o) => (
                      <label key={o.value} className="cursor-pointer">
                        <input type="radio" name={b.key} value={o.value} defaultChecked={(profile[b.key] === 'connections' ? 'verified_orgs' : profile[b.key]) === o.value} className="peer sr-only" />
                        <span className="block h-full rounded-xl border border-line-strong px-3 py-2.5 text-sm transition-colors peer-checked:border-brass peer-checked:bg-brass/10 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brass">
                          <span className="block font-semibold text-paper">{o.label}</span><span className="block text-xs text-muted">{o.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <SubmitButton>Guardar privacidad</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>
      <Card>
        <CardTitle kicker="Siempre privado">Nunca se publica</CardTitle>
        <ul className="space-y-3">
          {FIXED_PRIVATE.map((f) => <li key={f.label} className="flex gap-3 text-sm"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden /><span><span className="font-semibold text-paper">{f.label}.</span> <span className="text-muted">{f.text}</span></span></li>)}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Compartir */
export function ShareSection({ profile, displayName, siteUrl, athleteId, isMinor }: { profile: AthleteProfile; displayName: string; siteUrl: string; athleteId: string; isMinor: boolean }) {
  const url = `${siteUrl}${profile.username ? `/athlete/${profile.username}` : `/athletes/${athleteId}`}`;
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin portapapeles */ }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: `${displayName} · Gala Passport`, url }); } catch { /* cancelado */ } } else copy();
  }
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Share Passport">Tu enlace</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <output className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-paper">{url}</output>
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-3 text-sm text-paper hover:border-brass sm:flex-none">{copied ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copiado' : 'Copiar'}</button>
            <button type="button" onClick={share} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brass px-4 py-3 text-sm font-semibold text-ink sm:flex-none"><Share2 className="h-4 w-4" aria-hidden />Compartir</button>
          </div>
        </div>
        {isMinor && <p className="mt-3 text-xs text-muted">Eres menor: este enlace solo lo abren organizaciones verificadas con sesión iniciada. Para un coach concreto, usa un enlace de recruiting (abajo), que crea tu familia.</p>}
        {!isMinor && (
          <ActionForm action={saveUsername} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
            {(fe) => (
              <>
                <div className="flex-1"><Field label="Nombre de tu enlace" htmlFor="username" hint="thegalaalliance.com/athlete/…" error={fe.username}><input id="username" name="username" required minLength={3} maxLength={30} pattern="[a-z0-9-]+" defaultValue={profile.username ?? suggestUsername(displayName)} className={inputClass} /></Field></div>
                <SubmitButton>Guardar enlace</SubmitButton>
              </>
            )}
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
