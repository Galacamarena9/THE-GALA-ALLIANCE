import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';

/**
 * Exportación controlada de una shortlist: solo datos de recruiting permitidos (lo que la vista enmascarada deja ver)
 * y nunca datos de contacto, documentos ni notas. Requiere el permiso "export" en la organización.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  const list = request.nextUrl.searchParams.get('list') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(list)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const supabase = await createClient();
  const { data: sl } = await supabase.from('org_shortlists').select('id, name, organization_id').eq('id', list).maybeSingle();
  if (!sl) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { data: allowed } = await supabase.rpc('org_can', { p_org: sl.organization_id, p_cap: 'export' });
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { data: members } = await supabase.from('org_shortlist_members').select('athlete_id, review_status, priority, fit_at_add').eq('shortlist_id', list);
  const ids = (members ?? []).map((m) => m.athlete_id);
  const { data: dir } = ids.length ? await supabase.from('athlete_directory').select('user_id, display_name, graduation_year, country, height_cm, has_video').in('user_id', ids) : { data: [] };
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  const lines = [['Nombre', 'Clase', 'País', 'Altura (cm)', 'Vídeo', 'Revisión', 'Prioridad', 'Encaje al añadir (%)'].join(',')];
  for (const m of members ?? []) {
    const d = (dir ?? []).find((x) => x.user_id === m.athlete_id);
    if (!d) continue; // ya no comparte su perfil: no se exporta
    lines.push([d.display_name, d.graduation_year, d.country, d.height_cm, d.has_video ? 'sí' : 'no', m.review_status === 'reviewed' ? 'revisado' : 'por revisar', m.priority ? 'sí' : 'no', m.fit_at_add ?? ''].map(esc).join(','));
  }
  await logEvent('candidates_exported', { rows: lines.length - 1 });
  return new Response(`﻿${lines.join('\n')}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="shortlist-${sl.name.replace(/[^\w-]+/g, '_').slice(0, 40)}.csv"`, 'Cache-Control': 'no-store' } });
}
