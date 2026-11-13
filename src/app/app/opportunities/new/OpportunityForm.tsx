'use client';

import { useMemo, useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, CardTitle, Field, inputClass } from '@/components/ui';
import { createOpportunity } from '@/app/actions/opportunities';
import { DIVISION_LABEL, OPPORTUNITY_TYPE_LABEL } from '@/lib/domain/labels';

interface Props {
  orgs: { id: string; name: string; verification_status: string }[];
  catalog: { sports: { id: string; name_es: string }[]; positions: { id: number; sport_id: string; name_es: string }[] };
}

export function OpportunityForm({ orgs, catalog }: Props) {
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
                <select id="organization_id" name="organization_id" className={inputClass}>
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
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <Field label="Ubicación" htmlFor="location"><input id="location" name="location" className={inputClass} /></Field>
              <Field label="Inicio" htmlFor="start_term" hint="Ej.: Otoño 2027"><input id="start_term" name="start_term" className={inputClass} /></Field>
              <Field label="Plazo de candidatura" htmlFor="deadline"><input id="deadline" name="deadline" type="date" className={inputClass} /></Field>
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <SubmitButton name="submit" value="review">Enviar a revisión</SubmitButton>
            <SubmitButton name="submit" value="draft" variant="secondary">Guardar borrador</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
