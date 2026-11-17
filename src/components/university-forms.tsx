'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Field, inputClass } from '@/components/ui';
import { claimInstitution, saveProgram } from '@/app/actions/universities';
import { DIVISION_LABEL } from '@/lib/domain/labels';

export function ProgramForm({ institutionId, sports, isAdmin }: { institutionId: string; sports: { id: string; name_es: string }[]; isAdmin: boolean }) {
  return (
    <ActionForm action={saveProgram} className="grid gap-3 sm:grid-cols-2">
      {(fe) => (
        <>
          <input type="hidden" name="institution_id" value={institutionId} />
          <Field label="Deporte" htmlFor="p_sport"><select id="p_sport" name="sport_id" required className={inputClass}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}</select></Field>
          <Field label="Categoría" htmlFor="p_gender"><select id="p_gender" name="gender" className={inputClass}><option value="women">Femenino</option><option value="men">Masculino</option><option value="coed">Mixto / sin especificar</option></select></Field>
          <Field label="Asociación" htmlFor="p_assoc"><select id="p_assoc" name="association" className={inputClass}><option value="">—</option><option value="ncaa">NCAA</option><option value="naia">NAIA</option><option value="njcaa">NJCAA</option><option value="other">Otra</option></select></Field>
          <Field label="División" htmlFor="p_div"><select id="p_div" name="division" className={inputClass}><option value="">—</option>{Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Conferencia" htmlFor="p_conf"><input id="p_conf" name="conference" maxLength={120} className={inputClass} /></Field>
          <Field label="Web del programa" htmlFor="p_url" error={fe.program_url}><input id="p_url" name="program_url" placeholder="https://" className={inputClass} /></Field>
          {isAdmin && (
            <>
              <Field label="Fuente" htmlFor="p_source"><select id="p_source" name="source" className={inputClass}><option value="manual_admin">Revisado por Gala</option><option value="official_external">Fuente oficial externa</option></select></Field>
              <Field label="URL de la fuente oficial" htmlFor="p_srcurl" error={fe.source_url}><input id="p_srcurl" name="source_url" placeholder="https://" className={inputClass} /></Field>
            </>
          )}
          <div className="sm:col-span-2"><SubmitButton variant="secondary">Guardar programa</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function ClaimForm({ institutionId, orgs }: { institutionId: string; orgs: { id: string; name: string }[] }) {
  return (
    <ActionForm action={claimInstitution} className="space-y-3">
      {(fe) => (
        <>
          <input type="hidden" name="institution_id" value={institutionId} />
          <Field label="Email institucional" htmlFor="c_email" hint="Del dominio oficial de la universidad" error={fe.work_email}><input id="c_email" name="work_email" type="email" required autoComplete="email" className={inputClass} /></Field>
          <Field label="Tu cargo" htmlFor="c_role" error={fe.role_title}><input id="c_role" name="role_title" required minLength={2} maxLength={120} placeholder="Head Coach, Recruiting Coordinator…" className={inputClass} /></Field>
          {orgs.length > 0 && (
            <Field label="Organización verificada que la gestionará" htmlFor="c_org"><select id="c_org" name="organization_id" className={inputClass}><option value="">Elegir más tarde</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          )}
          <SubmitButton variant="secondary">Solicitar gestionar esta universidad</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
