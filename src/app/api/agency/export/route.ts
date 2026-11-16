import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { casesToCsv } from '@/lib/domain/agency-cases';
import { createClient } from '@/lib/supabase/server';

/** Exportación CSV de los procesos de las agencias del usuario. La RLS limita las filas a sus agencias. */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!session.roles.includes('agent')) return new NextResponse('Forbidden', { status: 403 });
  const data = await loadAgencyCases(session.userId);
  const supabase = await createClient();
  const { data: sports } = await supabase.from('sports').select('id, name_es');
  const sportName = new Map(((sports ?? []) as { id: string; name_es: string }[]).map((s) => [s.id, s.name_es]));
  const csv = casesToCsv(data.cases.map((c) => ({
    athlete: c.athleteName, institution: c.institutionName, sport: c.sportId ? sportName.get(c.sportId) ?? c.sportId : null,
    cycle: c.cycle, stage: c.stage, owner: c.ownerName, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt,
  })));
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="procesos-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
