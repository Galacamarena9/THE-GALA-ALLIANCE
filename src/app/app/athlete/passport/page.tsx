import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { Badge, ButtonLink, Card, CardTitle, PageHeader } from '@/components/ui';
import { AthleteLinkForm } from '@/components/forms';
import { createClient } from '@/lib/supabase/server';
import { LINK_KIND_LABEL, domainOf } from '@/lib/domain/labels';
import { deleteAthleteLink } from '@/app/actions/marketplace';
import { PassportEditor } from './PassportEditor';

export const metadata: Metadata = { title: 'Opportunity Passport' };

export default async function PassportPage() {
  const session = await requireSession(['athlete']);
  const supabase = await createClient();
  const [passport, catalog, { data: links }] = await Promise.all([
    loadPassport(session.userId),
    loadCatalog(),
    supabase.from('athlete_links').select('id, kind, url, verified').eq('athlete_id', session.userId).order('created_at'),
  ]);

  return (
    <>
      <PageHeader
        kicker={`Opportunity Passport · ${passport.readiness.score}% preparado`}
        title="Tu perfil para universidades"
        description="Todo lo que un coach necesita para evaluarte. Tú decides qué ve cada actor, bloque a bloque."
        action={<ButtonLink href={`/athletes/${session.userId}`} variant="secondary">Ver como lo ven otros</ButtonLink>}
      />
      <PassportEditor
        isMinor={session.isMinor}
        profile={passport.profile}
        academics={passport.academics}
        stats={passport.stats}
        languages={passport.languages}
        achievements={passport.achievements}
        catalog={catalog}
        annualBudgetUsd={passport.annualBudgetUsd}
      />
      <Card id="enlaces" className="mt-5">
        <CardTitle kicker="Bloque 6 · Confianza">Enlaces oficiales que respaldan tu perfil</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">Tu ficha en la web del club, las estadísticas de la federación, tu ranking oficial o un partido completo. Los revisamos y los marcamos como verificados: es lo que más confianza da a un coach que no te conoce.</p>
        {links && links.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate"><span className="text-paper">{LINK_KIND_LABEL[l.kind]}</span> · <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brass">{domainOf(l.url)} ↗</a></span>
                <span className="flex items-center gap-3">
                  <Badge tone={l.verified ? 'ok' : 'neutral'}>{l.verified ? 'Verificado' : 'Pendiente'}</Badge>
                  <form action={deleteAthleteLink}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-faint hover:text-danger">Quitar</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <AthleteLinkForm />
      </Card>
    </>
  );
}
