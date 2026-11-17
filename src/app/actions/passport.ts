'use server';

import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';
import { DIVISION_PATHWAYS, validUsername } from '@/lib/domain/passport';

const VIS = z.enum(['public', 'members', 'verified_orgs', 'connections', 'private']);
const txt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const int = (min: number, max: number) =>
  z.union([z.literal(''), z.coerce.number().int().min(min).max(max)]).optional().transform((v) => (v === '' || v == null ? null : v));
function fieldErrors(error: z.ZodError): FormState {
  const fe: Record<string, string> = {};
  for (const i of error.issues) fe[String(i.path[0])] = i.message;
  return { fieldErrors: fe, error: 'Revisa los campos marcados.' };
}

const profileSchema = z.object({
  headline: txt(160),
  bio: txt(2000),
  sport_id: z.string().min(1, 'Elige tu deporte'),
  primary_position_id: z.coerce.number().int().positive('Elige tu posición'),
  secondary_position_id: int(1, 100000),
  graduation_year: z.coerce.number().int().min(2020).max(2040),
  height_cm: int(100, 250),
  weight_kg: int(30, 200),
  dominant_side: z.enum(['left', 'right', 'both', '']).optional().transform((v) => v || null),
  current_team: txt(160),
  competitive_level: txt(120),
  league: txt(120),
  years_experience: int(0, 40),
  city: txt(120),
  nationality: z.string().trim().regex(/^([A-Z]{2})?$/, 'País no válido').optional().transform((v) => v || null),
  open_to_opportunities: z.literal('on').optional().transform(Boolean),
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  // La posición debe pertenecer al deporte elegido.
  const ids = [parsed.data.primary_position_id, parsed.data.secondary_position_id].filter((x): x is number => x != null);
  const { data: pos } = await supabase.from('sport_positions').select('id, sport_id').in('id', ids);
  if (!pos || pos.length !== ids.length || pos.some((p) => p.sport_id !== parsed.data.sport_id)) {
    return { fieldErrors: { primary_position_id: 'La posición no corresponde a ese deporte' } };
  }
  if (parsed.data.secondary_position_id === parsed.data.primary_position_id) {
    return { fieldErrors: { secondary_position_id: 'Debe ser distinta de la principal' } };
  }
  const { error } = await supabase.from('athlete_profiles').update(parsed.data).eq('user_id', session.userId);
  if (error) return { error: 'No se ha podido guardar. Inténtalo de nuevo.' };

  revalidatePath('/app/athlete', 'layout');
  await logEvent('passport_saved');
  return { ok: true, message: 'Guardado' };
}

const privacySchema = z.object({
  profile_visibility: VIS,
  sport_visibility: VIS,
  stats_visibility: VIS,
  academics_visibility: VIS,
  videos_visibility: VIS,
  goals_visibility: VIS,
});

export async function savePrivacy(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = privacySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Elige una opción para cada bloque.' };
  const data = { ...parsed.data };
  // Menores: nada público (la base de datos lo impone también).
  if (session.isMinor) {
    for (const k of Object.keys(data) as (keyof typeof data)[]) if (data[k] === 'public') data[k] = 'members';
  }
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_profiles').update(data).eq('user_id', session.userId);
  if (error) return { error: 'No se ha podido guardar la privacidad.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: session.isMinor ? 'Guardado. Como eres menor, nada es público.' : 'Privacidad guardada' };
}

export async function saveUsername(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  if (!validUsername(username)) return { fieldErrors: { username: 'De 3 a 30 caracteres: letras minúsculas, números y guiones.' } };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_profiles').update({ username }).eq('user_id', session.userId);
  if (error) return { fieldErrors: { username: error.code === '23505' ? 'Ese nombre ya está en uso' : 'Nombre no disponible' } };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Enlace guardado' };
}

const goalsSchema = z.object({
  school_size: z.enum(['small', 'medium', 'large', 'any', '']).optional().transform((v) => v || null),
  sport_level: z.enum(['top', 'competitive', 'development', 'any', '']).optional().transform((v) => v || null),
  scholarship_need: z.enum(['full', 'partial', 'none', 'unsure', '']).optional().transform((v) => v || null),
  campus_setting: z.enum(['urban', 'suburban', 'rural', 'any', '']).optional().transform((v) => v || null),
  start_term: z.string().trim().regex(/^(20[2-4][0-9]-(0[1-9]|1[0-2]))?$/, 'Formato AAAA-MM').optional().transform((v) => v || null),
});
const PATHWAYS = z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', 'intl_university', 'club', 'academy', 'professional', 'camp', 'showcase']);
const list = (raw: string, max: number, re?: RegExp) =>
  raw.split(',').map((x) => x.trim()).filter(Boolean).slice(0, max).filter((x) => (re ? re.test(x) : x.length <= 80));

export async function saveGoals(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = goalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const pathways = PATHWAYS.array().safeParse(formData.getAll('pathways'));
  if (!pathways.success) return { error: 'Camino no válido.' };
  const countries = formData.getAll('countries').map(String).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 10);
  const regions = list(String(formData.get('regions') ?? ''), 15);
  const intended_majors = list(String(formData.get('intended_majors') ?? ''), 5);

  const supabase = await createClient();
  const { error } = await supabase.from('athlete_goals').upsert(
    { athlete_id: session.userId, ...parsed.data, pathways: pathways.data, countries, regions, intended_majors },
    { onConflict: 'athlete_id' },
  );
  if (error) return { error: 'No se han podido guardar tus objetivos.' };
  // Compatibilidad con Gala Match actual: las divisiones de EE. UU. también en el perfil.
  const target_divisions = pathways.data.filter((p) => (DIVISION_PATHWAYS as readonly string[]).includes(p));
  await supabase.from('athlete_profiles').update({ target_divisions, intended_major: intended_majors[0] ?? null }).eq('user_id', session.userId);

  // El presupuesto va a una tabla privada (solo atleta y familia).
  const budget = int(0, 200000).safeParse(formData.get('annual_budget_usd') ?? '');
  if (!budget.success) return { fieldErrors: { annual_budget_usd: 'Importe no válido' } };
  const { error: finError } = await supabase
    .from('athlete_finances')
    .upsert({ athlete_id: session.userId, annual_budget_usd: budget.data }, { onConflict: 'athlete_id' });
  if (finError) return { error: 'Objetivos guardados, pero no el presupuesto. Inténtalo de nuevo.' };

  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Objetivos guardados' };
}

const videoSchema = z.object({
  kind: z.enum(['highlight', 'full_game', 'training', 'clip', 'season']),
  url: z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/, 'El enlace debe empezar por https://'),
  title: txt(120),
  season: z.string().trim().regex(/^(\d{4}(-\d{2,4})?)?$/, 'Formato: 2025-26').optional().transform((v) => v || null),
});

