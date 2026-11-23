'use client';

import { Pause, Play } from 'lucide-react';
import { useState } from 'react';

/** Botón para pausar todo el movimiento de la portada (WCAG 2.2.2): animaciones CSS y el vídeo de fondo. */
export function MotionToggle({ className = '' }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  function toggle() {
    const next = !paused;
    setPaused(next);
    document.documentElement.classList.toggle('motion-paused', next);
    document.querySelectorAll('video').forEach((v) => { if (next) v.pause(); else void v.play().catch(() => {}); });
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={paused}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-paper/25 px-4 text-xs font-semibold text-paper/80 backdrop-blur-sm transition-colors hover:border-brass hover:text-brass ${className}`}>
      {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
      {paused ? 'Reanudar movimiento' : 'Pausar movimiento'}
    </button>
  );
}
