import type { Instrumentation } from 'next';
import { log } from '@/lib/observability/log';

/**
 * Prompt 19 · Todo error de servidor queda registrado de forma estructurada, con el id de petición y el
 * «digest» que ve el usuario en la pantalla de error (para que soporte lo encuentre), y sin datos personales.
 * Si ERROR_WEBHOOK_URL está configurada (Sentry, Slack, etc.), se reenvía también el resumen.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined;
  const requestId = typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;
  const route = request.path.split('?')[0];
  const line = log('error', 'server_error', { message, digest, requestId, route, method: request.method, routeType: context.routeType });
  const hook = process.env.ERROR_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: line, signal: AbortSignal.timeout(2000) });
    } catch { /* la observabilidad nunca rompe la petición */ }
  }
};