export async function addVideo(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = videoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  // Derechos de imagen: publicar un vídeo exige confirmar que se puede y que quien sale lo consiente.
  if (formData.get('media_rights') !== 'on') {
    return { fieldErrors: { media_rights: 'Confirma que puedes publicar este vídeo' }, error: 'Revisa los campos marcados.' };
  }
  const supabase = await createClient();
  await supabase.from('consents').insert({ user_id: session.userId, purpose: 'media_rights', document_version: 'media-2026-11', granted: true });
  // El primer Highlight Reel pasa a ser el vídeo destacado.
  let is_featured = false;
  if (parsed.data.kind === 'highlight') {
    const { count } = await supabase.from('athlete_videos').select('id', { count: 'exact', head: true }).eq('athlete_id', session.userId).eq('is_featured', true);
    is_featured = !count;
  }
  const { error } = await supabase.from('athlete_videos').insert({ athlete_id: session.userId, ...parsed.data, is_featured });
  if (error) return { error: error.message.includes('too_many_videos') ? 'Has llegado al máximo de 30 vídeos.' : 'No se ha podido guardar el vídeo.' };
  await logEvent('video_uploaded', { kind: parsed.data.kind });
  if (is_featured) await supabase.from('athlete_profiles').update({ highlight_video_url: parsed.data.url }).eq('user_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Vídeo añadido' };
}

