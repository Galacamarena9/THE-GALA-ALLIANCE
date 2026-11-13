import Link from 'next/link';

/** Marca: monograma "G" en oro + THE GALA (oro) ALLIANCE (claro), como en la versión de Lovable. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex shrink-0 items-center gap-2.5" aria-label="The Gala Alliance, inicio">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brass to-brass-soft text-sm font-black text-ink shadow-[var(--shadow-gold)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"
        aria-hidden
      >
        G
      </span>
      <span className="flex items-baseline whitespace-nowrap text-[14px] tracking-[0.08em]">
        <span className="font-bold text-brass">THE GALA</span>
        <span className="ml-1 font-light text-paper/60">ALLIANCE</span>
      </span>
    </Link>
  );
}
