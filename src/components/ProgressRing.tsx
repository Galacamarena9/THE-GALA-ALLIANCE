/** Anillo de progreso animado (CSS, respeta "reducir movimiento"). */
export function ProgressRing({ value, label, size = 128 }: { value: number; label: string; size?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v} %`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="9" className="stroke-line" />
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="9" strokeLinecap="round" pathLength={100} strokeDasharray="100" className="ring-fill stroke-brass" style={{ ['--ring-offset' as string]: `${100 - v}`, strokeDashoffset: 100 - v }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-3xl font-bold tabular-nums text-paper">{v}%</span>
    </div>
  );
}
