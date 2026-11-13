'use client';

import { useActionState, useMemo, useState } from 'react';
import { completeOnboarding } from '@/app/actions/onboarding';
import type { FormState } from '@/app/actions/auth';
import { ACTORS } from '@/lib/domain/roles';
import { DIVISION_LABEL, ORG_TYPE_LABEL } from '@/lib/domain/labels';
import type { Sport, SportPosition } from '@/lib/types';
import { Field, inputClass, Notice, cx } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

const ORG_TYPES = { university: ['university', 'college'], coach: ['club', 'academy'], agent: ['agency'], brand: ['brand'] } as const;

export function OnboardingForm({
  initialRole,
  invite,
  team,
  existingRoles,
  isMinor,
  sports,
  positions,
}: {
  initialRole?: string;
  invite?: string;
  team?: string;
  existingRoles: string[];
  isMinor: boolean;
  sports: Sport[];
  positions: SportPosition[];
}) {
  const [state, action] = useActionState<FormState, FormData>(completeOnboarding, undefined);
  const available = ACTORS.filter((a) => (!isMinor || !a.adultsOnly) && !existingRoles.includes(a.role));
  const [orgMode, setOrgMode] = useState<'create' | 'join_later'>(team ? 'join_later' : 'create');
  const [role, setRole] = useState(available.find((a) => a.role === initialRole)?.role ?? (isMinor ? 'athlete' : ''));
  const [sport, setSport] = useState('');
  const sportPositions = useMemo(() => positions.filter((p) => p.sport_id === sport), [positions, sport]);
  const fe = state?.fieldErrors ?? {};
  const thisYear = new Date().getFullYear();

  return (
    <form action={action} className="mt-8 space-y-8">
      {invite && <input type="hidden" name="invite" value={invite} />}
      {team && <input type="hidden" name="team" value={team} />}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}

      <fieldset>
        <legend className="sr-only">Tipo de cuenta</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {available.map((a) => (
            <label
              key={a.role}
              className={cx(
                'flex cursor-pointer flex-col rounded-[var(--radius-card)] border bg-surface p-4 transition-colors',
                role === a.role ? 'border-brass' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="role" value={a.role} checked={role === a.role} onChange={() => setRole(a.role)} className="accent-[var(--color-brass)]" />
                <span className="font-medium text-paper">{a.intent}</span>
              </span>
              <span className="mt-2 pl-7 text-sm text-muted">{a.promise}</span>
            </label>
          ))}
        </div>
        {isMinor && (
          <p className="mt-3 text-sm text-faint">Como eres menor de edad, tu cuenta es de atleta. Tu familia puede crear su propia cuenta y vincularse contigo.</p>
        )}
      </fieldset>

      {role && (
        <div className="space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <Field label="País (código de 2 letras)" htmlFor="country" hint="Por ejemplo ES o US." error={fe.country}>
            <input id="country" name="country" defaultValue="ES" maxLength={2} required className={cx(inputClass, 'uppercase')} />
          </Field>

          {role === 'athlete' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Deporte" htmlFor="sport_id" error={fe.sport_id}>
                  <select id="sport_id" name="sport_id" required value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass}>
                    <option value="">Elige…</option>
                    {sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                  </select>
                </Field>
                <Field label="Posición o prueba principal" htmlFor="primary_position_id" error={fe.primary_position_id}>
                  <select id="primary_position_id" name="primary_position_id" required disabled={!sport} className={inputClass}>
                    <option value="">{sport ? 'Elige…' : 'Primero el deporte'}</option>
                    {sportPositions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Año en que terminas el instituto" htmlFor="graduation_year" hint="Bachillerato o equivalente." error={fe.graduation_year}>
                  <select id="graduation_year" name="graduation_year" required className={inputClass} defaultValue={thisYear + 1}>
                    {Array.from({ length: 7 }, (_, i) => thisYear - 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="Ciudad" htmlFor="city" hint="Opcional. Solo la ciudad, nunca tu dirección.">
                  <input id="city" name="city" className={inputClass} />
                </Field>
              </div>
              <Field label="Equipo actual" htmlFor="current_team" hint="Opcional.">
                <input id="current_team" name="current_team" className={inputClass} />
              </Field>
            </>
          )}

          {role === 'coach' && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-paper">¿Dónde entrenas?</legend>
              <label className="flex items-center gap-2 text-sm text-paper">
                <input type="radio" name="org_mode" value="join_later" checked={orgMode === 'join_later'} onChange={() => setOrgMode('join_later')} className="accent-[var(--color-brass)]" />
                En una universidad o college: me invitará su cuenta oficial
              </label>
              <label className="flex items-center gap-2 text-sm text-paper">
                <input type="radio" name="org_mode" value="create" checked={orgMode === 'create'} onChange={() => setOrgMode('create')} className="accent-[var(--color-brass)]" />
                En un club o academia: quiero darlo de alta
              </label>
            </fieldset>
          )}

          {(role === 'university' || role === 'agent' || role === 'brand' || (role === 'coach' && orgMode === 'create')) && (
            <>
              <Field
                label={role === 'brand' ? 'Nombre de la marca' : role === 'agent' ? 'Nombre de la agencia' : role === 'university' ? 'Universidad o college' : 'Club o academia'}
                htmlFor="org_name"
                error={fe.org_name}
              >
                <input id="org_name" name="org_name" required className={inputClass} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Tipo" htmlFor="org_type" error={fe.org_type}>
                  <select id="org_type" name="org_type" className={inputClass}>
                    {ORG_TYPES[role].map((t) => <option key={t} value={t}>{ORG_TYPE_LABEL[t]}</option>)}
                  </select>
                </Field>
                {role === 'university' && (
                  <Field label="División" htmlFor="division">
                    <select id="division" name="division" className={inputClass} defaultValue="">
                      <option value="">—</option>
                      {Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Web oficial" htmlFor="org_website" hint="La usamos para verificar tu organización (dominio oficial).">
                <input id="org_website" name="org_website" inputMode="url" placeholder="https://" className={inputClass} />
              </Field>
              <Notice>
                Revisaremos tu organización antes de que puedas publicar
                {role === 'university' || role === 'coach' ? ' becas o ver perfiles de menores' : role === 'brand' ? ' ofertas' : ' y representar atletas'}. Mientras tanto ya puedes explorar la plataforma.
              </Notice>
            </>
          )}

          {role === 'coach' && orgMode === 'join_later' && (
            <>
              <input type="hidden" name="org_type" value="club" />
              <Notice>Pide a la cuenta oficial de tu universidad un enlace de invitación al equipo. Al abrirlo quedarás vinculado/a.</Notice>
            </>
          )}

          {role === 'parent' && (
            <Notice>
              Después podrás invitar a tu hijo o hija con un enlace. Solo verás su perfil cuando acepte, y siempre con los permisos que elija.
            </Notice>
          )}

          <SubmitButton className="w-full sm:w-auto" pendingText="Preparando tu espacio…">Continuar</SubmitButton>
        </div>
      )}
    </form>
  );
}
