import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, CardTitle, Field, PageHeader, inputClass } from '@/components/ui';
import { AskGala, type SavedMsg } from '@/components/AskGala';
import { deleteAiConversation, deleteAllAiConversations, saveAiPreferences } from '@/app/actions/ai';

export const metadata: Metadata = { title: 'Gala IA' };

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function GalaIaPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const session = await requireSession();
  const { q, c } = await searchParams;
  const supabase = await createClient();
  const { data: prefs } = await supabase.from('ai_preferences').select('save_history, language, answer_style').eq('user_id', session.userId).maybeSingle();
  const historyOn = Boolean(prefs?.save_history);

  const [{ data: convs }, { data: msgs }] = await Promise.all([
    historyOn ? supabase.from('ai_conversations').select('id, title, updated_at').order('updated_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] as { id: string; title: string; updated_at: string }[] }),
    historyOn && c && /^[0-9a-f-]{36}$/.test(c)
      ? supabase.from('ai_messages').select('role, content').eq('conversation_id', c).order('id').limit(200)
      : Promise.resolve({ data: [] as SavedMsg[] }),
  ]);
  const open = (convs ?? []).find((x) => x.id === c);

  return (
    <>
      <PageHeader
        kicker="Gala IA"
        title="Tu asistente para el proceso, 24/7"
        description="Consulta tus datos reales (Passport, Gala Match, pipeline y plazos) y la guía con fuentes oficiales. Explica, compara, prepara borradores y te propone acciones que tú confirmas. Nunca promete becas ni envía nada por ti."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="paper-grain">
          {open && (
            <p className="mb-3 text-xs text-muted">
              Retomando «{open.title}». Las respuestas guardadas reflejan tus datos de aquel momento: Gala volverá a consultar tus datos actuales en cada pregunta nueva.
            </p>
          )}
          {/* key: al cambiar de conversación se reinicia el estado del chat. */}
          <AskGala key={open?.id ?? 'new'} initialQuestion={(q ?? '').slice(0, 500)} conversationId={open?.id} initialMessages={open ? (msgs ?? []) as SavedMsg[] : []} historyOn={historyOn} />
        </Card>

        <aside className="space-y-6" aria-label="Historial y preferencias de Gala IA">
          {historyOn && (
            <Card>
              <CardTitle kicker="Historial">Tus conversaciones</CardTitle>
              <Link href="/app/ia" className="mb-3 inline-block text-sm font-semibold text-brass hover:underline">+ Nueva conversación</Link>
              {convs?.length ? (
                <ul className="space-y-1">
                  {convs.map((x) => (
                    <li key={x.id} className="flex items-center gap-2">
                      <Link href={`/app/ia?c=${x.id}`} aria-current={x.id === open?.id ? 'page' : undefined}
                        className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm ${x.id === open?.id ? 'bg-brass/10 text-brass' : 'text-paper hover:bg-surface'}`}>
                        {x.title}<span className="block text-[11px] text-faint">{fmt.format(new Date(x.updated_at))}</span>
                      </Link>
                      <form action={deleteAiConversation}>
                        <input type="hidden" name="id" value={x.id} />
                        <button className="rounded p-1 text-xs text-faint hover:text-danger" aria-label={`Borrar conversación: ${x.title}`}>✕</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Aún no hay conversaciones guardadas.</p>}
              {(convs?.length ?? 0) > 0 && (
                <form action={deleteAllAiConversations} className="mt-3">
                  <button className="text-xs text-muted underline-offset-2 hover:text-danger hover:underline">Borrar todo el historial</button>
                </form>
              )}
            </Card>
          )}

          <Card>
            <CardTitle kicker="Preferencias">Cómo te responde Gala</CardTitle>
            <form action={saveAiPreferences} className="space-y-3">
              <Field label="Idioma de las respuestas" htmlFor="ai_lang">
                <select id="ai_lang" name="language" defaultValue={prefs?.language ?? 'auto'} className={inputClass}>
                  <option value="auto">El de mi pregunta</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Estilo" htmlFor="ai_style">
                <select id="ai_style" name="answer_style" defaultValue={prefs?.answer_style ?? 'short'} className={inputClass}>
                  <option value="short">Breve: lo esencial primero</option>
                  <option value="detailed">Detallado: más contexto</option>
                </select>
              </Field>
              <label className="flex items-start gap-2 text-sm text-paper">
                <input type="checkbox" name="save_history" value="on" defaultChecked={historyOn} className="mt-1" />
                <span>Guardar mis conversaciones<span className="block text-xs text-muted">Solo tú las ves en la plataforma (ni tu familia ni las organizaciones). Se borran a los 90 días sin uso. Al desactivarlo se borran todas.</span></span>
              </label>
              <Button type="submit" variant="secondary">Guardar preferencias</Button>
            </form>
          </Card>
        </aside>
      </div>
    </>
  );
}
