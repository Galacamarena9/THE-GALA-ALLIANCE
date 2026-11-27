'use client';

import { useActionState, useMemo, useState } from 'react';
import { completeOnboarding } from '@/app/actions/onboarding';
import type { FormState } from '@/app/actions/auth';
import { ACTORS, ACTOR_EN } from '@/lib/domain/roles';
import { DIVISION_LABEL, ORG_TYPE_LABEL, ORG_TYPE_LABEL_EN } from '@/lib/domain/labels';
import type { Locale } from '@/lib/i18n/locale';
import { ONBOARDING_COPY } from './copy';
import type { Sport, SportPosition } from '@/lib/types';
import { Field, inputClass, Notice, cx } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

const ORG_TYPES = { university: ['university', 'college'], coach: ['club', 'academy'], agent: ['agency'], brand: ['brand'] } as const;

export function OnboardingForm({
  locale = 'es',
  initialRole,
  invite,
  team,
  next,
  existingRoles,
  isMinor,
  sports,
  positions,
}: {
  locale?: Locale;
  initialRole?: string;
  invite?: string;
  team?: string;
  next?: string;
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
  const t = ONBOARDING_COPY[locale];
  const orgLabels = locale === 'en' ? ORG_TYPE_LABEL_EN : ORG_TYPE_LABEL;

  return (
    <form action={action} className="mt-8 space-y-8">
      {invite && <input type="hidden" name="invite" value={invite} />}
      {team && <input type="hidden" name="team" value={team} />}
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}

      <fieldset>
        <legend className="sr-only">{t.accountType}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {available.map((a) => (
            <label
              key={a.role}
              className={cx(
                'flex cursor-pointer flex-col rounded-[var(--radius-card)] border p-4 transition-all',
                role === a.role ? 'night-scope border-lime bg-night shadow-[var(--shadow-gold)] ring-2 ring-lime/60' : 'border-transparent bg-surface shadow-[0_10px_28px_-18px_rgb(15_26_20/0.35)] hover:-translate-y-0.5',
              )}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="role" value={a.role} checked={role === a.role} onChange={() => setRole(a.role)} className="accent-[var(--color-brass)]" />
                <span className="font-medium text-paper">{locale === 'en' ? ACTOR_EN[a.role].intent : a.intent}</span>
              </span>
              <span className="mt-2 pl-7 text-sm text-muted">{locale === 'en' ? ACTOR_EN[a.role].promise : a.promise}</span>
            </label>
          ))}
        </div>
        {isMinor && (
          <p className="mt-3 text-sm text-faint">{t.minorNote}</p>
        )}
      </fieldset>

      {role && (
        <div className="space-y-5 rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-elevated)] ring-1 ring-line/60">
          <Field label={t.country} htmlFor="country" hint={t.countryHint} error={fe.country}>
            <input id="country" name="country" defaultValue={locale === 'en' ? 'US' : 'ES'} maxLength={2} required className={cx(inputClass, 'uppercase')} />
          </Field>

          {role === 'athlete' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.sport} htmlFor="sport_id" error={fe.sport_id}>
                  <select id="sport_id" name="sport_id" required value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass}>
                    <option value="">{t.choose}</option>
                    {sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                  </select>
                </Field>
                <Field label={t.position} htmlFor="primary_position_id" error={fe.primary_position_id}>
                  <select id="primary_position_id" name="primary_position_id" required disabled={!sport} className={inputClass}>
                    <option value="">{sport ? t.choose : t.sportFirst}</option>
                    {sportPositions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.gradYear} htmlFor="graduation_year" hint={t.gradHint} error={fe.graduation_year}>
                  <select id="graduation_year" name="graduation_year" required className={inputClass} defaultValue={thisYear + 1}>
                    {Array.from({ length: 7 }, (_, i) => thisYear - 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label={t.city} htmlFor="city" hint={t.cityHint}>
                  <input id="city" name="city" className={inputClass} />
                </Field>
              </div>
              <Field label={t.team} htmlFor="current_team" hint={t.optional}>
                <input id="current_team" name="current_team" className={inputClass} />
              </Field>
            </>
          )}

          {role === 'coach' && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-paper">{t.whereCoach}</legend>
              <label className="flex items-center gap-2 text-sm text-paper">
                <input type="radio" name="org_mode" value="join_later" checked={orgMode === 'join_later'} onChange={() => setOrgMode('join_later')} className="accent-[var(--color-brass)]" />
                {t.coachCollege}
              </label>
              <label className="flex items-center gap-2 text-sm text-paper">
                <input type="radio" name="org_mode" value="create" checked={orgMode === 'create'} onChange={() => setOrgMode('create')} className="accent-[var(--color-brass)]" />
                {t.coachClub}
              </label>
            </fieldset>
          )}

          {(role === 'university' || role === 'agent' || role === 'brand' || (role === 'coach' && orgMode === 'create')) && (
            <>
              <Field
                label={t.orgName[role as 'brand' | 'agent' | 'university' | 'coach']}
                htmlFor="org_name"
                error={fe.org_name}
              >
                <input id="org_name" name="org_name" required className={inputClass} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.orgType} htmlFor="org_type" error={fe.org_type}>
                  <select id="org_type" name="org_type" className={inputClass}>
                    {ORG_TYPES[role].map((o) => <option key={o} value={o}>{orgLabels[o]}</option>)}
                  </select>
                </Field>
                {role === 'university' && (
                  <Field label={t.division} htmlFor="division" hint={t.divisionHint} error={fe.division}>
                    <select id="division" name="division" required className={inputClass} defaultValue="">
                      <option value="" disabled>{t.divisionPick}</option>
                      {Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                )}
              </div>
              <Field label={t.website} htmlFor="org_website" hint={t.websiteHint}>
                <input id="org_website" name="org_website" inputMode="url" placeholder="https://" className={inputClass} />
              </Field>
              <Notice>{t.review(role === 'university' || role === 'coach' ? 'staff' : role === 'brand' ? 'brand' : 'agent')}</Notice>
            </>
          )}

          {role === 'coach' && orgMode === 'join_later' && (
            <>
              <input type="hidden" name="org_type" value="club" />
              <Notice>{t.collegeInvite}</Notice>
            </>
          )}

          {role === 'parent' && (
            <Notice>{t.parentNote}</Notice>
          )}

          <SubmitButton className="w-full sm:w-auto" pendingText={t.preparing}>{t.continue}</SubmitButton>
        </div>
      )}
    </form>
  );
}
