// Datos FICTICIOS solo para el probador (ENABLE_PREVIEW=1). Pasan por el motor real de siguiente acción.
import { nextAction, type NAContext, type NextAction } from '@/lib/domain/next-action';
import { previewCases } from '@/lib/preview/fixtures';

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString();

/** Un caso de cada tipo: oferta que caduca, tarea vencida, documento pedido a la familia, representación caducada. */
const CTX: Record<string, NAContext> = {
  c1: { repActive: true },
  c2: { repActive: true, tasks: [{ title: 'Pedir el expediente traducido', dueDate: inDays(-2).slice(0, 10) }] },
  c3: { repActive: true, docRequest: { title: 'Certificado de notas', requestedAt: inDays(-2), fromFamily: true } },
  c4: { repActive: false },
  c5: { repActive: true, offer: { deadline: inDays(3).slice(0, 10) } },
};

export function previewPipelineActions(): Map<string, NextAction> {
  return new Map(previewCases.filter((c) => c.stage !== 'closed').map((c) => [c.id, nextAction(
    { id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: c.nextAction, nextActionDue: c.nextActionDue, updatedAt: c.updatedAt },
    CTX[c.id] ?? { repActive: true },
  )]));
}
