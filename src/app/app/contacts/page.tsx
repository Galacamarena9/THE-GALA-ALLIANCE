import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadAgencyCases } from '@/lib/data/agency-cases';
import { canWrite } from '@/lib/domain/agency-cases';
import { deleteContact } from '@/app/actions/agency-cases';
import { ContactForm } from '@/components/agency/CaseForms';
import { ButtonLink, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Universidades y coaches' };

export default async function ContactsPage() {
  const session = await requireSession(['agent']);
  const data = await loadAgencyCases(session.userId);
  if (!data.agencies.length) {
    return (
      <>
        <PageHeader kicker="Agencia" title="Universidades y coaches" />
        <EmptyState title="Primero, tu agencia" action={<ButtonLink href="/app/organization">Crear o unirme a una agencia</ButtonLink>}>
          Los contactos pertenecen a la agencia, no a una persona.
        </EmptyState>
      </>
    );
  }
  const supabase = await createClient();
  const { data: sports } = await supabase.from('sports').select('id, name_es').eq('active', true).order('name_es');
  const sportOpts = ((sports ?? []) as { id: string; name_es: string }[]).map((s) => ({ id: s.id, name: s.name_es }));
  const sportName = new Map(sportOpts.map((s) => [s.id, s.name]));
  const writable = data.agencies.filter((a) => canWrite(data.myRole.get(a.id)));

  const byInstitution = new Map<string, typeof data.contacts>();
  for (const c of data.contacts) byInstitution.set(c.institutionName, [...(byInstitution.get(c.institutionName) ?? []), c]);
  const casesByInstitution = new Map<string, number>();
  for (const c of data.cases) casesByInstitution.set(c.institutionName, (casesByInstitution.get(c.institutionName) ?? 0) + 1);

  return (
    <>
      <PageHeader
        kicker="Agencia"
        title="Universidades y coaches"
        description="Los programas con los que trabajáis y quién es vuestro contacto en cada uno. Solo tu agencia lo ve."
        action={<ButtonLink href="/app/pipeline" variant="ghost">Ver procesos</ButtonLink>}
      />
      {writable.length > 0 && (
        <details className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5" open={!data.contacts.length}>
          <summary className="cursor-pointer font-display text-xl font-bold uppercase text-paper">Añadir contacto</summary>
          <div className="mt-4"><ContactForm agencies={writable.map((a) => ({ id: a.id, name: a.name }))} sports={sportOpts} /></div>
        </details>
      )}
      {!byInstitution.size ? (
        <EmptyState title="Sin contactos todavía">Añade el primero: universidad, nombre y cargo bastan. El email solo si es el profesional.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...byInstitution].map(([inst, list]) => (
            <Card key={inst}>
              <CardTitle kicker={casesByInstitution.get(inst) ? `${casesByInstitution.get(inst)} proceso${casesByInstitution.get(inst)! > 1 ? 's' : ''}` : 'Sin procesos'}>{inst}</CardTitle>
              <ul className="space-y-3">
                {list.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-paper">{c.name}</p>
                      <p className="text-xs text-muted">{[c.roleTitle, c.sportId ? sportName.get(c.sportId) : null].filter(Boolean).join(' · ') || 'Sin cargo'}</p>
                      <p className="text-xs text-faint">
                        {c.email && <Link href={`mailto:${c.email}`} className="underline hover:text-brass">{c.email}</Link>}
                        {c.email && c.phone ? ' · ' : ''}{c.phone}
                      </p>
                      {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
                    </div>
                    {canWrite(data.myRole.get(c.agencyId)) && (
                      <form action={deleteContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-faint hover:text-danger" aria-label={`Borrar a ${c.name}`}>Borrar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
