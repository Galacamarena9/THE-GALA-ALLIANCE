import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ButtonLink, Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { acceptRosterInvite } from '@/app/actions/autonomy';
import { ORG_TYPE_LABEL } from '@/lib/domain/labels';
import type { OrgType } from '@/lib/types';

export const metadata: Metadata = { title: 'Unirte al roster', robots: { index: false } };

export default async function RosterInvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  const validFormat = /^[a-f0-9]{64}$/.test(token);

  type Preview = { organization_name: string; organization_type: OrgType; season: string; valid: boolean };
  let preview: Preview | null = null;
  if (validFormat) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('preview_roster_invitation', { p_token: token });
    preview = ((data as Preview[] | null)?.[0]) ?? null;
  }

  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8"><Logo /></header>
      <main className="mx-auto max-w-lg px-5 pt-8">
        <Card>
          <p className="text-[13px] font-semibold text-brass">Roster de club</p>
          {!validFormat || !preview ? (
            <Notice tone="danger">Este enlace no es válido.</Notice>
          ) : !preview.valid ? (
            <Notice tone="warn">Este enlace ha caducado o se ha desactivado. Pide uno nuevo a tu club.</Notice>
          ) : (
            <>
              <h1 className="mt-2 text-2xl text-paper">{preview.organization_name} te invita a su roster {preview.season}</h1>
              <p className="mt-3 text-sm text-muted">
                Organización verificada ({ORG_TYPE_LABEL[preview.organization_type].toLowerCase()}). Si aceptas, el club podrá confirmar tus estadísticas y,
                solo si lo marcas, ver cuántas candidaturas tienes y en qué estado están. No verá tus mensajes ni tus documentos.
                Puedes salir del roster cuando quieras.
              </p>
              {!session ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  <ButtonLink href={`/login?next=/roster/${token}`}>Entrar</ButtonLink>
                  <ButtonLink href="/signup?role=athlete" variant="secondary">Crear mi Passport gratis</ButtonLink>
                </div>
              ) : !session.roles.includes('athlete') ? (
                <div className="mt-4"><Notice tone="warn">Solo los atletas pueden unirse a un roster. Comparte este enlace con tu hijo o hija.</Notice></div>
              ) : (
                <>
                  {error && <div className="mt-4"><Notice tone="danger">No se ha podido completar. Comprueba que tu Passport está creado.</Notice></div>}
                  <form action={acceptRosterInvite} className="mt-6 grid gap-4">
                    <input type="hidden" name="token" value={token} />
                    <label className="flex gap-2 text-sm text-muted">
                      <input type="checkbox" name="shares_progress" defaultChecked className="mt-1 accent-[var(--color-brass)]" />
                      <span>Compartir con el club el número de candidaturas y su estado (nunca los mensajes)</span>
                    </label>
                    <SubmitButton pendingText="Uniéndote…">Unirme al roster</SubmitButton>
                  </form>
                </>
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
