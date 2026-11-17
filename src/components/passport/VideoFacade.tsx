'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { videoEmbed } from '@/lib/domain/passport';

/**
 * Vídeo con carga bajo demanda: hasta que se pulsa "reproducir" no se contacta con YouTube/Vimeo
 * (privacidad y rendimiento). Plataformas no incrustables abren en una pestaña nueva.
 */
export function VideoFacade({ url, title, label, className = '' }: { url: string; title: string; label?: string; className?: string }) {
  const [play, setPlay] = useState(false);
  const e = videoEmbed(url);
  const frame = `relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`;

  if (!e.embedUrl) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={`${frame} group flex items-center justify-center court-lines`}>
        <span className="flex flex-col items-center gap-3 text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime text-[#0a0a0c] transition-transform group-hover:scale-105"><Play className="h-7 w-7 translate-x-0.5" aria-hidden /></span>
          <span className="text-sm font-semibold">Ver {label ?? 'vídeo'} en {e.host || 'la web'} ↗</span>
        </span>
      </a>
    );
  }
  if (play) {
    return (
      <div className={frame}>
        <iframe src={`${e.embedUrl}${e.embedUrl.includes('?') ? '&' : '?'}autoplay=1`} title={title} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setPlay(true)} className={`${frame} group flex items-center justify-center court-lines text-white`} aria-label={`Reproducir ${title}`}>
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
      <span className="relative flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime text-[#0a0a0c] shadow-lg transition-transform group-hover:scale-110"><Play className="h-7 w-7 translate-x-0.5" aria-hidden /></span>
        <span className="text-sm font-semibold">{label ?? 'Reproducir'}</span>
        <span className="text-[11px] text-white/70">Se cargará desde {e.provider === 'youtube' ? 'YouTube' : 'Vimeo'}</span>
      </span>
    </button>
  );
}
