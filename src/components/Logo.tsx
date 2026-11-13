import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="The Gala Alliance, inicio">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="13" fill="none" stroke="var(--color-brass)" strokeWidth="1.2" />
        <path d="M8 18.5 14 7l6 11.5M10.4 14h7.2" fill="none" stroke="var(--color-brass)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap font-display text-[15px] tracking-tight text-paper sm:text-[17px]">
        The Gala <span className="italic text-brass">Alliance</span>
      </span>
    </Link>
  );
}
