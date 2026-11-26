// Datos FICTICIOS solo para el probador (ENABLE_PREVIEW=1). Misma agrupación y mismo motor que producción.
import { groupInbox, type InboxGroup } from '@/lib/domain/inbox';
import { nextAction } from '@/lib/domain/next-action';
import type { ThreadContextData } from '@/components/inbox/AgentInbox';
import { previewPipelineActions } from '@/lib/preview/pipeline';
import { previewCases } from '@/lib/preview/fixtures';

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export function previewInbox(): InboxGroup[] {
  const acts = previewPipelineActions();
  const by = new Map<string, ReturnType<typeof acts.get>[]>();
  for (const c of previewCases) { const a = acts.get(c.id); if (a) by.set(c.athleteId, [...(by.get(c.athleteId) ?? []), a]); }
  return groupInbox([
    { id: '00000000-0000-4000-8000-0000000000d1', athleteId: 'a1', athleteName: 'Marcos Jiménez', organization: 'Norte Sports Management', status: 'accepted', isMinor: false, lastMessageAt: ago(0.2), createdAt: ago(30), excerpt: 'Ya tengo el expediente traducido, ¿te lo subo hoy?', lastFrom: 'athlete', awaitingReply: true, unread: true },
    { id: '00000000-0000-4000-8000-0000000000d2', athleteId: 'a2', athleteName: 'Sofía Martín', organization: 'Norte Sports Management', status: 'accepted', isMinor: true, lastMessageAt: ago(1), createdAt: ago(20), excerpt: 'Perfecto, el jueves os paso las fechas de la visita.', lastFrom: 'us', awaitingReply: false, unread: false },
    { id: '00000000-0000-4000-8000-0000000000d3', athleteId: 'a3', athleteName: 'Daniel Kim', organization: 'Norte Sports Management', status: 'pending', isMinor: false, lastMessageAt: null, createdAt: ago(3), excerpt: 'Hola Daniel, te escribimos para coordinar tu proceso con las universidades.', lastFrom: 'us', awaitingReply: false, unread: false },
  ], by as Map<string, NonNullable<ReturnType<typeof acts.get>>[]>);
}

export function previewThreadContext(variant: 'ok' | 'revoked'): ThreadContextData {
  const acts = previewPipelineActions();
  if (variant === 'revoked') {
    const c = previewCases.find((x) => x.id === 'c4')!;
    return { athleteId: 'a3', athleteName: 'Daniel Kim', cases: [{ id: c.id, institution: c.institutionName, stage: c.stage, action: acts.get('c4') ?? nextAction({ id: c.id, athleteId: c.athleteId, institution: c.institutionName, stage: c.stage, nextAction: null, nextActionDue: null, updatedAt: c.updatedAt }, { repActive: false }) }], docs: null, canMessage: false, canMessageReason: 'La representación ya no está activa o no incluye mensajes: no puedes escribir en esta conversación.' };
  }
  return {
    athleteId: 'a2', athleteName: 'Sofía Martín',
    cases: previewCases.filter((c) => c.athleteId === 'a2' && c.stage !== 'closed').map((c) => ({ id: c.id, institution: c.institutionName, stage: c.stage, action: acts.get(c.id)! })),
    docs: [{ title: 'Certificado de notas', status: 'esperando a la familia' }], canMessage: true, canMessageReason: null,
  };
}
