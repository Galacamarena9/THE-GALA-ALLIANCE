import 'server-only';

export type SendResult = 'sent' | 'not_configured' | 'failed';

/**
 * Envía un correo con Resend (el mismo proveedor que la verificación de correo).
 * Sin RESEND_API_KEY y EMAIL_FROM no se envía nada y se devuelve `not_configured`: nunca se finge un envío.
 */
export async function sendEmail(p: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return 'not_configured';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [p.to], subject: p.subject, html: p.html, text: p.text,
        ...(p.replyTo ? { reply_to: p.replyTo } : {}),
      }),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Correo al que se avisa a Gala cuando una organización responde (además del aviso dentro de la app). */
export const outreachNotifyEmail = () => process.env.OUTREACH_NOTIFY_EMAIL || null;
export const outreachReplyTo = () => process.env.OUTREACH_REPLY_TO || process.env.OUTREACH_NOTIFY_EMAIL || undefined;
export const outreachSenderName = () => process.env.OUTREACH_SENDER_NAME || 'Gala';
