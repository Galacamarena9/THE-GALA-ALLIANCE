import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server-t';
import { Card, Notice, PageHeader, buttonClass, inputClass } from '@/components/ui';
import { openAgencyThread } from '@/app/actions/connect';

export const metadata: Metadata = { title: 'Nuevo mensaje' };

/**
 * Primer mensaje de la agencia a un atleta que representa (QA agente, hallazgo 4). Si ya hay conversación abierta,
 * la acción lleva directamente a ella; aquí solo se llega cuando no existe y hay que escribir el primer mensaje.
 */
export default async function NewAgencyThreadPage({ searchParams }: { searchParams: Promise<{ atleta?: string; error?: string }> }) {
  await requireSession(['agent']);
  const sp = await searchParams;
  const athleteId = z.string().uuid().safeParse(sp.atleta);
  if (!athleteId.success) redirect('/app/inbox');
  const tx = await getT();
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', athleteId.data).maybeSingle();
  const name = (profile?.display_name as string | undefined) ?? tx('tu atleta');
  const ERR: Record<string, string> = {
    sin_permiso: tx('Este atleta no te ha dado permiso para participar en sus conversaciones (o la representación ya no está activa).'),
    corto: tx('Escribe al menos 20 caracteres.'),
    abierta: tx('Ya hay una conversación abierta con este atleta: vuelve a la bandeja.'),
    verified_organization_required: tx('Tu agencia debe estar verificada para escribir a atletas.'),
    guardian_required: tx('Este atleta es menor y aún no tiene a su familia vinculada: no es posible escribirle todavía.'),
    rate_limited: tx('Has alcanzado el límite diario. Inténtalo mañana.'),
    contact_data_not_allowed_with_minors: tx('Con menores no se pueden compartir emails, teléfonos ni redes sociales. Todo queda dentro de la plataforma.'),
    error: tx('No se ha podido abrir la conversación. Inténtalo de nuevo.'),
  };
  const err = sp.error ? ERR[sp.error] ?? ERR.error : null;
  return (
    <>
      <Link href={`/app/portfolio/${athleteId.data}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-paper"><ArrowLeft className="h-4 w-4" aria-hidden /> {tx('Volver a la ficha')}</Link>
      <PageHeader kicker={tx('Mensajes')} title={tx(`Escribir a ${name}`)} description={tx('Abre la conversación con un primer mensaje: lo verá en su bandeja y podrá responderte aquí. Si es menor, pasa primero por su familia, que también ve la conversación, y no se permiten emails, teléfonos ni redes.')} />
      {err && <div className="mb-4"><Notice tone="danger">{err}</Notice></div>}
      <Card>
        <form action={openAgencyThread} className="grid gap-3">
          <input type="hidden" name="athlete_id" value={athleteId.data} />
          <label htmlFor="message" className="text-sm font-semibold text-paper">{tx('Primer mensaje')}</label>
          <textarea id="message" name="message" required minLength={20} maxLength={1500} rows={5} className={inputClass} placeholder={tx('Ej.: Hola, ¿puedes subir tu certificado de notas traducido antes del viernes?')} />
          <div><button className={buttonClass('primary')}>{tx('Enviar y abrir conversación')}</button></div>
        </form>
      </Card>
    </>
  );
}
