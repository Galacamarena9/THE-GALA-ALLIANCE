import Anthropic from '@anthropic-ai/sdk';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { handle, provider } from '@/lib/ai/orchestrator';

export const runtime = 'nodejs';

const bodySchema = z.object({
  mode: z.enum(['chat', 'search']).default('chat'),
  page: z.string().regex(/^\/[A-Za-z0-9/_-]{0,120}$/).optional(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(16),
});

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';

/**
 * Gala IA.
 * - Requiere sesión y respeta límites atómicos en base de datos (40/día, 6/minuto).
 * - No guarda las conversaciones (minimización): solo métricas técnicas sin contenido (ai_events).
 * - Modo "chat": orquestador con herramientas internas de solo lectura (RLS) → eventos NDJSON.
 *   Sin ANTHROPIC_API_KEY responde con datos reales de forma determinista (sin modelo).
 * - Modo "search": traduce lenguaje natural a filtros VISIBLES del escaparate.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  if (parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const supabase = await createClient();
  const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_request');
  if (quotaError) return NextResponse.json({ error: 'quota_check_failed' }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: 'Has llegado al límite de Gala IA (40 al día, 6 por minuto). Espera un momento.' }, { status: 429 });

  if (parsed.data.mode === 'search') {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'La búsqueda en lenguaje natural no está activada. Usa los filtros.' }, { status: 503 });
    const client = new Anthropic();
    const catalog = await loadCatalog();
    const positionCodes = catalog.positions.map((p) => `${p.sport_id}:${p.name_es}=${p.id}`).join(', ');
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `Conviertes peticiones de búsqueda de talento deportivo en filtros estructurados. Solo usa valores existentes. Posiciones disponibles (deporte:nombre=id): ${positionCodes}. Deportes: ${catalog.sports.map((s) => s.id).join(', ')}. No infieras datos sensibles (etnia, salud, religión) ni filtres por ellos.`,
      tools: [
        {
          name: 'set_filters',
          description: 'Aplica filtros al escaparate de atletas.',
          input_schema: {
            type: 'object',
            properties: {
              sport: { type: 'string', enum: catalog.sports.map((s) => s.id) },
              position: { type: 'integer', description: 'id de posición' },
              grad: { type: 'integer', minimum: 2024, maximum: 2040 },
              division: { type: 'string', enum: ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa'] },
              gpa: { type: 'string', enum: ['2.3', '2.5', '3.0', '3.5'] },
              video: { type: 'boolean' },
              explanation: { type: 'string', description: 'Frase corta en español explicando los filtros aplicados.' },
            },
            required: ['explanation'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'set_filters' },
      messages: [{ role: 'user', content: parsed.data.messages.at(-1)!.content }],
    });
    const tool = response.content.find((b) => b.type === 'tool_use');
    if (!tool || tool.type !== 'tool_use') return NextResponse.json({ error: 'no_filters' }, { status: 502 });
    const f = tool.input as Record<string, unknown>;
    const params = new URLSearchParams();
    if (typeof f.sport === 'string') params.set('sport', f.sport);
    if (typeof f.position === 'number' && catalog.positions.some((p) => p.id === f.position)) params.set('position', String(f.position));
    if (typeof f.grad === 'number') params.set('grad', String(f.grad));
    if (typeof f.division === 'string') params.set('division', f.division);
    if (typeof f.gpa === 'string') params.set('gpa', f.gpa);
    if (f.video === true) params.set('video', '1');
    return NextResponse.json({ url: `/app/discover?${params.toString()}`, explanation: String(f.explanation ?? '') });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      let meta: { requestId: string; intent: string; mode: string } | null = null;
      try {
        for await (const ev of handle(session, parsed.data.messages, parsed.data.page)) {
          if (ev.type === 'meta') meta = ev;
          send(ev);
          if (ev.type === 'done' && meta) {
            await supabase.rpc('log_ai_event', {
              p_id: meta.requestId, p_intent: meta.intent, p_mode: meta.mode, p_outcome: ev.usage.outcome,
              p_provider: meta.mode === 'model' ? provider.name : null, p_model: meta.mode === 'model' ? provider.model : null,
              p_input: ev.usage.input, p_output: ev.usage.output, p_tools: ev.usage.tools, p_latency: ev.usage.latencyMs, p_page: parsed.data.page ?? null,
            });
          }
        }
      } catch {
        send({ type: 'error', message: 'Se ha interrumpido la respuesta. Inténtalo de nuevo.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
