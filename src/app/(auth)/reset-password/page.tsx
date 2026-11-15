import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Notice } from '@/components/ui';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } };

/** Se llega desde el enlace del email (que crea una sesión temporal). Sin sesión, el enlace caducó. */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return (
    <>
      <h1 className="text-3xl text-paper">Crea tu nueva contraseña</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Al guardarla, cerraremos tu sesión en los demás dispositivos.</p>
      {data.user ? <ResetForm /> : (
        <div className="space-y-4">
          <Notice tone="danger">Este enlace ha caducado o ya se usó.</Notice>
          <Link href="/forgot-password" className="block text-center text-sm font-semibold text-brass hover:underline">Pedir un enlace nuevo</Link>
        </div>
      )}
    </>
  );
}
