import { Card, CardTitle } from '@/components/ui';
import { TRUST_LABEL, type RedFlag, type TrustLevel } from '@/lib/domain/trust';

/** Sello de confianza en 5 niveles + señales de alarma. Describe lo comprobado; no es una garantía. */
export function TrustSeal({ level, checks, flags }: { level: TrustLevel; checks: { label: string; ok: boolean }[]; flags: RedFlag[] }) {
  return (
    <Card>
      <CardTitle kicker="Sello de confianza" action={<span className="font-display text-3xl tabular-nums text-paper">{level}<span className="text-base text-faint">/5</span></span>}>
        {TRUST_LABEL[level]}
      </CardTitle>
      <div className="mb-4 flex gap-1" role="img" aria-label={`Nivel ${level} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= level ? 'bg-brass' : 'bg-line'}`} />
        ))}
      </div>
      <ul className="space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? 'text-paper' : 'text-faint'}>
            <span aria-hidden>{c.ok ? '✓' : '○'}</span> <span className="sr-only">{c.ok ? 'Comprobado:' : 'Pendiente:'}</span> {c.label}
          </li>
        ))}
      </ul>
      {flags.length > 0 && (
        <div className="mt-5 rounded-xl border border-warn/40 bg-warn/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-warn">Señales de alarma</p>
          <ul className="mt-2 space-y-1.5 text-sm text-paper">
            {flags.map((f) => (
              <li key={f.code}><span className={f.severity === 'high' ? 'text-danger' : 'text-warn'}>{f.severity === 'high' ? 'Grave' : 'Atención'}:</span> {f.text}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-faint">El sello describe qué se ha comprobado de la oferta y de quién la publica. No garantiza la beca ni la admisión.</p>
    </Card>
  );
}
