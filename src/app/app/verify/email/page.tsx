import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Card } from '@/components/ui';

export const metadata: Metadata = { title: 'Confirmar correo institucional' };

/** Destino del enlace del correo. Requiere la sesión de quien lo pidió; un solo uso, caduca y limita intentos (BD). */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ id?: string; t?: string }> }) {
  await requireSession();
  const { id, t } = await searchParams;
  let ok = false;
  if (id && /^[0-9a-f-]{36}$/.test(id) && t && /^[0-9a-f]{64}$/.test(t)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('email_verification_confirm', { p_id: id, p_token: t });
    ok = data === true;
  }
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        {ok ? (
          <>
            <p className="font-display text-2xl font-bold text-paper">Correo institucional verificado ✓</p>
            <p className="mt-2 text-sm text-muted">Es un paso de tu verificación, no la verificación completa: todavía revisamos tu afiliación, programa y cargo.</p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-bold text-paper">No hemos podido confirmar el enlace</p>
            <p className="mt-2 text-sm text-muted">Puede que haya caducado (30 minutos), que ya se usara o que lo abras con otra cuenta. Pide uno nuevo desde tu estado de verificación.</p>
          </>
        )}
        <ButtonLink href="/app/verify" className="mt-5 min-h-12 w-full justify-center">Ver mi verificación</ButtonLink>
      </Card>
    </div>
  );
}
