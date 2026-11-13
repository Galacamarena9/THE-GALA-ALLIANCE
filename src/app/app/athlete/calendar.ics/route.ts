import { createClient } from '@/lib/supabase/server';

/** Exporta los plazos del atleta como calendario (.ics) para Google Calendar, Apple o Outlook. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const day = (d: string) => d.replace(/-/g, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response('auth_required', { status: 401 });

  const { data: apps } = await supabase
    .from('applications')
    .select('id, status, opportunities(id, title, deadline, organizations(name))')
    .eq('athlete_id', auth.user.id)
    .neq('status', 'withdrawn');

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const events = (apps ?? [])
    .map((a) => a.opportunities as unknown as { id: string; title: string; deadline: string | null; organizations: { name: string } | null } | null)
    .filter((o): o is NonNullable<typeof o> => Boolean(o?.deadline))
    .map((o) => [
      'BEGIN:VEVENT',
      `UID:${o.id}@thegalaalliance`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${day(o.deadline!)}`,
      `SUMMARY:${esc(`Plazo: ${o.title} (${o.organizations?.name ?? ''})`)}`,
      `URL:${site}/app/opportunities/${o.id}`,
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc('Queda una semana para el plazo')}`,
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n'));

  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Gala Alliance//Plazos//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:The Gala Alliance · Plazos', ...events, 'END:VCALENDAR'].join('\r\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="the-gala-alliance-plazos.ics"', 'Cache-Control': 'no-store' },
  });
}
