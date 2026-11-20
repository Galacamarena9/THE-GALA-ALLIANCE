'use client';

import { useMemo, useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, CardTitle, Field, inputClass } from '@/components/ui';
import { createOpportunity } from '@/app/actions/opportunities';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';
import { CONTACT_METHOD_LABEL, INTERNATIONAL_LABEL, REQUIRED_MATERIAL_LABEL, SCHOLARSHIP_LABEL } from '@/lib/domain/recruit';

interface Props {
  orgs: { id: string; name: string; verification_status: string }[];
  /** Necesidades internas activas por organización (nunca se publican solas). */
  needs?: { id: string; organization_id: string; title: string }[];
  catalog: { sports: { id: string; name_es: string }[]; positions: { id: number; sport_id: string; name_es: string }[] };
}

export function OpportunityForm({ orgs, catalog, needs = [] }: Props) {
  const [org, setOrg] = useState(orgs[0]?.id ?? '');
  const orgNeeds = needs.filter((n) => n.organization_id === org);
  const [sport, setSport] = useState(catalog.sports[0]?.id ?? '');
  const positions = useMemo(() => catalog.positions.filter((p) => p.sport_id === sport), [catalog.positions, sport]);
  const year = new Date().getFullYear();

  return (
    <ActionForm action={createOpportunity} className="space-y-5">
      {(fe) => (
        <>
          <Card>
            <CardTitle kicker="1">Qué ofrecéis</CardTitle>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Organización" htmlFor="organization_id">
                <select id="organization_id" name="organization_id" value={org} onChange={(e) => setOrg(e.target.value)} className={inputClass}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.verification_status !== 'verified' ? ' (pendiente de verificar)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Tipo" htmlFor="type">
                <select id="type" name="type" className={inputClass}>
                  {Object.entries(OPPORTUNITY_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-5 space-y-5">
              <Field label="Título" htmlFor="title" hint="Ej.: Beca deportiva · Base · Clase 2027" error={fe.title}>
                <input id="title" name="title" required maxLength={160} className={inputClass} />
              </Field>
              <Field label="Descripción" htmlFor="description" hint="Qué buscáis, nivel, rol en el equipo, cómo es el programa." error={fe.description}>
                <textarea id="description" name="description" rows={5} required className={inputClass} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardTitle kicker="2">A quién buscáis</CardTitle>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Deporte" htmlFor="sport_id">
                <select id="sport_id" name="sport_id" value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass}>
                  {catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                </select>
              </Field>
              <Field label="División" htmlFor="division">
                <select id="division" name="division" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Nota mínima (escala 4.0)" htmlFor="min_gpa_4" error={fe.min_gpa_4}>
                <input id="min_gpa_4" name="min_gpa_4" type="number" step="0.1" min={0} max={4} className={inputClass} />
              </Field>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-paper">Posiciones (vacío = cualquiera)</legend>
              <div key={sport} className="flex flex-wrap gap-2">
                {positions.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper has-[:checked]:border-brass has-[:checked]:text-brass">
                    <input type="checkbox" name="position_ids" value={p.id} className="accent-[var(--color-brass)]" />{p.name_es}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-paper">Años de graduación (vacío = cualquiera)</legend>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, i) => year + i).map((y) => (
                  <label key={y} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper has-[:checked]:border-brass has-[:checked]:text-brass">
                    <input type="checkbox" name="graduation_years" value={y} className="accent-[var(--color-brass)]" />{y}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Inglés requerido" htmlFor="english_required" hint="Ej.: TOEFL 79 o equivalente">
                <input id="english_required" name="english_required" className={inputClass} />
              </Field>
              <Field label="Plazas" htmlFor="places" error={fe.places}>
                <input id="places" name="places" type="number" min={1} max={500} className={inputClass} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardTitle kicker="3">Coste y ayuda (transparencia)</CardTitle>
            <p className="-mt-2 mb-5 text-sm text-muted">Las familias comparan por coste neto. Si no conocéis una cifra, dejadla vacía: se mostrará como &quot;sin dato&quot;, nunca como cero.</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Coste anual total (USD)" htmlFor="annual_cost_usd" hint="Matrícula + alojamiento + comidas + tasas." error={fe.annual_cost_usd}>
                <input id="annual_cost_usd" name="annual_cost_usd" type="number" min={0} step={100} className={inputClass} />
              </Field>
              <Field label="Ayuda anual (USD)" htmlFor="aid_amount_usd" error={fe.aid_amount_usd}>
                <input id="aid_amount_usd" name="aid_amount_usd" type="number" min={0} step={100} className={inputClass} />
              </Field>
              <Field label="Tipo de ayuda" htmlFor="aid_kind">
                <select id="aid_kind" name="aid_kind" className={inputClass}>
                  <option value="unknown">Por determinar</option>
                  <option value="partial">Parcial</option>
                  <option value="full">Completa</option>
                </select>
              </Field>
            </div>
            <Field label="Información de beca" htmlFor="scholarship_status" error={fe.scholarship_status}
              hint="Así lo verá el atleta. «Confirmada» solo existe dentro de una oferta real, nunca en un anuncio.">
              <select id="scholarship_status" name="scholarship_status" defaultValue="not_provided" className={inputClass}>
                {(['not_provided', 'potentially_available', 'amount_stated'] as const).map((k) => <option key={k} value={k}>{SCHOLARSHIP_LABEL[k]}</option>)}
              </select>
            </Field>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <Field label="Ubicación" htmlFor="location"><input id="location" name="location" className={inputClass} /></Field>
              <Field label="Inicio" htmlFor="start_term" hint="Ej.: Otoño 2027"><input id="start_term" name="start_term" className={inputClass} /></Field>
              <Field label="Plazo de candidatura" htmlFor="deadline"><input id="deadline" name="deadline" type="date" className={inputClass} /></Field>
            </div>
          </Card>

          <Card>
            <CardTitle kicker="4">Requisitos y proceso</CardTitle>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-paper">Qué tendrá que aportar el atleta</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(REQUIRED_MATERIAL_LABEL).map(([k, v]) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-sm text-paper has-[:checked]:border-brass has-[:checked]:text-brass">
                    <input type="checkbox" name="required_materials" value={k} className="accent-[var(--color-brass)]" />{v}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Pide solo lo necesario. Un documento subido al Passport no se comparte con vosotros salvo que el atleta (o su familia, si es menor) lo autorice.</p>
            </fieldset>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <Field label="Atletas internacionales" htmlFor="international_eligible">
                <select id="international_eligible" name="international_eligible" defaultValue="unknown" className={inputClass}>
                  {Object.entries(INTERNATIONAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Contacto" htmlFor="contact_method">
                <select id="contact_method" name="contact_method" defaultValue="gala" className={inputClass}>
                  {Object.entries(CONTACT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Caduca el" htmlFor="expires_at" hint="Después deja de mostrarse como activa. No se renueva sola." error={fe.expires_at}>
                <input id="expires_at" name="expires_at" type="date" className={inputClass} />
              </Field>
            </div>
            {orgNeeds.length > 0 && (
              <Field label="Necesidad interna vinculada (opcional)" htmlFor="need_id" hint="Solo para vuestro equipo: el atleta no ve la necesidad interna.">
                <select id="need_id" name="need_id" defaultValue="" className={inputClass}>
                  <option value="">—</option>
                  {orgNeeds.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              </Field>
            )}
          </Card>

          <p className="text-sm text-muted">Después de guardar podrás ver la oportunidad <strong className="text-paper">tal como la verá un atleta</strong> antes de enviarla a revisión.</p>
          <div className="flex flex-wrap gap-3">
            <SubmitButton name="submit" value="review">Enviar a revisión</SubmitButton>
            <SubmitButton name="submit" value="draft" variant="secondary">Guardar borrador</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
