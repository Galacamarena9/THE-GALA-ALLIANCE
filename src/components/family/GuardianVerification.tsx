import { ShieldCheck } from 'lucide-react';
import { Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { attestGuardian } from '@/app/actions/guardian';
import { guardianStateCopy, guardianStatement, type GuardianState } from '@/lib/domain/guardian-verification';

/** Fase 5: estado de verificación del tutor y, si falta, la declaración para firmar. */
export function GuardianVerification({ linkId, athleteId, athleteName, state, notice }: {
  linkId: string; athleteId: string; athleteName: string; state: GuardianState | undefined; notice?: string;
}) {
  const copy = guardianStateCopy(state);
  if (!copy) return null;
  if (state === 'verified') {
    return <p className="flex items-center gap-2 text-sm text-ok" data-testid="guardian-verified"><ShieldCheck className="h-4 w-4" aria-hidden /> {copy.title}</p>;
  }
  return (
    <Card data-testid="guardian-verification">
      <p className="kicker">Protección de menores</p>
      <h2 className="mt-2 font-display text-2xl text-paper">{copy.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{copy.body}</p>
      {notice === 'enviada' && <div className="mt-3"><Notice tone="ok">Declaración recibida. Te avisaremos cuando la revisemos.</Notice></div>}
      {notice === 'error' && <div className="mt-3"><Notice tone="danger">No se ha podido registrar la declaración. Inténtalo de nuevo o escríbenos desde Ayuda.</Notice></div>}
      {notice === 'requerida' && <div className="mt-3"><Notice tone="warn">Esa aprobación necesita que estés verificado como tutor legal. Firma la declaración y la revisamos.</Notice></div>}
      {notice === 'falta_aceptar' && <div className="mt-3"><Notice tone="danger">Marca la casilla para firmar la declaración.</Notice></div>}
      {state === 'needs_attestation' && (
        <form action={attestGuardian} className="mt-4 space-y-3">
          <input type="hidden" name="link" value={linkId} />
          <input type="hidden" name="athlete" value={athleteId} />
          <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm text-paper">
            <input type="checkbox" name="accept" required className="mt-0.5 h-4 w-4 accent-[var(--color-brass)]" />
            <span>{guardianStatement(athleteName)}</span>
          </label>
          <p className="text-xs text-faint">No te pedimos documentos de identidad aquí. Si necesitamos comprobar algo más, te escribiremos.</p>
          <SubmitButton pendingText="Enviando…">Firmar y enviar a revisión</SubmitButton>
        </form>
      )}
    </Card>
  );
}
