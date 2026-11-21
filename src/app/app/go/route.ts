import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { logEvent } from '@/lib/events';
import { ATTENTION_RANK, safeInternalPath, type AttentionKind } from '@/lib/domain/agent-home';

/**
 * Prompt 5 · Registra que el agente abrió un elemento de «Necesita atención» y le lleva a su destino.
 * Solo rutas internas de /app (ver safeInternalPath): nunca una redirección abierta.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') ?? '/app';
  const kind = req.nextUrl.searchParams.get('k') ?? '';
  const dest = safeInternalPath(to);
  const session = await getSession();
  if (session && kind in ATTENTION_RANK) await logEvent('agent_attention_opened', { kind: kind as AttentionKind });
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin), 303);
}
