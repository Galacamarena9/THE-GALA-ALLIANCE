import { BadgeCheck, CircleAlert, CircleCheck, Eye } from 'lucide-react';

/**
 * Vista previa ilustrativa de Gala Match. Datos ficticios y marcados como ejemplo.
 * Los criterios son los mismos que evalúa el motor real (src/lib/domain/match.ts, rules-1.0):
 * la puntuación es COMPATIBILIDAD explicada, nunca probabilidad de beca.
 */
const MET = ['Posición buscada', 'Año de graduación aceptado', 'Nota mínima', 'Coste neto dentro de tu presupuesto'];
const MISSING = ['Certificado de inglés pendiente', 'Falta un partido completo en vídeo'];

export function MatchPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 text-paper shadow-[var(--shadow-premium)]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-brass">Gala Match · ejemplo</p>
          <p className="mt-1 truncate text-base font-bold">Beca parcial · State University</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <BadgeCheck className="h-3.5 w-3.5 text-ok" aria-hidden />NCAA D-I · organización verificada
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold leading-none">92<span className="text-lg text-faint">%</span></p>
          <p className="text-xs text-ok">Encaje alto</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold text-paper">Por qué encajas</p>
        <ul className="space-y-1.5 text-xs">
          {(compact ? MET.slice(0, 3) : MET).map((t) => (
            <li key={t} className="flex items-center gap-2"><CircleCheck className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-paper">Qué te falta</p>
        <ul className="space-y-1.5 text-xs">
          {MISSING.map((t) => (
            <li key={t} className="flex items-center gap-2 text-muted"><CircleAlert className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
      {!compact && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-brass/30 bg-brass/10 px-3 py-2.5 text-xs">
          <Eye className="h-4 w-4 shrink-0 text-brass" aria-hidden />Un coach verificado ha visto tu Passport
        </div>
      )}
      <p className="mt-4 text-[11px] leading-snug text-faint">Compatibilidad según tus datos, no probabilidad de beca. Si falta un dato, se dice.</p>
    </div>
  );
}
