import { Logo } from '@/components/Logo';
import { Card, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { respondOutreach } from '@/app/actions/outreach';
import { RESPONSE_ANSWERS, RESPONSE_COPY, type ResponseAnswer } from '@/lib/domain/outreach';

export interface OutreachPreview { organizationName: string; status: string; valid: boolean }

const DONE: Record<string, string> = {
  accepted: RESPONSE_COPY.accept.done, declined: RESPONSE_COPY.decline.done, unsubscribed: RESPONSE_COPY.unsubscribe.done,
  expired: 'Este enlace ya se usó o ha caducado. Si queréis hablar con nosotros, responded al correo que recibisteis.',
  invalid: 'Este enlace no es válido.',
};

/** Página pública de respuesta a la invitación. Las acciones van por POST (un antivirus que abre el enlace no responde por vosotros). */
export function OutreachResponseView({ token, preview, ask, done, demo = false }: {
  token: string | null; preview: OutreachPreview | null; ask: ResponseAnswer | null; done: string | null; demo?: boolean;
}) {
  const answers: ResponseAnswer[] = ask ? [ask, ...RESPONSE_ANSWERS.filter((a) => a !== ask)] : [...RESPONSE_ANSWERS];
  return (
    <div className="paper-grain min-h-dvh">
      <header className="px-5 py-6 sm:px-8"><Logo /></header>
      <main className="mx-auto max-w-lg px-5 pt-8" id="main-content">
        <Card>
          <p className="text-[13px] font-semibold text-brass">Invitación a probar The Gala Alliance</p>
          {done ? (
            <div role="status" className="mt-3">
              <h1 className="text-2xl text-paper">{done === 'accepted' ? '¡Gracias!' : done === 'invalid' || done === 'expired' ? 'Enlace no disponible' : 'Hecho'}</h1>
              <p className="mt-3 text-sm text-muted">{DONE[done] ?? DONE.invalid}</p>
            </div>
          ) : !token || !preview ? (
            <Notice tone="danger">Este enlace no es válido.</Notice>
          ) : (
            <>
              <h1 className="mt-2 text-2xl text-paper">{preview.organizationName}</h1>
              {!preview.valid && <Notice tone="warn">Esta invitación ya se respondió o ha caducado. Aún podéis daros de baja.</Notice>}
              <p className="mt-3 text-sm text-muted">{RESPONSE_COPY[ask ?? 'accept'].ask}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {answers.filter((a) => preview.valid || a === 'unsubscribe').map((a, i) => (
                  <form key={a} action={demo ? undefined : respondOutreach}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="answer" value={a} />
                    <SubmitButton variant={i === 0 ? 'primary' : a === 'unsubscribe' ? 'ghost' : 'secondary'}>{RESPONSE_COPY[a].button}</SubmitButton>
                  </form>
                ))}
              </div>
              <p className="mt-6 text-xs text-faint">Solo guardamos el nombre de vuestra organización y el correo público al que os escribimos. Si os dais de baja, no volveremos a escribiros.</p>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
