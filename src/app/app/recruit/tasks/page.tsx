import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { currentRecruitOrg, loadMembers } from '@/lib/data/recruit';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { OrgTaskForm } from '@/components/recruit/RecruitForms';
import { toggleOrgTask } from '@/app/actions/recruit';

export const metadata: Metadata = { title: 'Tareas del equipo' };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ org?: string; mine?: string; done?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();
  let q = org ? supabase.from('org_tasks').select('id, title, due_date, priority, status, assignee_id, athlete_id').eq('organization_id', org.id).eq('status', sp.done ? 'done' : 'open').order('due_date', { ascending: true, nullsFirst: false }).limit(200) : null;
  if (q && sp.mine) q = q.eq('assignee_id', session.userId);
  const [{ data: tasks }, members] = org && q ? await Promise.all([q, loadMembers(org.id)]) : [{ data: [] }, []];
  const ids = [...new Set((tasks ?? []).map((t) => t.athlete_id).filter(Boolean))] as string[];
  const { data: dir } = ids.length ? await supabase.from('athlete_directory').select('user_id, display_name').in('user_id', ids) : { data: [] };
  const names = new Map((dir ?? []).map((d) => [d.user_id, d.display_name]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader kicker="Recruiting" title="Tareas del equipo" description="Quién hace qué y cuándo, sin duplicar trabajo." />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/tasks">
        {org && (
          <div className="space-y-4">
            <nav aria-label="Filtros" className="flex gap-2 text-xs">
              <Link href="/app/recruit/tasks" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${!sp.mine && !sp.done ? 'border-brass text-brass' : 'border-line text-muted'}`}>Abiertas</Link>
              <Link href="/app/recruit/tasks?mine=1" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${sp.mine ? 'border-brass text-brass' : 'border-line text-muted'}`}>Mías</Link>
              <Link href="/app/recruit/tasks?done=1" className={`inline-flex min-h-9 items-center rounded-full border px-3 ${sp.done ? 'border-brass text-brass' : 'border-line text-muted'}`}>Hechas</Link>
            </nav>
            {(tasks ?? []).length ? (
              <Card className="p-0">
                <ul className="divide-y divide-line">
                  {(tasks ?? []).map((t) => (
                    <li key={t.id} className="flex items-center gap-3 p-3">
                      <form action={toggleOrgTask}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.status === 'done' ? '0' : '1'} /><button aria-label={t.status === 'done' ? `Reabrir ${t.title}` : `Marcar hecha ${t.title}`} className={`grid h-7 w-7 place-items-center rounded-md border ${t.status === 'done' ? 'border-brass bg-brass text-white' : 'border-line'}`}>{t.status === 'done' ? '✓' : ''}</button></form>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${t.status === 'done' ? 'text-muted line-through' : 'text-paper'}`}>{t.title}</p>
                        <p className="text-xs text-muted">{t.athlete_id && names.get(t.athlete_id) ? <Link href={`/app/recruit/candidates/${t.athlete_id}`} className="text-brass">{names.get(t.athlete_id)}</Link> : null}{t.assignee_id ? ` · ${memberName.get(t.assignee_id) ?? ''}` : ' · Sin asignar'}</p>
                      </div>
                      {t.priority === 'high' && <Badge tone="warn">Alta</Badge>}
                      <span className={`text-xs ${t.due_date && t.due_date < today && t.status === 'open' ? 'font-semibold text-danger' : 'text-muted'}`}>{t.due_date ?? 'Sin fecha'}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : <EmptyState title="Sin tareas">Crea tareas para el equipo, por ejemplo «Ver partido completo de Lucía — viernes».</EmptyState>}
            {org.caps.has('tasks') && <Card><OrgTaskForm org={org.id} members={members.map((m) => ({ id: m.id, name: m.name }))} /></Card>}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
