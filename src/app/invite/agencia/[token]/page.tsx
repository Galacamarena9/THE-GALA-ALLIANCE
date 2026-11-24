import type { Metadata } from 'next';
import { BadgeCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink, Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { claimAgencyInvite } from '@/app/actions/portfolio-invites';

export const metadata: Metadata = { title: 'Invitación de una agencia', robots: { index: false } };

/** El atleta abre el enlace personal que le ha pasado su agencia y decide si la deja acompañarle. */
export default async function AgencyInvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const valid = /^[a-f0-9]{64}$/.test(token);
  const session = await getSession();
  type Preview = { agency_name: string | null; agency_verified: boolean; valid: boolean };
  let preview: Preview | null = null;
  if (valid) {
    const { data } = await (await createClient()).rpc('agency_invite_preview', { p_token: token });
    preview = ((data as Preview[] | null)?.[0]) ?? null;
  }
  const next = `/invite/agencia/${token}`;

  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8"><Logo /></header>
      <main id="main-content" className="mx-auto max-w-lg px-5 pb-16 pt-8">
        <Card>
          <p className="eyebrow text-brass">Invitación de una agencia</p>
          {!valid || !preview?.valid ? (
            <div className="mt-3"><Notice tone="warn">Este enlace ya no es válido: caducó, se usó o la agencia lo canceló. Pídele uno nuevo.</Notice></div>
          ) : (
            <>
              <h1 className="mt-3 font-display text-4xl leading-none text-paper">{preview.agency_name} quiere <em>acompañarte</em></h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                {preview.agency_verified ? <><BadgeCheck className="h-4 w-4 text-ok" aria-hidden /> Agencia verificada por The Gala Alliance</> : 'Agencia pendiente de verificación: podrá enviarte su propuesta cuando la verifiquemos.'}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-paper/85">
                <li>· Tu perfil (Gala Passport) es tuyo y gratis, siempre.</li>
                <li>· Aceptar este enlace solo permite que la agencia te envíe su propuesta. Verás el alcance exacto y decidirás después.</li>
                <li>· Si eres menor, tu familia aprueba antes de que empiece nada.</li>
                <li>· Si vas a la NCAA: no aceptes tarifas ligadas a conseguir una beca ni regalos de una agencia.</li>
              </ul>
              {error && <div className="mt-4"><Notice tone="danger">{error === 'blocked' ? 'Has bloqueado a esta agencia.' : 'No se ha podido aceptar. Pide un enlace nuevo a tu agencia.'}</Notice></div>}
              {!session ? (
                <>
                <div className="mt-6 flex flex-wrap gap-2">
                  <ButtonLink href={`/signup?role=athlete&next=${encodeURIComponent(next)}`}>Crear mi perfil gratis</ButtonLink>
                  <ButtonLink href={`/login?next=${encodeURIComponent(next)}`} variant="secondary">Ya tengo cuenta</ButtonLink>
                </div>
                <p className="mt-3 text-xs text-faint">Si creas la cuenta ahora, al confirmar tu email y completar tu perfil volverás aquí para aceptar.</p>
                </>
              ) : !session.roles.includes('athlete') ? (
                <div className="mt-6"><Notice tone="warn">Esta invitación es para el atleta. Entra con la cuenta de atleta (si eres la familia, pídele que la abra él o ella).</Notice></div>
              ) : (
                <form action={claimAgencyInvite} className="mt-6">
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton pendingText="Aceptando…">Aceptar y ver su propuesta</SubmitButton>
                </form>
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
