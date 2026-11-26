import Link from 'next/link';

/** Marca v6 «Estadio»: monograma GA en verde sobre flúor, inclinado como un dorsal + THE GALA ALLIANCE en Archivo ancha. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-2.5">
      {/* Sin aria-label: el nombre accesible es el texto visible (WCAG 2.5.3, etiqueta en el nombre). */}
      <span
        className="relative flex h-9 w-9 -skew-x-[10deg] items-center justify-center overflow-hidden bg-lime font-display text-[14px] text-night transition-transform duration-500 group-hover:-rotate-6"
        aria-hidden
      >
        GA
      </span>
      <span className="whitespace-nowrap font-display text-[17px] tracking-[0.01em] text-paper">
        THE GALA ALLIANCE
      </span>
    </Link>
  );
}
