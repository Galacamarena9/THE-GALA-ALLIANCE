'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, Field, Notice, inputClass } from '@/components/ui';
import { createCampaign } from '@/app/actions/marketplace';
import { CAMPAIGN_KIND_LABEL, COMPENSATION_LABEL } from '@/lib/domain/labels';

export function CampaignForm({ brands, sports }: { brands: { id: string; name: string; verification_status: string }[]; sports: { id: string; name_es: string }[] }) {
  return (
    <ActionForm action={createCampaign} className="space-y-5">
      {(fe) => (
        <>
          <Card className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Marca" htmlFor="brand_org_id">
                <select id="brand_org_id" name="brand_org_id" className={inputClass}>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.verification_status !== 'verified' ? ' (pendiente de verificar)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Tipo de colaboración" htmlFor="kind">
                <select id="kind" name="kind" className={inputClass}>{Object.entries(CAMPAIGN_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </Field>
            </div>
            <Field label="Título" htmlFor="title" error={fe.title}><input id="title" name="title" maxLength={160} required className={inputClass} /></Field>
            <Field label="Descripción" htmlFor="description" error={fe.description}><textarea id="description" name="description" rows={4} required className={inputClass} /></Field>
            <Field label="Entregables" htmlFor="deliverables" hint="Qué tiene que hacer el atleta, cuántas veces y en qué plazo." error={fe.deliverables}>
              <textarea id="deliverables" name="deliverables" rows={3} required className={inputClass} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-paper">Deportes (vacío = todos)</legend>
              <div className="flex flex-wrap gap-2">
                {sports.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper has-[:checked]:border-brass has-[:checked]:text-brass">
                    <input type="checkbox" name="sport_ids" value={s.id} className="accent-[var(--color-brass)]" />{s.name_es}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>
          <Card className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Compensación" htmlFor="compensation_kind">
                <select id="compensation_kind" name="compensation_kind" className={inputClass}>{Object.entries(COMPENSATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </Field>
              <Field label="Importe (USD)" htmlFor="compensation_usd" error={fe.compensation_usd} hint="Desde 600 $, los atletas NCAA D-I lo declaran en NIL Go."><input id="compensation_usd" name="compensation_usd" type="number" min={0} className={inputClass} /></Field>
              <Field label="Plazo de candidatura" htmlFor="application_deadline"><input id="application_deadline" name="application_deadline" type="date" className={inputClass} /></Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Derechos de uso de la imagen" htmlFor="usage_rights" hint="Canales, duración y exclusividad."><textarea id="usage_rights" name="usage_rights" rows={2} className={inputClass} /></Field>
              <Field label="Territorio" htmlFor="territory"><input id="territory" name="territory" placeholder="España, UE, global…" className={inputClass} /></Field>
            </div>
            <Notice>La plataforma no firma contratos ni gestiona pagos. No se permiten ofertas que condicionen el rendimiento deportivo ni el fichaje por un equipo.</Notice>
          </Card>
          <div className="flex gap-3">
            <SubmitButton name="submit" value="review">Enviar a revisión</SubmitButton>
            <SubmitButton name="submit" value="draft" variant="secondary">Guardar borrador</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
