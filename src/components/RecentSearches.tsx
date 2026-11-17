'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'gala:recent-university-searches';

/** Búsquedas recientes (solo en este navegador). Si el almacenamiento falla, simplemente no se muestran. */
export function RecentSearches({ current }: { current?: string }) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
      const next = current && current.trim().length >= 2 ? [current.trim(), ...prev.filter((x) => x !== current.trim())].slice(0, 6) : prev;
      localStorage.setItem(KEY, JSON.stringify(next));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar
      setItems(next.filter((x) => x !== current));
    } catch { /* sin almacenamiento */ }
  }, [current]);
  if (!items.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-faint">Recientes:</span>
      {items.map((q) => <Link key={q} href={`/app/universities?q=${encodeURIComponent(q)}`} className="rounded-full border border-line px-3 py-1.5 text-paper hover:border-brass">{q}</Link>)}
    </div>
  );
}
