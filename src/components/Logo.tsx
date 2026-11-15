import Link from 'next/link';

/** Marca v2: monograma "G" en lima sobre Noche + THE GALA ALLIANCE en letra de marcador. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-2.5" aria-label="The Gala Alliance, inicio">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-night font-display text-lg font-bold text-lime transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"
        aria-hidden
      >
        G
      </span>
      <span className="whitespace-nowrap font-display text-[19px] font-bold tracking-[0.02em] text-paper">
        THE GALA ALLIANCE
      </span>
    </Link>
  );
}
