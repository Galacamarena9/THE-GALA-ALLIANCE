'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { appealModeration, decideAppeal, moderate, openSafetyCase } from '@/app/actions/safety';

const label = 'block text-xs text-muted';
const field = `${inputClass} mt-1 py-1.5`;
const ACTIONS: [string, string][] = [
  ['warning', 'Aviso'], ['content_removed', 'Contenido retirado'], ['opportunity_paused', 'Oportunidad pausada'],
  ['user_restricted', 'Restringir persona (por ámbito)'], ['organization_restricted', 'Restringir organización (por ámbito)'],
  ['suspended', 'Suspender'], ['verification_revoked', 'Retirar verificación'], ['escalate', 'Escalar'], ['no_action', 'Sin medida'],
];
const SCOPES: [string, string][] = [
  ['contact', 'Contactar'], ['messaging', 'Mensajes'], ['discovery', 'Descubrir atletas'], ['publishing', 'Publicar'],
  ['offers', 'Enviar ofertas'], ['representation', 'Representar'], ['applications', 'Candidaturas'],
];

export function OpenCaseForm({ reportId, subjectUser, subjectOrg, defaultTitle }: { reportId?: string; subjectUser?: string; subjectOrg?: string; defaultTitle?: string }) {
  return (
    <ActionForm action={openSafetyCase}>
      {() => (
        <div className="grid gap-2 sm:grid-cols-4">
          {reportId && <input type="hidden" name="report_id" value={reportId} />}
          {subjectUser && <input type="hidden" name="subject_user" value={subjectUser} />}
          {subjectOrg && <input type="hidden" name="subject_org" value={subjectOrg} />}
          <label className={`${label} sm:col-span-2`}>Título<input name="title" required minLength={3} defaultValue={defaultTitle} className={field} /></label>
          <label className={label}>Categoría<select name="category" className={field} defaultValue="other">
            {['minor', 'fraud', 'payment', 'organization', 'messaging', 'impersonation', 'privacy', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className={label}>Prioridad<select name="priority" className={field} defaultValue="medium">
            {['critical', 'high', 'medium', 'low'].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <div className="sm:col-span-4"><SubmitButton pendingText="Abriendo…">Abrir caso</SubmitButton></div>
        </div>
      )}
    </ActionForm>
  );
}

export function ModerateForm({ caseId, subjectUser, subjectOrg }: { caseId: string; subjectUser: string | null; subjectOrg: string | null }) {
  return (
    <ActionForm action={moderate}>
      {() => (
        <div className="space-y-2">
          <input type="hidden" name="case_id" value={caseId} />
          {subjectUser && <input type="hidden" name="subject_user" value={subjectUser} />}
          {subjectOrg && <input type="hidden" name="subject_org" value={subjectOrg} />}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={`${label} sm:col-span-2`}>Medida<select name="action" className={field} defaultValue="warning">{ACTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className={label}>Días (vacío = sin fin)<input name="days" type="number" min={1} max={3650} className={field} /></label>
          </div>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1"><legend className="text-xs text-muted">Ámbitos (para restricciones)</legend>
            {SCOPES.map(([k, v]) => <label key={k} className="flex items-center gap-1.5 text-xs text-paper"><input type="checkbox" name="scopes" value={k} />{v}</label>)}
          </fieldset>
          <label className={label}>Motivo (la persona afectada lo verá)<textarea name="reason" required minLength={10} maxLength={2000} rows={2} className={field} /></label>
          <SubmitButton pendingText="Aplicando…">Aplicar medida</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function DecideAppealForm({ id }: { id: string }) {
  return (
    <ActionForm action={decideAppeal}>
      {() => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} />
          <label className={`${label} flex-1`}>Decisión razonada<input name="reason" required minLength={10} className={field} /></label>
          <button name="decision" value="uphold" className="min-h-10 rounded-full border border-line-strong px-4 text-xs text-paper">Mantener</button>
          <SubmitButton name="decision" value="overturn" pendingText="Guardando…">Retirar medida</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function AppealForm({ id }: { id: string }) {
  return (
    <ActionForm action={appealModeration}>
      {() => (
        <div className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm text-muted">Tu versión<textarea name="body" required minLength={20} maxLength={4000} rows={3} className={`${inputClass} mt-1`} /></label>
          <SubmitButton pendingText="Enviando…">Enviar apelación</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
