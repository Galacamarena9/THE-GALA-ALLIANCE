import type { IconName } from '@/lib/domain/navigation';

/** Iconos lineales propios (sin librería externa), 20px, trazo 1.5. */
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9',
  showcase: 'M3 5h14v10H3zM3 12l4-3 3 2 3-3 4 3',
  trophy: 'M6 3h8v4a4 4 0 0 1-8 0V3zM6 5H3a3 3 0 0 0 3 3M14 5h3a3 3 0 0 1-3 3M10 11v3M7 17h6M8 14h4v3',
  campus: 'M2 8l8-4 8 4-8 4-8-4zM5 9.5V14c0 1 2.2 2 5 2s5-1 5-2V9.5M18 8v5',
  book: 'M4 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H4zM16 4h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5z',
  calc: 'M5 3h10v14H5zM7 6h6M7 10h1M10 10h1M13 10v4M7 13h1M10 13h1',
  spark: 'M10 2l1.8 4.7L16.5 8.5l-4.7 1.8L10 15l-1.8-4.7L3.5 8.5l4.7-1.8zM16 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  path: 'M4 16c4 0 2-6 6-6s2-6 6-6M4 16a1 1 0 1 0 0 .01M16 4a1 1 0 1 0 0 .01',
  id: 'M3 5h14v10H3zM6 9a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M5 13c.5-1.3 1.5-2 2.5-2s2 .7 2.5 2M12 8h3M12 11h3',
  inbox: 'M3 11l2-7h10l2 7v5H3zM3 11h4l1 2h4l1-2h4',
  megaphone: 'M3 8v4h3l6 4V4L6 8zM15 7.5a3 3 0 0 1 0 5M6 12l1 4h2l-1-4',
  handshake: 'M2 9l4-4 4 3 4-3 4 4M6 5l-2 7 4 4 2-2M14 5l2 7-4 4-2-2M8 13l2 2',
  family: 'M7 7a2 2 0 1 0 0-.01M14 8a1.5 1.5 0 1 0 0-.01M3 16c0-2.5 1.8-5 4-5s4 2.5 4 5M11.5 16c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5',
  pipeline: 'M3 5h4v10H3zM8 5h4v7H8zM13 5h4v4h-4z',
  list: 'M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  building: 'M4 17V4h8v13M12 8h4v9M2 17h16M6 7h2M6 10h2M6 13h2M14 11h.01M14 14h.01',
  shield: 'M10 2l6 2.5V9c0 4-2.7 6.8-6 8-3.3-1.2-6-4-6-8V4.5zM7.5 10l2 2 3-3.5',
  chat: 'M3 5h14v9H8l-4 3v-3H3zM6 9h8M6 11.5h5',
  news: 'M3 4h11v12H5a2 2 0 0 1-2-2zM14 7h3v7a2 2 0 0 1-2 2M6 7h5M6 10h5M6 13h3',
  users: 'M7 8a2.5 2.5 0 1 0 0-.01M2.5 16c0-2.7 2-4.5 4.5-4.5s4.5 1.8 4.5 4.5M13 6a2 2 0 1 1 0 4M13.5 12c2 .3 3.5 1.8 3.5 4',
};

export function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
