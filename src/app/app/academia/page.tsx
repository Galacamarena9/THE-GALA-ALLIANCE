import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardTitle, Meter, Notice, PageHeader } from '@/components/ui';
import { PracticeEngine } from '@/components/growth';
import { toggleAcademyTopic } from '@/app/actions/growth';
import {
  ACADEMY_REVIEWED, EXAM_FACTS, REGISTRATION, SAT_DATES, TOEFL_CONCORDANCE, questionsFor, topicsFor, type Exam,
} from '@/content/academy';
import { daysUntil, domainOf, minuteSeed } from '@/lib/domain/labels';

export const metadata: Metadata = { title: 'Academia SAT/TOEFL' };

const fmtDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const d = (iso: string) => fmtDate.format(new Date(`${iso}T00:00:00Z`));

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const session = await requireSession();
  const exam: Exam = (await searchParams).exam === 'toefl' ? 'toefl' : 'sat';
  const supabase = await createClient();

  const [{ data: progress }, { data: attempts }, { data: academics }, { data: apps }] = await Promise.all([
    supabase.from('academy_progress').select('topic_id').eq('user_id', session.userId).eq('exam', exam),
    supabase.from('academy_attempts').select('correct, total, created_at').eq('user_id', session.userId).eq('exam', exam).order('created_at', { ascending: false }).limit(5),
    supabase.from('athlete_academics').select('sat_score, english_test, english_score').eq('athlete_id', session.userId).maybeSingle(),
    // SAT medio oficial (College Scorecard) de las universidades a las que has aplicado.
    supabase.from('applications').select('opportunities(organizations(institutions(name, sat_avg, admissions_url)))').eq('athlete_id', session.userId).limit(30),
  ]);

  const done = new Set((progress ?? []).map((p) => p.topic_id));
  const topics = topicsFor(exam);
  const facts = EXAM_FACTS[exam];
  const reg = REGISTRATION[exam];
  type Inst = { name: string; sat_avg: number | null; admissions_url: string | null };
  const targets = new Map<string, Inst>();
  for (const a of apps ?? []) {
    const inst = (a.opportunities as unknown as { organizations: { institutions: Inst | null } | null } | null)?.organizations?.institutions;
    if (inst) targets.set(inst.name, inst);
  }
  const accuracy = (attempts ?? []).length
    ? Math.round(((attempts ?? []).reduce((s, a) => s + a.correct, 0) / (attempts ?? []).reduce((s, a) => s + a.total, 0)) * 100)
    : null;
  const current = exam === 'sat' ? academics?.sat_score : academics?.english_test === 'toefl' ? academics?.english_score : null;

  return (
    <>
      <PageHeader
        kicker="Academia"
        title="Prepara tus exámenes, sin perder de vista la beca"
        description="Contenido al día del SAT digital y del TOEFL 2026, práctica con explicación y calendario oficial. Tu familia vinculada puede seguir tu progreso; las organizaciones, no."
      />

      <nav className="mb-5 flex gap-2" aria-label="Examen">
        {(['sat', 'toefl'] as Exam[]).map((e) => (
          <Link key={e} href={`/app/academia?exam=${e}`} aria-current={e === exam ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm ${e === exam ? 'bg-brass text-ink' : 'border border-line text-muted hover:text-paper'}`}>
            {EXAM_FACTS[e].name}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle kicker="Tu punto de partida">Dónde estás y a qué apuntar</CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-faint">Tu puntuación declarada</p><p className="font-display text-2xl text-paper">{current ?? '—'}</p>{!current && <Link href="/app/athlete/passport" className="text-xs text-brass hover:underline">Añádela en tu Passport</Link>}</div>
            <div><p className="text-xs text-faint">Temas completados</p><p className="font-display text-2xl text-paper">{done.size}/{topics.length}</p></div>
            <div><p className="text-xs text-faint">Aciertos (últimas prácticas)</p><p className="font-display text-2xl text-paper">{accuracy === null ? '—' : `${accuracy} %`}</p></div>
          </div>
          <div className="mt-4"><Meter value={Math.round((done.size / topics.length) * 100)} label="Temario" /></div>
          <div className="mt-4">
            <Notice tone="neutral">
              {exam === 'sat'
                ? 'La NCAA no exige SAT/ACT desde 2023. Tu objetivo lo marca cada universidad: algunas lo piden para admisión o becas académicas y otras son test-optional.'
                : 'La NCAA no fija un mínimo de inglés: cada universidad pide el suyo para la admisión. Consulta su web de admisiones (la tienes en su ficha).'}
            </Notice>
          </div>
          {exam === 'sat' && targets.size > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">SAT medio de admitidos en tus universidades (College Scorecard)</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[...targets.values()].map((t) => (
                  <li key={t.name} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="text-paper">{t.name}</span>
                    <span className="text-muted">{t.sat_avg ?? 'sin dato'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle kicker="Formato oficial">{facts.name}</CardTitle>
          <ul className="space-y-2 text-sm text-muted">
            {facts.format.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="mt-3 text-sm text-paper">{facts.scoring}</p>
          {exam === 'toefl' && (
            <table className="mt-3 w-full text-xs">
              <caption className="mb-1 text-left text-faint">Equivalencias oficiales ETS (total)</caption>
              <tbody>
                {TOEFL_CONCORDANCE.map((r) => (
                  <tr key={r.band} className="border-t border-line"><td className="py-1 text-paper">{r.band}</td><td className="py-1 text-right text-muted">{r.legacy}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="mt-4 space-y-1 text-xs">
            {facts.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{s.label} ↗</a></li>)}
          </ul>
        </Card>
      </div>

      <section className="mt-6" aria-labelledby="temario">
        <h2 id="temario" className="mb-3 text-2xl text-paper">Temario</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {topics.map((t) => {
            const isDone = done.has(t.id);
            return (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-faint">{t.section}</p>
                    <h3 className="text-lg text-paper">{t.title}</h3>
                    <p className="text-sm text-muted">{t.summary}</p>
                  </div>
                  <form action={toggleAcademyTopic}>
                    <input type="hidden" name="exam" value={exam} />
                    <input type="hidden" name="topic_id" value={t.id} />
                    <input type="hidden" name="done" value={isDone ? '1' : '0'} />
                    <button className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${isDone ? 'border-ok/60 text-ok' : 'border-line text-muted hover:text-paper'}`}>
                      {isDone ? '✓ Completado' : 'Marcar como visto'}
                    </button>
                  </form>
                </div>
                <div className="mt-3 space-y-2">
                  {t.concepts.map((c) => (
                    <details key={c.concept} className="group rounded-lg border border-line bg-ink/40 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-paper marker:text-brass">{c.concept}</summary>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{c.explanation}</p>
                      {c.example && <p className="mt-2 rounded border border-brass/20 bg-brass/5 px-2 py-1.5 text-xs text-paper"><span className="font-semibold text-brass">Ejemplo · </span>{c.example}</p>}
                      {c.tip && <p className="mt-2 text-xs text-muted"><span className="font-semibold text-warn">Consejo · </span>{c.tip}</p>}
                    </details>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]" aria-label="Práctica e inscripción">
        <div>
          <h2 className="mb-3 text-2xl text-paper">Práctica</h2>
          <PracticeEngine exam={exam} questions={questionsFor(exam)} seed={minuteSeed()} />
          <p className="mt-2 text-xs text-faint">Preguntas propias de estilo oficial para practicar conceptos. Para simular el examen completo usa las pruebas oficiales gratuitas ({exam === 'sat' ? 'Bluebook' : 'ETS'}).</p>
        </div>
        <Card>
          <CardTitle kicker="Inscripción">Fechas, precio y envío de resultados</CardTitle>
          {exam === 'sat' && (
            <ul className="mb-4 divide-y divide-line text-sm">
              {SAT_DATES.map((s) => {
                const toDeadline = daysUntil(s.deadline);
                const toLate = daysUntil(s.late);
                const past = toLate < 0;
                return (
                  <li key={s.test} className={`flex items-center justify-between gap-2 py-2 ${past ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-paper">{d(s.test)}</p>
                      <p className="text-xs text-faint">Inscripción hasta el {d(s.deadline)} · tardía hasta el {d(s.late)}</p>
                    </div>
                    {past ? <Badge>Cerrada</Badge> : toDeadline >= 0 ? <Badge tone={toDeadline <= 14 ? 'warn' : 'ok'}>{toDeadline} días</Badge> : <Badge tone="warn">Solo tardía</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="space-y-2 text-sm text-muted">
            {reg.facts.map((f) => <li key={f}>• {f}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <a href={reg.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-brass/50 px-3 py-1.5 text-brass hover:bg-brass/10">Inscribirme ({domainOf(reg.url)}) ↗</a>
            <a href={reg.feesUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-paper">Tarifas oficiales ↗</a>
          </div>
          <p className="mt-3 text-xs text-faint">Revisado: {ACADEMY_REVIEWED}. Las fechas y tarifas las fijan College Board y ETS; comprueba siempre en su web antes de pagar.</p>
        </Card>
      </section>
    </>
  );
}
