import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Logo } from '@/components/Logo';
import { ButtonLink, Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { ORG_TYPE_LABEL } from '@/lib/domain/labels';
import { planLimitMessage } from '@/lib/domain/plan-limits';
import type { OrgType } from '@/lib/types';

export const metadata: Metadata = { title: 'Unirse al equipo', robots: { index: false } };

async function acceptTeamInvitation(formData: FormData) {
  'use server';
  const token = z.string().regex(/^[a-f0-9]{64}$/).parse(formData.get('token'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_organization_invitation', { p_token: token });
  if (error) redirect(`/join/${token}?error=${error.message.includes('plan_seat_limit') ? 'seats' : '1'}`);
  redirect('/app/organization');
}

export default async function JoinTeamPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  const valid = /^[a-f0-9]{64}$/.test(token);

  type Preview = { organization_name: string; organization_type: OrgType; valid: boolean };
  let preview: Preview | null = null;
  if (session && valid) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('preview_organization_invitation', { p_token: token });
    preview = ((data as Preview[] | null)?.[0]) ?? null;
  }

  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8"><Logo /></header>
      <main className="mx-auto max-w-lg px-5 pt-8">
        <Card>
          <p className="text-[13px] font-semibold text-brass">Invitación de equipo</p>
          {!valid ? (
            <Notice tone="danger">Enlace no válido.</Notice>
          ) : !session ? (
            <>
              <h1 className="mt-2 text-2xl text-paper">Te han invitado a un equipo de recruiting</h1>
              <p className="mt-3 text-sm text-muted">Crea tu cuenta de coach o entra para aceptar.</p>
              <div className="mt-6 flex gap-2">
                <ButtonLink href={`/login?next=/join/${token}`}>Entrar</ButtonLink>
                <ButtonLink href="/signup?role=coach" variant="secondary">Crear cuenta de coach</ButtonLink>
              </div>
            </>
          ) : !session.onboardingCompleted ? (
            <ButtonLink href={`/onboarding?role=coach&team=${token}`}>Completar mi registro de coach</ButtonLink>
          ) : !preview?.valid ? (
            <Notice tone="warn">Esta invitación ha caducado o ya se usó. Pide un enlace nuevo.</Notice>
          ) : (
            <>
              <h1 className="mt-2 text-2xl text-paper">{preview.organization_name}</h1>
              <p className="mt-1 text-sm text-muted">{ORG_TYPE_LABEL[preview.organization_type]} · te invita a su equipo de recruiting</p>
              {!session.roles.includes('coach') && !session.roles.includes('university') && (
                <div className="mt-4"><Notice tone="warn">Necesitas un perfil de coach. <a className="underline" href={`/onboarding?add=1&role=coach&team=${token}`}>Añádelo aquí</a>.</Notice></div>
              )}
              {error && <div className="mt-4"><Notice tone="danger">{error === 'seats' ? planLimitMessage('plan_seat_limit') : 'No se ha podido aceptar la invitación.'}</Notice></div>}
              <form action={acceptTeamInvitation} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingText="Uniéndote…">Unirme al equipo</SubmitButton>
              </form>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