export async function deleteVideo(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  const { data: v } = await supabase.from('athlete_videos').select('is_featured').eq('id', id).eq('athlete_id', session.userId).maybeSingle();
  await supabase.from('athlete_videos').delete().eq('id', id).eq('athlete_id', session.userId);
  if (v?.is_featured) await supabase.from('athlete_profiles').update({ highlight_video_url: null }).eq('user_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
}

export async function featureVideo(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  const { data: v } = await supabase.from('athlete_videos').select('url').eq('id', id).eq('athlete_id', session.userId).maybeSingle();
  if (!v) return;
  await supabase.from('athlete_videos').update({ is_featured: false }).eq('athlete_id', session.userId).eq('is_featured', true);
  await supabase.from('athlete_videos').update({ is_featured: true }).eq('id', id).eq('athlete_id', session.userId);
  await supabase.from('athlete_profiles').update({ highlight_video_url: v.url }).eq('user_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
}

const careerSchema = z.object({
  team: z.string().trim().min(2, 'Escribe el equipo').max(120),
  league: txt(120),
  country: z.string().trim().regex(/^([A-Z]{2})?$/).optional().transform((v) => v || null),
  season_from: z.string().trim().regex(/^\d{4}(-\d{2,4})?$/, 'Formato: 2023-24'),
  season_to: z.string().trim().regex(/^(\d{4}(-\d{2,4})?)?$/, 'Formato: 2024-25').optional().transform((v) => v || null),
  role: txt(120),
});

export async function addCareer(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = careerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_career').insert({ athlete_id: session.userId, ...parsed.data });
  if (error) return { error: 'No se ha podido guardar el equipo.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Equipo añadido' };
}

export async function deleteCareer(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('athlete_career').delete().eq('id', id).eq('athlete_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
}

const academicsSchema = z.object({
  gpa: z.union([z.literal(''), z.coerce.number().min(0).max(20)]).optional().transform((v) => (v === '' || v == null ? null : v)),
  gpa_scale: z.coerce.number().refine((v) => [4, 5, 10, 20].includes(v), 'Escala no válida').default(10),
  english_test: z.enum(['toefl', 'ielts', 'duolingo', 'cambridge', 'none', '']).optional().transform((v) => v || null),
  english_score: txt(20),
  sat_score: int(400, 1600),
  act_score: int(1, 36),
  school_year: z.enum(['eso_3', 'eso_4', 'bach_1', 'bach_2', 'graduated', 'college', '']).optional().transform((v) => v || null),
  education_system: z.enum(['es', 'us', 'uk', 'fr', 'it', 'de', 'pt', 'ib', 'latam', 'other', '']).optional().transform((v) => v || null),
  school_name: txt(160),
  grade_display: txt(40),
  toefl_score: int(0, 120),
  ielts_score: z.union([z.literal(''), z.coerce.number().min(0).max(9).multipleOf(0.5)]).optional().transform((v) => (v === '' || v == null ? null : v)),
  cambridge_level: z.enum(['b1', 'b2', 'c1', 'c2', '']).optional().transform((v) => v || null),
  duolingo_score: int(10, 160),
});

export async function saveAcademics(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = academicsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (parsed.data.gpa != null && parsed.data.gpa > parsed.data.gpa_scale) {
    return { fieldErrors: { gpa: 'La nota no puede superar la escala' } };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_academics').upsert({ athlete_id: session.userId, ...parsed.data }, { onConflict: 'athlete_id' });
  if (error) return { error: 'No se ha podido guardar el bloque académico.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Datos académicos guardados' };
}

const statSchema = z.object({
  stat_definition_id: z.coerce.number().int().positive(),
  season: z.string().trim().regex(/^\d{4}(-\d{2,4})?$/, 'Formato: 2025-26'),
  value: z.coerce.number().min(0).max(100000),
  team: z.string().trim().max(120).optional().transform((v) => v ?? ''),
  competition: z.string().trim().max(120).optional().transform((v) => v ?? ''),
});

export async function addStat(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = statSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_statistics').upsert(
    { athlete_id: session.userId, ...parsed.data, source: 'self_reported' },
    { onConflict: 'athlete_id,stat_definition_id,season,team,competition' },
  );
  if (error) return { error: error.code === '42501' ? 'Esa estadística ya está verificada: no se puede cambiar.' : 'No se ha podido guardar la estadística.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Estadística añadida' };
}

export async function deleteStat(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('athlete_statistics').delete().eq('id', id).eq('athlete_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
}

const languageSchema = z.object({
  language_code: z.string().regex(/^[a-z]{2}$/),
  level: z.enum(['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native']),
});

export async function addLanguage(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = languageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_languages').upsert({ athlete_id: session.userId, ...parsed.data }, { onConflict: 'athlete_id,language_code' });
  if (error) return { error: 'No se ha podido guardar el idioma.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Idioma guardado' };
}

export async function deleteLanguage(formData: FormData) {
  const session = await requireSession(['athlete']);
  const code = z.string().regex(/^[a-z]{2}$/).parse(formData.get('language_code'));
  const supabase = await createClient();
  await supabase.from('athlete_languages').delete().eq('athlete_id', session.userId).eq('language_code', code);
  revalidatePath('/app/athlete', 'layout');
}

const achievementSchema = z.object({
  title: z.string().trim().min(2, 'Escribe el logro').max(160),
  year: int(2000, 2040),
  description: txt(600),
  kind: z.enum(['championship', 'national_team', 'award', 'recognition', 'ranking', 'captaincy', 'academic', 'other']).default('other'),
  level: z.enum(['club', 'regional', 'national', 'international', '']).optional().transform((v) => v || null),
});

export async function addAchievement(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = achievementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_achievements').insert({ athlete_id: session.userId, ...parsed.data });
  if (error) return { error: 'No se ha podido guardar el logro.' };
  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Logro añadido' };
}

export async function deleteAchievement(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('athlete_achievements').delete().eq('id', id).eq('athlete_id', session.userId);
  revalidatePath('/app/athlete', 'layout');
}

/** Registra la foto ya subida al bucket privado (la ruta debe ser del propio atleta). */
export async function savePhotoPath(path: string | null): Promise<{ ok: boolean }> {
  const session = await requireSession(['athlete']);
  const supabase = await createClient();
  if (path !== null && !new RegExp(`^${session.userId}/[A-Za-z0-9._-]{1,80}$`).test(path)) return { ok: false };
  const { data: current } = await supabase.from('athlete_profiles').select('photo_path').eq('user_id', session.userId).maybeSingle();
  const { error } = await supabase.from('athlete_profiles').update({ photo_path: path }).eq('user_id', session.userId);
  if (error) return { ok: false };
  if (current?.photo_path && current.photo_path !== path) await supabase.storage.from('athlete-photos').remove([current.photo_path]);
  revalidatePath('/app/athlete', 'layout');
  return { ok: true };
}
