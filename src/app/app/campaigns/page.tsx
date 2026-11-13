import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { myOrganizations } from '@/lib/data/orgs';
import { CAMPAIGN_KIND_LABEL, COMPENSATION_LABEL, usd } from '@/lib/domain/labels';
import { Badge, ButtonLink, EmptyState, Notice, PageHeader, cx } from '@/components/ui';

export const metadata: Metadata = { title: 'Ofertas de marcas' };

type Campaign = {
  id: string; title: string; kind: string; compensation_kind: string; compensation_usd: number | null;
  application_deadline: string | null; status: string; organizations: { name: string } | null;
};

function CampaignCard({ c, showStatus }: { c: Campaign; showStatus?: boolean }) {
  return (
    <Link href={`/app/campaigns/${c.id}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/60">
      <span className="text-xs text-muted">{c.organizations?.name}</span>
      <span className="mt-1 font-display text-lg text-paper">{c.title}</span>
      <span className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{CAMPAIGN_KIND_LABEL[c.kind]}</Badge>
        <Badge tone="brass">{COMPENSATION_LABEL[c.compensation_kind]}{c.compensation_usd != null ? ` · ${usd(c.compensation_usd)}` : ''}</Badge>
        {showStatus && <Badge tone={c.status === 'published' ? 'ok' : 'warn'}>{c.status}</Badge>}
      </span>
      <span className="mt-auto pt-4 text-xs text-faint">{c.application_deadline ? `Plazo: ${c.application_deadline}` : 'Sin plazo'}</span>
    </Link>
  );
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await requireSession(['athlete', 'brand']);
  const { view } = await searchParams;
  const supabase = await createClient();
  const isBrand = session.roles.includes('brand');
  const mine = isBrand && view === 'mine';

  let rows: Campaign[] = [];
  if (mine) {
    const orgs = (await myOrganizations(session.userId)).filter((o) => o.type === 'brand');
    const ids = orgs.map((o) => o.id);
    const { data } = ids.length
      ? await supabase.from('brand_campaigns').select('id, title, kind, compensation_kind, compensation_usd, application_deadline, status, organizations(name)').in('brand_org_id', ids).order('created_at', { ascending: false })
      : { data: [] };
    rows = (data ?? []) as unknown as Campaign[];
  } else {
    const { data } = await supabase
      .from('brand_campaigns')
      .select('id, title, kind, compensation_kind, compensation_usd, application_deadline, status, organizations(name)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60);
    rows = (data ?? []) as unknown as Campaign[];
  }

  return (
    <>
      <PageHeader
        kicker="Marcas"
        title={mine ? 'Mis ofertas' : 'Ofertas de marcas'}
        description={mine ? 'Cada oferta se revisa antes de publicarse. Solo pueden aplicar atletas mayores de 18 años.' : 'Colaboraciones con marcas verificadas para atletas mayores de 18. Revisa siempre la normativa de tu universidad y de tu visado antes de aceptar.'}
        action={mine ? <ButtonLink href="/app/campaigns/new">Nueva oferta</ButtonLink> : undefined}
      />
      {isBrand && (
        <div className="mb-6 flex gap-1 rounded-full border border-line bg-surface p-1 text-sm sm:w-fit">
          {([['mine', 'Mis ofertas', '/app/campaigns?view=mine'], ['all', 'Publicadas', '/app/campaigns']] as const).map(([k, l, href]) => (
            <Link key={k} href={href} className={cx('rounded-full px-4 py-1.5', (mine ? 'mine' : 'all') === k ? 'bg-brass text-ink' : 'text-muted hover:text-paper')}>{l}</Link>
          ))}
        </div>
      )}
      {!isBrand && session.isMinor && <div className="mb-5"><Notice tone="neutral">Las ofertas de marcas estarán disponibles para ti cuando cumplas 18 años.</Notice></div>}
      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((c) => <li key={c.id}><CampaignCard c={c} showStatus={mine} /></li>)}</ul>
      ) : (
        <EmptyState title={mine ? 'Aún no has creado ofertas' : 'No hay ofertas publicadas ahora'} action={mine ? <ButtonLink href="/app/campaigns/new">Crear oferta</ButtonLink> : undefined} />
      )}
    </>
  );
}
