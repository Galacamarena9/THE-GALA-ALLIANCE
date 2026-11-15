/** Esqueleto animado mientras carga cualquier pantalla de la app (la cabecera y el menú ya están pintados). */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando">
      <div className="skeleton h-40 rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-[var(--radius-card)]" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="skeleton h-72 rounded-[var(--radius-card)]" />
        <div className="skeleton h-72 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
