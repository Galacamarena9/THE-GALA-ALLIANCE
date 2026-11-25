import { Badge, Card, CardTitle, Notice, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { reviewGuardian } from '@/app/actions/guardian';

export type GuardianReviewRow = { link_id: string; parent_name: string; athlete_name: string; relationship: string; attested_at: string; auto_checks_ok: boolean };

const REL: Record<string, string> = { parent: 'Madre/padre', mother: 'Madre', father: 'Padre', legal_guardian: 'Tutor legal' };
const NOTICE: Record<string, [string, 'ok' | 'danger' | 'warn']> = {
  aprobado: ['Tutor verificado. Ya puede decidir en nombre del menor.', 'ok'],
  rechazado: ['Verificación rechazada: el vínculo queda restringido.', 'warn'],
  motivo: ['Escribe un motivo de al menos 10 caracteres.', 'danger'],
  error: ['No se ha podido guardar la decisión.', 'danger'],
};

/** Fase 5: cola de tutores por verificar (declaración firmada). Sin edades ni documentos: solo la señal automática. */
export function GuardianReviewQueue({ rows, notice }: { rows: GuardianReviewRow[]; notice?: string }) {
  return (
    <Card data-testid="guardian-review-queue">
      <CardTitle kicker="Protección de menores">Tutores por verificar ({rows.length})</CardTitle>
      {notice && NOTICE[notice] && <div className="mb-3"><Notice tone={NOTICE[notice][1]}>{NOTICE[notice][0]}</Notice></div>}
      <p className="mb-3 text-sm text-muted">
        Comprueba por un canal independiente (club, centro educativo o videollamada) que es su madre, padre o tutor legal antes de aprobar. No pidas documentos por email ni los subas aquí.
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted">No hay declaraciones pendientes.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.link_id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-paper">{r.parent_name}</span>
                <span className="text-muted">→ {r.athlete_name} · {REL[r.relationship] ?? r.relationship}</span>
                <Badge tone={r.auto_checks_ok ? 'ok' : 'warn'}>{r.auto_checks_ok ? 'Comprobaciones automáticas OK' : 'Revisar con más cuidado'}</Badge>
              </div>
              <form action={reviewGuardian} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="link" value={r.link_id} />
                <label className="min-w-[240px] flex-1 text-xs text-muted">Motivo (queda auditado)
                  <input name="reason" required minLength={10} maxLength={300} className={inputClass} placeholder="Cómo lo has comprobado" />
                </label>
                <SubmitButton name="decision" value="approve" pendingText="Guardando…">Verificar</SubmitButton>
                <button name="decision" value="reject" className="min-h-11 rounded-full border border-danger/50 px-4 text-sm font-semibold text-danger">Rechazar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
