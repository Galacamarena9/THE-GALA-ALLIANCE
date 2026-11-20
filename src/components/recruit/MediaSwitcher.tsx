'use client';

import { useState } from 'react';
import { VideoFacade } from '@/components/passport/VideoFacade';

type V = { id: string; kind: string; title: string | null; url: string };
const KIND: Record<string, string> = { highlight: 'Highlight', full_game: 'Partido completo', clip: 'Clip' };

/**
 * Revisión de vídeo para coaches: cambiar entre highlight, partido completo y clips sin salir de la ficha.
 * La velocidad de reproducción la controla el propio reproductor (YouTube/Vimeo) desde su menú de ajustes.
 */
export function MediaSwitcher({ videos, athlete }: { videos: V[]; athlete: string }) {
  const ordered = [...videos].sort((a, b) => (a.kind === 'highlight' ? -1 : b.kind === 'highlight' ? 1 : a.kind === 'full_game' ? -1 : b.kind === 'full_game' ? 1 : 0));
  const [i, setI] = useState(0);
  const v = ordered[i];
  if (!v) return null;
  return (
    <div>
      {ordered.length > 1 && (
        <div role="tablist" aria-label="Vídeos del atleta" className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {ordered.map((x, k) => (
            <button key={x.id} role="tab" type="button" aria-selected={k === i} onClick={() => setI(k)}
              className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold ${k === i ? 'border-brass bg-brass/10 text-brass' : 'border-line text-paper hover:border-brass/50'}`}>
              {x.title || KIND[x.kind] || x.kind}
            </button>
          ))}
        </div>
      )}
      {/* key: al cambiar de vídeo se vuelve a la portada (no se precarga el siguiente). */}
      <VideoFacade key={v.id} url={v.url} title={`${athlete} · ${v.title ?? KIND[v.kind] ?? v.kind}`} label={KIND[v.kind]} />
      <p className="mt-2 text-[11px] text-faint">Velocidad y calidad: desde los ajustes del reproductor.</p>
    </div>
  );
}
