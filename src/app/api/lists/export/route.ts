import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { csvCell } from '@/lib/domain/agency-cases';
import { siteUrl } from '@/lib/env';

/**
 * Exporta una lista guardada a CSV. Solo incluye lo que el directorio ya deja ver al usuario
 * (la RLS decide); un atleta que haya dejado de ser visible sale como «No disponible».
 */
export async function GET(req: NextRequest) {
  const list = req.nextUrl.searchParams.get('list')?.slice(0, 80);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse('Unauthorized', { status: 401 });

  let q = supabase.from('saved_athletes').select('athlete_id, list_name, private_note, created_at').eq('owner_id', auth.user.id).order('created_at').limit(2000);
  if (list) q = q.eq('list_name', list);
  const { data: saved } = await q;
  const ids = [...new Set((saved ?? []).map((s) => s.athlete_id))];
  const [{ data: dir }, { data: sports }, { data: positions }] = await Promise.all([
    ids.length ? supabase.from('athlete_directory').select('user_id, display_name, country, sport_id, primary_position_id, graduation_year, height_cm, current_team, has_video').in('user_id', ids) : Promise.resolve({ data: [] }),
    supabase.from('sports').select('id, name_es'),
    supabase.from('sport_positions').select('id, name_es'),
  ]);
  const byId = new Map(((dir ?? []) as Record<string, unknown>[]).map((d) => [d.user_id as string, d]));
  const sportName = new Map(((sports ?? []) as { id: string; name_es: string }[]).map((s) => [s.id, s.name_es]));
  const posName = new Map(((positions ?? []) as { id: number; name_es: string }[]).map((p) => [p.id, p.name_es]));

  const head = ['Lista', 'Atleta', 'País', 'Deporte', 'Posición', 'Promoción', 'Altura (cm)', 'Equipo', 'Vídeo', 'Mi nota', 'Perfil', 'Guardado'];
  const rows = (saved ?? []).map((s) => {
    const d = byId.get(s.athlete_id);
    if (!d) return [s.list_name, 'No disponible', '', '', '', '', '', '', '', s.private_note, '', s.created_at.slice(0, 10)];
    return [
      s.list_name, d.display_name as string, d.country as string, sportName.get(d.sport_id as string) ?? '',
      posName.get(d.primary_position_id as number) ?? '', d.graduation_year as number, d.height_cm as number,
      d.current_team as string, d.has_video ? 'Sí' : 'No', s.private_note, `${siteUrl()}/athletes/${s.athlete_id}`, s.created_at.slice(0, 10),
    ];
  });
  const csv = [head, ...rows].map((r) => r.map((c) => csvCell(c as string | number | null)).join(',')).join('\r\n') + '\r\n';
  const name = (list ?? 'listas').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lista';
  return new NextResponse(`﻿${csv}`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'Cache-Control': 'no-store' },
  });
}
