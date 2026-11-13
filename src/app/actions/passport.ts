'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const VIS = z.enum(['public', 'members', 'connections', 'private']);
const DIV = z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa']);
const txt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const int = (min: number, max: number) =>
  z.union([z.literal(''), z.coerce.number().int().min(min).max(max)]).optional().transform((v) => (v === '' || v == null ? null : v));
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^https:\/\/[^\s]+$/.test(v), 'El enlace debe empezar por https://');

function fieldErrors(error: z.ZodError): FormState {
  const fe: Record<string, string> = {};
  for (const i of error.issues) fe[String(i.path[0])] = i.message;
  return { fieldErrors: fe, error: 'Revisa los campos marcados.' };
}

const profileSchema = z.object({
  headline: txt(160),
  bio: txt(2000),
  sport_id: z.string().min(1),
  primary_position_id: z.coerce.number().int().positive(),
  secondary_position_id: int(1, 100000),
  graduation_year: z.coerce.number().int().min(2020).max(2040),
  height_cm: int(100, 250),
  dominant_side: z.enum(['left', 'right', 'both', '']).optional().transform((v) => v || null),
  current_team: txt(160),
  competitive_level: txt(120),
  city: txt(120),
  intended_major: txt(160),
  highlight_video_url: httpsUrl,
  open_to_opportunities: z.literal('on').optional().transform(Boolean),
  profile_visibility: VIS,
  stats_visibility: VIS,
  academics_visibility: VIS,
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const target_divisions = DIV.array().safeParse(formData.getAll('target_divisions'));
  if (!target_divisions.success) return { error: 'División no válida.' };

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
  // Menores: nunca perfil público indexable (la RLS también lo bloquea para anónimos).
  if (session.isMinor && parsed.data.profile_visibility === 'public') parsed.data.profile_visibility = 'members';

  const { error } = await supabase
    .from('athlete_profiles')
    .update({ ...parsed.data, target_divisions: target_divisions.data })
    .eq('user_id', session.userId);
  if (error) return { error: 'No se ha podido guardar. Inténtalo de nuevo.' };

  // El presupuesto va a una tabla privada (solo atleta y familia).
  const budget = int(0, 200000).safeParse(formData.get('annual_budget_usd') ?? '');
  if (!budget.success) return { fieldErrors: { annual_budget_usd: 'Importe no válido' } };
  const { error: finError } = await supabase
    .from('athlete_finances')
    .upsert({ athlete_id: session.userId, annual_budget_usd: budget.data }, { onConflict: 'athlete_id' });
  if (finError) return { error: 'Perfil guardado, pero no el presupuesto. Inténtalo de nuevo.' };

  revalidatePath('/app/athlete', 'layout');
  return { ok: true, message: 'Passport guardado' };
}

const academicsSchema = z.object({
  gpa: z.union([z.literal(''), z.coerce.number().min(0).max(20)]).optional().transform((v) => (v === '' || v == null ? null : v)),
  gpa_scale: z.coerce.number().refine((v) => [4, 5, 10, 20].includes(v), 'Escala no válida'),
  english_test: z.enum(['toefl', 'ielts', 'duolingo', 'cambridge', 'none', '']).optional().transform((v) => v || null),
  english_score: txt(20),
  sat_score: int(400, 1600),
  act_score: int(1, 36),
  school_year: z.enum(['eso_3', 'eso_4', 'bach_1', 'bach_2', 'graduated', 'college', '']).optional().transform((v) => v || null),
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
});

export async function addStat(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = statSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_statistics').upsert(
    { athlete_id: session.userId, ...parsed.data, source: 'self_reported' },
    { onConflict: 'athlete_id,stat_definition_id,season' },
  );
  if (error) return { error: 'No se ha podido guardar la estadística.' };
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
