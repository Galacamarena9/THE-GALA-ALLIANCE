import { BadgeCheck, Check } from 'lucide-react';

/**
 * Gala Passport: la pieza visual firma de la marca (tarjeta deportiva + perfil de recruiting + informe de scouting).
 * Atleta FICTICIA con fines ilustrativos. Conserva el principio de procedencia: cada dato dice si es
 * declarado, documentado o confirmado por el club.
 */
export type Provenance = 'self' | 'doc' | 'club';

export const PROVENANCE: Record<Provenance, { label: string; cls: string }> = {
  self: { label: 'Declarado', cls: 'prov-self text-white/70' },
  doc: { label: 'Documentado', cls: 'prov-doc text-[#b9b2ff]' },
  club: { label: 'Confirmado por el club', cls: 'prov-club text-lime' },
};

const STATS: { value: string; unit?: string; label: string; source: Provenance }[] = [
  { value: '1,78', unit: 'm', label: 'Altura', source: 'self' },
  { value: '14,2', label: 'Puntos / partido', source: 'club' },
  { value: '8,7', label: 'Nota media', source: 'doc' },
  { value: 'C1', label: 'Inglés', source: 'doc' },
];

const CHECKS = ['Estadísticas confirmadas', 'Documentos académicos', 'Club verificado'];

export function ProvenanceMark({ source, withLabel = false }: { source: Provenance; withLabel?: boolean }) {
  const p = PROVENANCE[source];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`prov ${p.cls}`} aria-hidden />
      {withLabel ? <span className="text-[11px] text-white/75">{p.label}</span> : <span className="sr-only">{p.label}</span>}
    </span>
  );
}

function Readiness({ value }: { value: number }) {
  const r = 15.9155; // circunferencia 100
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" role="img" aria-label={`Recruiting Readiness ${value} de 100`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2.6" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-lime)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="100" className="ring-fill" style={{ ['--ring-offset' as string]: 100 - value, strokeDashoffset: 100 - value }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold" aria-hidden>{value}</span>
    </div>
  );
}

export function GalaPassport({ className = '', caption = true }: { className?: string; caption?: boolean }) {
  return (
    <figure className={className}>
      <div className="passport p-5 sm:p-6">
        <div className="court-lines pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" aria-hidden />
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[10px] text-white/60">Gala Passport</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold text-[#0a0a0c]"><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Verificado</span>
        </div>

        {/* Identidad */}
        <div className="mt-5 flex gap-4">
          <div className="passport-portrait relative h-[104px] w-[84px] shrink-0 overflow-hidden rounded-2xl sm:h-[120px] sm:w-[96px]" aria-hidden>
            <div className="court-lines absolute inset-0 opacity-60" />
            <span className="absolute -bottom-3 right-1 font-display text-[78px] font-bold leading-none text-white/25">07</span>
            <span className="absolute left-2.5 top-2 font-display text-2xl font-bold">LM</span>
          </div>
          <div className="min-w-0 self-end">
            <p className="font-display text-[2rem] font-bold uppercase leading-[0.9] sm:text-[2.4rem]">Lucía<br />Martínez</p>
            <p className="mt-2 text-xs text-white/70">Baloncesto · Base · Valencia · Promoción 2027</p>
          </div>
        </div>

        {/* Datos con procedencia */}
        <dl className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-2xl bg-white/10">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col bg-[#121216] px-2 py-3 text-center">
              <dt className="order-2 mt-1 flex items-center justify-center gap-1 text-[10px] leading-tight text-white/65"><ProvenanceMark source={s.source} />{s.label}</dt>
              <dd className="font-display text-2xl font-bold leading-none tabular-nums sm:text-[1.7rem]">{s.value}{s.unit ? <span className="ml-0.5 text-sm text-white/60">{s.unit}</span> : null}</dd>
            </div>
          ))}
        </dl>

        {/* Readiness + verificaciones */}
        <div className="mt-5 flex items-center gap-4">
          <Readiness value={72} />
          <div className="min-w-0">
            <p className="eyebrow text-[10px] text-white/60">Recruiting Readiness</p>
            <ul className="mt-1.5 space-y-1">
              {CHECKS.map((c) => <li key={c} className="flex items-center gap-1.5 text-xs text-white/90"><Check className="h-3.5 w-3.5 text-lime" aria-hidden />{c}</li>)}
            </ul>
          </div>
        </div>
      </div>
      {caption ? <figcaption className="mt-3 text-center text-[11px] text-faint">Ejemplo ilustrativo · atleta ficticia</figcaption> : null}
    </figure>
  );
}
