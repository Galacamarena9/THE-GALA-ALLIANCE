/** Carga de «Mis atletas»: la misma silueta (filtros + filas) para que nada salte. */
export default function Loading() {
  const bar = 'animate-pulse rounded-lg bg-surface-2';
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tus atletas…</span>
      <div className={`${bar} h-10 w-56`} />
      <div className={`${bar} h-11`} />
      <div className="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className={`${bar} h-12`} />)}</div>
    </div>
  );
}
