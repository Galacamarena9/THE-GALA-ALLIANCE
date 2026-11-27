import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { AUDIENCES, audienceBySlug } from '@/content/audiences';
import { getT } from '@/lib/i18n/server-t';
import { publicMeta } from '@/lib/seo/page-meta';

export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = audienceBySlug(slug);
  if (!a) return { title: 'The Gala Alliance', robots: { index: false, follow: false } };
  const tx = await getT();
  return publicMeta({ title: tx(a.metaTitle), description: tx(a.metaDescription), path: `/para/${a.slug}`, locale: tx.locale });
}

/** Una página por audiencia: su problema, nuestra respuesta, lo que cuesta y UN camino claro (alta con su rol). */
export default async function ForAudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = audienceBySlug(slug);
  if (!a) notFound();
  const tx = await getT();
  return (
    <div lang={tx.locale}>
      <PublicHeader locale={tx.locale} />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-[13px] font-semibold text-brass">{tx(a.kicker)}</p>
        <h1 className="mt-3 max-w-4xl text-[40px] leading-tight text-paper sm:text-6xl">{tx(a.title)}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">{tx(a.lead)}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={a.primary.href} className="px-6 py-3" data-testid="audience-primary">{tx(a.primary.label)}</ButtonLink>
          {a.secondary && <ButtonLink href={a.secondary.href} variant="secondary" className="px-6 py-3">{tx(a.secondary.label)}</ButtonLink>}
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
          <div className="bg-ink p-7"><p className="text-xs uppercase tracking-wide text-faint">{tx('Hoy')}</p><p className="mt-2 text-lg text-muted">{tx(a.problem)}</p></div>
          <div className="bg-surface p-7"><p className="text-xs uppercase tracking-wide text-brass">{tx('Con The Gala Alliance')}</p><p className="mt-2 text-lg text-paper">{tx(a.answer)}</p></div>
        </div>
        <h2 className="mt-14 text-2xl text-paper">{tx('Tu espacio incluye')}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {a.services.map((s) => <li key={s} className="rounded-xl border border-line bg-surface p-4 text-paper">{tx(s)}</li>)}
        </ul>
        <p className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-paper" data-testid="audience-price">
          {tx(a.price)}{' '}<a href="/precios" className="font-semibold underline underline-offset-4">{tx('Ver todos los planes')}</a>
        </p>
        <p className="mt-6 text-sm text-muted">{tx('Además: oportunidades publicadas por organizaciones verificadas, guía oficial del proceso, calculadora del coste real y mensajes seguros.')}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={a.primary.href} className="px-6 py-3">{tx(a.primary.label)}</ButtonLink>
          <ButtonLink href="/guia" variant="secondary" className="px-6 py-3">{tx('Leer la guía')}</ButtonLink>
        </div>
      </main>
      <PublicFooter locale={tx.locale} audience={a.footer} />
    </div>
  );
}
