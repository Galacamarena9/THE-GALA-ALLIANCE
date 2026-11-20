import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type SendResult = 'sent' | 'not_configured' | 'failed';

/**
 * Envía el enlace de verificación del correo institucional.
 * El token lo genera la base de datos (email_verification_issue, solo con la clave secreta) y únicamente viaja en el correo:
 * nunca se devuelve al navegador. Sin SUPABASE_SECRET_KEY, RESEND_API_KEY y EMAIL_FROM, no se envía nada
 * y la verificación queda en revisión manual (no se finge un envío).
 */
export async function sendVerificationEmail(verificationId: string, to: string, siteUrl: string): Promise<SendResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!url || !secret || !resendKey || !from) return 'not_configured';
  try {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: token, error } = await admin.rpc('email_verification_issue', { p_id: verificationId });
    if (error || typeof token !== 'string') return 'failed';
    const link = `${siteUrl}/app/verify/email?id=${verificationId}&t=${token}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to],
        subject: 'Confirma tu correo institucional · The Gala Alliance',
        html: `<p>Pulsa para confirmar que este correo es tuyo. El enlace caduca en 30 minutos y solo funciona una vez, con tu sesión iniciada.</p><p><a href="${link}">Confirmar correo</a></p><p>Si no lo has pedido tú, ignora este mensaje.</p>`,
      }),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
