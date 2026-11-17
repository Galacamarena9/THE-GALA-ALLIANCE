'use client';

/**
 * Formularios cliente reutilizables sobre Server Actions.
 * Cada uno muestra errores y confirmación sin recargar la página.
 */
import { useActionState, useState } from 'react';
import type { FormState } from '@/app/actions/auth';
import { applyToOpportunity } from '@/app/actions/opportunities';
import { reportContent, requestContact, sendMessage } from '@/app/actions/connect';
import { applyToCampaign, addAthleteLink, requestRepresentation } from '@/app/actions/marketplace';
import { createTeamInvitation, publishNews, updateInstitutionLinks, updateOrganization } from '@/app/actions/organization';
import { importFromScorecard, updateInstitutionAdmin } from '@/app/actions/admin';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { DIVISION_LABEL, LINK_KIND_LABEL } from '@/lib/domain/labels';

export function ApplyOpportunityForm({ opportunityId, warning }: { opportunityId: string; warning?: string }) {
  return (
    <ActionForm action={applyToOpportunity} className="space-y-3">
      {() => (
        <>
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          {warning && <Notice tone="warn">{warning}</Notice>}
          <Field label="Mensaje para el equipo (opcional)" htmlFor="athlete_message" hint="Por qué encajas, tu disponibilidad, enlace a un partido completo…">
            <textarea id="athlete_message" name="athlete_message" rows={3} maxLength={2000} className={inputClass} />
          </Field>
          <SubmitButton pendingText="Enviando…">Aplicar con mi Passport</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ContactRequestForm({ organizations, athleteId, isMinor }: { organizations: { id: string; name: string }[]; athleteId: string; isMinor: boolean }) {
  const [open, setOpen] = useState(false);
  if (!organizations.length) return <p className="text-xs text-faint">Para contactar necesitas una organización verificada.</p>;
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Solicitar contacto</Button>;
  return (
    <ActionForm action={requestContact} className="space-y-3 rounded-xl border border-line bg-ink/40 p-4">
      {() => (
        <>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <Field label="En nombre de" htmlFor="organization_id">
            <select id="organization_id" name="organization_id" className={inputClass}>
              {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Mensaje" htmlFor="message" hint={isMinor ? 'Es menor: su familia verá y aprobará tu solicitud antes que nadie.' : 'Preséntate y explica por qué te interesa.'}>
            <textarea id="message" name="message" rows={4} minLength={20} maxLength={1500} required className={inputClass} />
          </Field>
          <SubmitButton pendingText="Enviando…">Enviar solicitud</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MessageForm({ requestId, isMinor }: { requestId: string; isMinor: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(sendMessage, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="request_id" value={requestId} />
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <textarea name="body" rows={3} maxLength={2000} required aria-label="Mensaje" placeholder="Escribe tu mensaje…" className={inputClass} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-faint">{isMinor ? 'Conversación con un menor: la familia la ve y no se permiten datos de contacto personales.' : 'No compartas datos bancarios ni documentos por mensaje.'}</p>
        <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
      </div>
    </form>
  );
}

const REPORT_REASONS = [
  ['child_safety', 'Seguridad de un menor'],
  ['harassment', 'Acoso o intimidación'],
  ['fake_or_misleading', 'Falso o engañoso'],
  ['spam', 'Spam'],
  ['illegal_content', 'Contenido ilegal'],
  ['privacy', 'Privacidad'],
  ['other', 'Otro'],
] as const;

export function ReportButton({ entityType, entityId, label = 'Denunciar' }: { entityType: string; entityId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-faint underline-offset-2 hover:text-danger hover:underline">{label}</button>;
  return (
    <ActionForm action={reportContent} className="mt-2 space-y-3 rounded-xl border border-line bg-ink/60 p-4">
      {() => (
        <>
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <Field label="Motivo" htmlFor={`reason-${entityId}`}>
            <select id={`reason-${entityId}`} name="reason" className={inputClass}>
              {REPORT_REASONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Detalles (opcional)" htmlFor={`details-${entityId}`}>
            <textarea id={`details-${entityId}`} name="details" rows={2} maxLength={2000} className={inputClass} />
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingText="Enviando…">Enviar denuncia</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-faint">Si hay un riesgo inmediato para un menor, llama al 112.</p>
        </>
      )}
    </ActionForm>
  );
}

export function CampaignApplyForm({ campaignId }: { campaignId: string }) {
  return (
    <ActionForm action={applyToCampaign} className="space-y-3">
      {(fe) => (
        <>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <Field label="Mensaje para la marca (opcional)" htmlFor="message">
            <textarea id="message" name="message" rows={3} maxLength={1500} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="rules_acknowledged" className="mt-0.5 accent-[var(--color-brass)]" />
            Confirmo que revisaré la normativa de mi universidad, federación y, si estudio en EE. UU., de mi visado antes de aceptar cualquier acuerdo.
          </label>
          {fe.rules_acknowledged && <p className="text-xs text-danger">{fe.rules_acknowledged}</p>}
          <SubmitButton pendingText="Enviando…">Aplicar a la oferta</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RepresentationForm({ agencies, athleteId }: { agencies: { id: string; name: string }[]; athleteId: string }) {
  const [open, setOpen] = useState(false);
  if (!agencies.length) return null;
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Proponer representación</Button>;
  return (
    <ActionForm action={requestRepresentation} className="space-y-3 rounded-xl border border-line bg-ink/40 p-4">
      {() => (
        <>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <Field label="Agencia" htmlFor="agency_id">
            <select id="agency_id" name="agency_id" className={inputClass}>{agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </Field>
          <Field label="Mensaje" htmlFor="rep_message"><textarea id="rep_message" name="message" rows={3} maxLength={1000} className={inputClass} /></Field>
          <SubmitButton pendingText="Enviando…">Enviar propuesta</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function TeamInviteForm({ organizationId, siteUrl }: { organizationId: string; siteUrl: string }) {
  const [state, action] = useActionState<FormState, FormData>(createTeamInvitation, undefined);
  const url = state?.ok && state.message ? `${siteUrl}/join/${state.message}` : null;
  return (
    <div>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {url ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Envía este enlace al coach. Caduca en 14 días y es de un solo uso.</p>
          <input readOnly value={url} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} className={inputClass} />
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="organization_id" value={organizationId} />
          <SubmitButton variant="secondary" pendingText="Creando…">Invitar a un coach</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function OrganizationForm({ org }: { org: { id: string; name: string; city: string | null; state: string | null; website: string | null; description: string | null; international_support: string | null; type: string } }) {
  return (
    <ActionForm action={updateOrganization} className="space-y-4">
      {() => (
        <>
          <input type="hidden" name="id" value={org.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name"><input id="name" name="name" defaultValue={org.name} className={inputClass} /></Field>
            <Field label="Web oficial" htmlFor="website"><input id="website" name="website" defaultValue={org.website ?? ''} className={inputClass} /></Field>
            <Field label="Ciudad" htmlFor="city"><input id="city" name="city" defaultValue={org.city ?? ''} className={inputClass} /></Field>
            <Field label="Estado / región" htmlFor="state"><input id="state" name="state" defaultValue={org.state ?? ''} className={inputClass} /></Field>
          </div>
          <Field label="Descripción" htmlFor="description"><textarea id="description" name="description" rows={3} defaultValue={org.description ?? ''} className={inputClass} /></Field>
          {(org.type === 'university' || org.type === 'college') && (
            <Field label="Apoyo a estudiantes internacionales" htmlFor="international_support" hint="Tutorías, idioma, visado, vivienda…">
              <textarea id="international_support" name="international_support" rows={3} defaultValue={org.international_support ?? ''} className={inputClass} />
            </Field>
          )}
          <SubmitButton>Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

type Links = { id: string; athletics_url: string | null; admissions_url: string | null; international_url: string | null; virtual_tour_url: string | null };
export function InstitutionLinksForm({ inst }: { inst: Links }) {
  return (
    <ActionForm action={updateInstitutionLinks} className="space-y-4">
      {() => (
        <>
          <input type="hidden" name="id" value={inst.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Web de deportes (athletics)" htmlFor="athletics_url"><input id="athletics_url" name="athletics_url" defaultValue={inst.athletics_url ?? ''} className={inputClass} /></Field>
            <Field label="Admisiones" htmlFor="admissions_url"><input id="admissions_url" name="admissions_url" defaultValue={inst.admissions_url ?? ''} className={inputClass} /></Field>
            <Field label="Oficina internacional" htmlFor="international_url"><input id="international_url" name="international_url" defaultValue={inst.international_url ?? ''} className={inputClass} /></Field>
            <Field label="Campus virtual (tour oficial)" htmlFor="virtual_tour_url"><input id="virtual_tour_url" name="virtual_tour_url" defaultValue={inst.virtual_tour_url ?? ''} className={inputClass} /></Field>
          </div>
          <p className="text-xs text-faint">Solo enlaces de dominios oficiales de la universidad. Se revisan antes de mostrarse como verificados.</p>
          <SubmitButton variant="secondary">Enviar enlaces</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function NewsForm({ organizations, isAdmin }: { organizations: { id: string; name: string }[]; isAdmin: boolean }) {
  return (
    <ActionForm action={publishNews} className="space-y-4">
      {() => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Publicar como" htmlFor="organization_id">
              <select id="organization_id" name="organization_id" className={inputClass}>
                {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {isAdmin && <option value="">The Gala Alliance (editorial)</option>}
              </select>
            </Field>
            <Field label="Tipo" htmlFor="kind">
              <select id="kind" name="kind" className={inputClass}>
                <option value="announcement">Comunicado</option>
                <option value="event">Evento / jornada</option>
                <option value="rule_update">Cambio de normativa</option>
                <option value="story">Historia</option>
              </select>
            </Field>
          </div>
          <Field label="Título" htmlFor="news_title"><input id="news_title" name="title" maxLength={160} required className={inputClass} /></Field>
          <Field label="Texto" htmlFor="news_body"><textarea id="news_body" name="body" rows={4} maxLength={5000} required className={inputClass} /></Field>
          <Field label="Fuente oficial (opcional)" htmlFor="source_url" hint="Enlace https a la web oficial que respalda la noticia."><input id="source_url" name="source_url" className={inputClass} /></Field>
          <SubmitButton>Publicar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ScorecardImportForm() {
  return (
    <ActionForm action={importFromScorecard} className="flex flex-wrap items-end gap-3">
      {() => (
        <>
          <div className="min-w-64 flex-1">
            <Field label="Nombre de la universidad (College Scorecard)" htmlFor="sc_name">
              <input id="sc_name" name="name" placeholder="University of Evansville" className={inputClass} />
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingText="Importando…">Importar datos oficiales</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InstitutionAdminForm({ inst }: { inst: Links & { association: string | null; division: string | null; conference: string | null } }) {
  return (
    <ActionForm action={updateInstitutionAdmin} className="space-y-4">
      {() => (
        <>
          <input type="hidden" name="id" value={inst.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Asociación" htmlFor="association">
              <select id="association" name="association" defaultValue={inst.association ?? ''} className={inputClass}>
                <option value="">—</option><option value="ncaa">NCAA</option><option value="naia">NAIA</option><option value="njcaa">NJCAA</option><option value="other">Otra</option>
              </select>
            </Field>
            <Field label="División" htmlFor="division">
              <select id="division" name="division" defaultValue={inst.division ?? ''} className={inputClass}>
                <option value="">—</option>
                {Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Conferencia" htmlFor="conference"><input id="conference" name="conference" defaultValue={inst.conference ?? ''} className={inputClass} /></Field>
          </div>
          <p className="text-xs text-muted">Los deportes se gestionan como programas (abajo), cada uno con su género, división y fuente.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Athletics" htmlFor="a_athletics"><input id="a_athletics" name="athletics_url" defaultValue={inst.athletics_url ?? ''} className={inputClass} /></Field>
            <Field label="Admisiones" htmlFor="a_adm"><input id="a_adm" name="admissions_url" defaultValue={inst.admissions_url ?? ''} className={inputClass} /></Field>
            <Field label="Oficina internacional" htmlFor="a_intl"><input id="a_intl" name="international_url" defaultValue={inst.international_url ?? ''} className={inputClass} /></Field>
            <Field label="Campus virtual" htmlFor="a_tour"><input id="a_tour" name="virtual_tour_url" defaultValue={inst.virtual_tour_url ?? ''} className={inputClass} /></Field>
          </div>
          <SubmitButton variant="secondary">Guardar y marcar revisado</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}


export function AthleteLinkForm() {
  return (
    <ActionForm action={addAthleteLink} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
      {() => (
        <>
          <Field label="Tipo" htmlFor="link_kind">
            <select id="link_kind" name="kind" className={inputClass}>{Object.entries(LINK_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Enlace oficial" htmlFor="link_url"><input id="link_url" name="url" placeholder="https://" className={inputClass} /></Field>
          <SubmitButton variant="secondary">Añadir</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

