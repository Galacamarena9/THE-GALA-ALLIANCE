import Link from 'next/link';
import { Notice } from '@/components/ui';
import { getT } from '@/lib/i18n/server-t';

/**
 * Conversación con un menor sin tutor activo: la base de datos no deja escribir a nadie (conversation_frozen_no_guardian).
 * Aquí solo se explica, a cada lado con sus palabras. A la organización no se le da ningún dato de la familia.
 */
export async function ThreadPausedNotice({ side }: { side: 'athlete' | 'family' | 'organization' }) {
  const tx = await getT();
  return (
    <Notice tone="warn">
      {side === 'organization'
        ? tx('Conversación en pausa por protección de menores: este atleta no tiene ahora mismo un tutor activo. No se pueden enviar mensajes hasta que su familia vuelva a estar activa; te avisaremos cuando se reanude.')
        : tx('Esta conversación está en pausa porque ahora mismo no tienes un familiar o tutor activo en tu cuenta. Nadie puede escribir aquí hasta que vuelva a haberlo: invita a tu madre, padre o tutor desde Ajustes.')}
      {side === 'athlete' && <> <Link href="/app/settings#familia" className="font-semibold underline">{tx('Ir a Ajustes')}</Link></>}
    </Notice>
  );
}
