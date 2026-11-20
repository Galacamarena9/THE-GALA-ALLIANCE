'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { reviewDeliverable, sendBrandOffer, submitDeliverable } from '@/app/actions/brand-offers';
import { DELIVERABLE_LABEL } from '@/lib/domain/brand-offers';

const label = 'block text-sm text-muted';
const field = `${inputClass} mt-1`;

/** La marca envía una oferta con cada condición explícita. Enviarla de nuevo crea una versión nueva. */
export function BrandOfferForm({ applicationId, campaignId }: { applicationId: string; campaignId: string }) {
  return (
    <ActionForm action={sendBrandOffer} className="space-y-4">
      {() => (
        <>
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="campaign_id" value={campaignId} />
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">Compensación</legend>
            <label className={label}>Dinero (fijo)<input name="cash_amount" type="number" min={0} step="1" className={field} placeholder="0" /></label>
            <label className={label}>Moneda<select name="cash_currency" className={field} defaultValue="USD"><option>USD</option><option>EUR</option><option>GBP</option></select></label>
            <label className={label}>Valor del producto<input name="product_value" type="number" min={0} step="1" className={field} placeholder="Opcional" /></label>
            <label className={`${label} sm:col-span-3`}>Producto<input name="product_description" maxLength={500} className={field} placeholder="Ej.: dos pares de zapatillas de la nueva colección" /></label>
            <label className={label}>Bonus (condicionado)<input name="bonus_amount" type="number" min={0} step="1" className={field} placeholder="Opcional" /></label>
            <label className={`${label} sm:col-span-2`}>Condición del bonus<input name="bonus_description" maxLength={500} className={field} placeholder="Ej.: si el reel supera 10.000 visualizaciones" /></label>
            <label className="flex items-center gap-2 text-sm text-muted sm:col-span-3"><input type="checkbox" name="unknown" /> Compensación aún no especificada (se dirá así, sin inventar un valor)</label>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">Entregable</legend>
            <label className={label}>Tipo<select name="deliverable_kind" className={field} defaultValue="reel">{Object.entries(DELIVERABLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className={label}>Plataforma<input name="deliverable_platform" maxLength={60} className={field} placeholder="instagram" /></label>
            <label className={label}>Cantidad<input name="deliverable_quantity" type="number" min={1} max={100} defaultValue={1} className={field} /></label>
            <label className={label}>Fecha<input name="deliverable_due" type="date" className={field} /></label>
            <label className={`${label} sm:col-span-4`}>Descripción<input name="deliverable_description" required minLength={3} maxLength={1000} className={field} placeholder="Qué tiene que mostrar el contenido" /></label>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">Derechos de uso y exclusividad</legend>
            <label className={label}>Meses de uso<input name="usage_months" type="number" min={0} max={60} defaultValue={0} className={field} /></label>
            <label className={`${label} sm:col-span-2`}>Canales<input name="usage_channels" maxLength={200} className={field} placeholder="instagram, web" /></label>
            <label className="flex items-end gap-2 pb-2 text-sm text-muted"><input type="checkbox" name="paid_media" /> Publicidad pagada</label>
            <label className={`${label} sm:col-span-2`}>Exclusividad: categoría<input name="exclusivity_category" maxLength={120} className={field} placeholder="Vacío = sin exclusividad" /></label>
            <label className={label}>Días<input name="exclusivity_days" type="number" min={0} max={730} defaultValue={0} className={field} /></label>
            <label className={label}>Caduca en (días)<input name="expires_days" type="number" min={1} max={60} defaultValue={14} className={field} /></label>
          </fieldset>
          <label className={label}>Condiciones adicionales<textarea name="terms" maxLength={4000} rows={3} className={field} /></label>
          <SubmitButton pendingText="Enviando…">Enviar oferta</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function SubmitDeliverableForm({ id }: { id: string }) {
  return (
    <ActionForm action={submitDeliverable}>
      {() => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} />
          <label className={`${label} flex-1`}>Enlace al contenido<input name="url" type="url" required pattern="https://.*" className={field} placeholder="https://" /></label>
          <label className={`${label} flex-1`}>Nota (opcional)<input name="note" maxLength={1000} className={field} /></label>
          <SubmitButton pendingText="Enviando…">Entregar</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function ReviewDeliverableForm({ id, campaignId }: { id: string; campaignId: string }) {
  return (
    <ActionForm action={reviewDeliverable}>
      {() => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="campaign_id" value={campaignId} />
          <label className={`${label} flex-1`}>Comentario (obligatorio si pides cambios)<input name="feedback" maxLength={1000} className={field} /></label>
          <button name="decision" value="changes" className="min-h-11 rounded-full border border-line-strong px-4 text-sm text-paper">Pedir cambios</button>
          <SubmitButton name="decision" value="approve" pendingText="Guardando…">Aprobar</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
