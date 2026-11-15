import Link from 'next/link';
import { GUIDE, type GuideChapter } from '@/content/guide';
import { Badge } from '@/components/ui';

export function GuideIndex({ base }: { base: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {GUIDE.map((c, i) => (
        <li key={c.slug}>
          <Link href={`${base}/${c.slug}`} className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-brass/60">
            <span className="font-display text-sm italic text-brass">{String(i + 1).padStart(2, '0')}</span>
            <span className="mt-1 font-display text-xl text-paper">{c.title}</span>
            <span className="mt-2 text-sm text-muted">{c.summary}</span>
            <span className="mt-auto pt-4"><Badge>{c.audience}</Badge></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function GuideArticle({ chapter, base }: { chapter: GuideChapter; base: string }) {
  const idx = GUIDE.findIndex((c) => c.slug === chapter.slug);
  const next = GUIDE[idx + 1];
  return (
    <article className="max-w-3xl">
      <p className="text-[13px] font-semibold text-brass">Centro de información · {chapter.audience}</p>
      <h1 className="mt-2 text-4xl text-paper">{chapter.title}</h1>
      <p className="mt-3 text-lg text-muted">{chapter.summary}</p>
      <div className="mt-10 space-y-9">
        {chapter.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-2xl text-paper">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-3 leading-relaxed text-muted">{p}</p>)}
            {s.bullets && (
              <ul className="mt-4 space-y-2.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-3 leading-relaxed text-paper/90"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-brass" aria-hidden />{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <aside className="mt-12 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-sm font-medium text-paper">Fuentes oficiales</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {chapter.sources.map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{s.label} ↗</a></li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-faint">Revisado: {chapter.reviewed}. Las normas cambian; comprueba siempre la fuente oficial. Esta guía es informativa y no garantiza elegibilidad, admisión ni beca.</p>
      </aside>
      <div className="mt-8 flex justify-between text-sm">
        <Link href={base} className="text-muted hover:text-paper">← Todos los capítulos</Link>
        {next && <Link href={`${base}/${next.slug}`} className="text-brass hover:underline">{next.title} →</Link>}
      </div>
    </article>
  );
}
