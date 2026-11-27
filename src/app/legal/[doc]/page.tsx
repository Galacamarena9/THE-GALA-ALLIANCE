import type { Metadata } from 'next';
import { publicMeta } from '@/lib/seo/page-meta';
import { notFound } from 'next/navigation';
import { LEGAL, legalDoc } from '@/content/legal';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';

export function generateStaticParams() {
  return LEGAL.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = legalDoc(doc);
  if (!d) return { title: 'Legal', robots: { index: false, follow: true } };
  return publicMeta({ title: d.title, description: `${d.title} de The Gala Alliance: qué hacemos, con qué base y cómo ejercer tus derechos.`, path: `/legal/${d.slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = legalDoc(doc);
  if (!d) notFound();
  return (
    <>
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-14">
        <p className="mb-3 inline-block rounded border border-warn/50 px-2 py-0.5 text-xs text-warn">Borrador · pendiente de revisión jurídica</p>
        <h1 className="text-4xl text-paper">{d.title}</h1>
        <div className="mt-8 space-y-8">
          {d.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl text-paper">{s.heading}</h2>
              {s.body.map((b) => <p key={b} className="mt-2 leading-relaxed text-muted">{b}</p>)}
            </section>
          ))}
        </div>
        <p className="mt-10 text-xs text-faint">Última actualización: noviembre de 2026.</p>
      </main>
      <PublicFooter />
    </>
  );
}
