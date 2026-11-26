import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ButtonLink, Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { acceptFamilyInvitation } from '@/app/actions/family';

export const metadata: Metadata = { title: 'Invitación familiar', robots: { index: false } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  const validFormat = /^[a-f0-9]{64}$/.test(token);

  type Preview = { inviter_name: string; expects_role: string; valid: boolean };
  let preview: Preview | null = null;
  if (session && validFormat) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('preview_family_invitation', { p_token: token });
    preview = ((data as Preview[] | null)?.[0]) ?? null;
  }

  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8"><Logo /></header>
      <main id="main-content" className="mx-auto max-w-lg px-5 pt-8">
        <Card>
          <p className="text-[13px] font-semibold text-brass">Invitación familiar</p>
          {!validFormat ? (
            <Notice tone="danger">Este enlace no es válido.</Notice>
          ) : !session ? (
            <>
              <h1 className="mt-2 text-2xl text-paper">Te han invitado a vincular vuestras cuentas</h1>
              <p className="mt-3 text-sm text-muted">Entra o crea tu cuenta para aceptar. Si la creas ahora, vuelve a abrir este mismo enlace después. La familia solo verá lo que el atleta decida compartir.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink href={`/login?next=/invite/${token}`}>Entrar</ButtonLink>
                <ButtonLink href={`/signup`} variant="secondary">Crear cuenta</ButtonLink>
              </div>
            </>
          ) : !preview?.valid ? (
            <Notice tone="warn">Esta invitación ha caducado, ya se usó o fue cancelada. Pide un enlace nuevo.</Notice>
          ) : !session.roles.includes(preview.expects_role as 'athlete' | 'parent') ? (
            <Notice tone="warn">
              Esta invitación es para una cuenta de {preview.expects_role === 'athlete' ? 'atleta' : 'familia'}. Entra con la cuenta adecuada.
            </Notice>
          ) : (
            <>
              <h1 className="mt-2 text-2xl text-paper">{preview.inviter_name} quiere vincularse contigo</h1>
              <p className="mt-3 text-sm text-muted">
                {preview.expects_role === 'athlete'
                  ? 'Si aceptas, tu familia verá tu Passport, tus candidaturas y tu académico. Podrás cambiar estos permisos o desvincularla cuando quieras desde Privacidad.'
                  : 'Si aceptas, verás el progreso que tu hijo o hija decida compartir contigo.'}
              </p>
              {error && <div className="mt-4"><Notice tone={error === 'linked' ? 'warn' : 'danger'}>{error === 'linked' ? 'Ya estáis vinculados. No hace falta aceptar de nuevo.' : 'No se ha podido aceptar la invitación. Pide un enlace nuevo.'}</Notice></div>}
              <form action={acceptFamilyInvitation} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingText="Vinculando…">Aceptar y vincular</SubmitButton>
              </form>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
