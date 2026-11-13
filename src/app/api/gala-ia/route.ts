import Anthropic from '@anthropic-ai/sdk';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { GALA_SYSTEM, buildUserContext } from '@/lib/ai/galaContext';

export const runtime = 'nodejs';

const bodySchema = z.object({
  mode: z.enum(['chat', 'search']).default('chat'),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(16),
});

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';

/**
 * Gala IA.
 * - Requiere sesión y respeta un límite diario atómico en base de datos.
 * - No guarda las conversaciones (minimización de datos).
 * - Modo "search": traduce lenguaje natural a filtros VISIBLES del escaparate.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Gala IA no está configurada todavía (falta ANTHROPIC_API_KEY).' }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  if (parsed.data.messages.at(-1)?.role !== 'user') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const supabase = await createClient();
  const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_request');
  if (quotaError) return NextResponse.json({ error: 'quota_check_failed' }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: 'Has llegado al límite diario de Gala IA. Vuelve mañana.' }, { status: 429 });

  const client = new Anthropic();

  if (parsed.data.mode === 'search') {
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

  const context = await buildUserContext(session);
  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    stream: true,
    system: [
      { type: 'text', text: GALA_SYSTEM },
      { type: 'text', text: `# Contexto\n${context}` },
    ],
    messages: parsed.data.messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(encoder.encode('\n\n[Se ha interrumpido la respuesta. Inténtalo de nuevo.]'));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
