import Link from 'next/link';

/** Marca v4 «Élite deportiva»: monograma GA en oro sobre negro + THE GALA ALLIANCE en Anton. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-2.5">
      {/* Sin aria-label: el nombre accesible es el texto visible (WCAG 2.5.3, etiqueta en el nombre). */}
      <span
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] border border-brass-deep/60 bg-night font-display text-[15px] tracking-[0.04em] text-brass transition-transform duration-500 group-hover:-rotate-6"
        aria-hidden
      >
        GA
        <span className="absolute inset-x-1.5 bottom-1.5 h-px bg-brass-deep/70" />
      </span>
      <span className="whitespace-nowrap font-display text-[18px] tracking-[0.06em] text-paper">
        THE GALA ALLIANCE
      </span>
    </Link>
  );
}
