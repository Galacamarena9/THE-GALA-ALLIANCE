import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Lock, ShieldCheck } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { OpportunityCard, type OpportunityCardData } from '@/components/OpportunityCard';
import { ButtonLink, EmptyState, cx } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { BRAND, VERTICALS, VERTICAL_STATUS_LABEL, VERTICAL_TYPES, type VerticalKey } from '@/content/brand';

export const metadata: Metadata = {
  title: 'Oportunidades deportivas verificadas',
  description: 'Becas en EE. UU., pruebas en clubes, academias y showcases publicados por organizaciones verificadas, con coste neto y sello de confianza.',
  alternates: { canonical: '/oportunidades' },
};

const SELECT =
  'id, title, type, division, location, deadline, annual_cost_usd, aid_amount_usd, status, description, financial_source, is_reviewed, updated_at, organizations!inner(name, verification_status, website, type)';
const PAGE = 24;

type LoadResult = { items: OpportunityCardData[]; error: boolean };

/**
 * Lectura pública: la RLS solo deja ver a anónimos las oportunidades publicadas y las organizaciones verificadas.
 * Se filtra además por organización verificada en la consulta (defensa en profundidad).
 */
async function load(types: string[] | null): Promise<LoadResult> {
  if (!isSupabaseConfigured()) return { items: [], error: false };
  try {
    const supabase = await createClient();
    let q = supabase
      .from('opportunities')
      .select(SELECT)
      .eq('status', 'published')
      .eq('organizations.verification_status', 'verified')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(PAGE);
    if (types) q = q.in('type', types);
    const { data, error } = await q;
    if (error) return { items: [], error: true };
    return { items: (data ?? []) as unknown as OpportunityCardData[], error: false };
  } catch {
    return { items: [], error: true };
  }
}

function isVertical(v: string | undefined): v is VerticalKey {
  return !!v && VERTICALS.some((x) => x.key === v);
}

export default async function PublicOpportunitiesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const sp = await searchParams;
  const current = isVertical(sp.v) ? sp.v : null;
  const vertical = current ? VERTICALS.find((x) => x.key === current)! : null;
  const types = current ? VERTICAL_TYPES[current] : null;
  // Marcas: las campañas nunca son públicas (pueden implicar a atletas jóvenes y solo se muestran a mayores de edad dentro).
  const brandsOnly = current === 'brands';
  const { items, error } = brandsOnly ? { items: [], error: false } : await load(types);

  return (
    <div className="relative">
      <PublicHeader />
      <main id="main-content" className="px-6 pb-24 pt-14">
        <div className="mx-auto max-w-7xl">
          <PageHeader kicker={`Marketplace · ${BRAND.network}`} title={<>Oportunidades reales, de <em>organizaciones verificadas</em></>} photo="/media/university-campus-sm.webp"
            description={`Cada oportunidad muestra su organización, su sello de confianza y el coste neto cuando está documentado. Tu encaje explicado aparece al crear tu ${BRAND.passport}.`} />

          <nav aria-label="Tipos de oportunidad" className="mt-8 flex flex-wrap gap-2">
            {[{ key: null, name: 'Todas' }, ...VERTICALS].map((v) => {
              const on = (v.key ?? null) === current;
              return (
                <Link
                  key={v.key ?? 'all'}
                  href={v.key ? `/oportunidades?v=${v.key}` : '/oportunidades'}
                  aria-current={on ? 'page' : undefined}
                  className={cx('rounded-full border px-4 py-2 text-sm font-medium transition-colors', on ? 'border-brass bg-brass text-ink' : 'border-line bg-surface text-muted hover:border-brass/50 hover:text-paper')}
                >
                  {v.name}
                </Link>
              );
            })}
          </nav>

          {vertical && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-paper">{VERTICAL_STATUS_LABEL[vertical.status]}</span>
              {vertical.text}
            </p>
          )}

          <section aria-label="Resultados" className="mt-8">
            {brandsOnly ? (
              <EmptyState title="Las campañas de marcas no son públicas" action={<ButtonLink href="/signup?role=athlete">Crear mi Passport gratis</ButtonLink>}>
                Por protección de menores, las colaboraciones con marcas solo se muestran dentro de la plataforma a atletas mayores de edad.
              </EmptyState>
            ) : error ? (
              <EmptyState title="No hemos podido cargar las oportunidades" action={<ButtonLink href={current ? `/oportunidades?v=${current}` : '/oportunidades'} variant="secondary">Reintentar</ButtonLink>}>
                Es un problema temporal de nuestra parte. Vuelve a intentarlo en unos minutos.
              </EmptyState>
            ) : items.length ? (
              <>
                <p className="mb-4 text-sm text-muted" aria-live="polite">{items.length === PAGE ? `Mostrando las ${PAGE} con plazo más próximo` : `${items.length} ${items.length === 1 ? 'oportunidad publicada' : 'oportunidades publicadas'}`}</p>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((o) => <li key={o.id}><OpportunityCard o={o} href={`/oportunidades/${o.id}`} /></li>)}
                </ul>
                <p className="mt-4 text-xs text-faint">Para ver tu compatibilidad y candidatar, crea tu {BRAND.passport} gratis.</p>
              </>
            ) : (
              <EmptyState title="Todavía no hay oportunidades publicadas aquí" action={<div className="flex flex-col gap-2 sm:flex-row"><ButtonLink href="/signup?role=athlete">Crear mi Passport gratis</ButtonLink><ButtonLink href="/signup?role=university" variant="secondary">Publicar como organización</ButtonLink></div>}>
                No rellenamos el marketplace con ejemplos. Crea tu Passport y te avisaremos cuando una organización verificada publique algo que encaje contigo.
              </EmptyState>
            )}
          </section>

          <ul className="mt-14 grid gap-3 sm:grid-cols-3">
            {[
              [BadgeCheck, 'Solo organizaciones verificadas por dominio oficial'],
              [ShieldCheck, 'Sello de confianza y señales de alarma en cada oferta'],
              [Lock, 'Nadie paga por aparecer más arriba'],
            ].map(([Icon, t]) => {
              const I = Icon as typeof BadgeCheck;
              return <li key={t as string} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-paper"><I className="h-5 w-5 shrink-0 text-brass" aria-hidden />{t as string}</li>;
            })}
          </ul>
          <Link href="/seguridad" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brass hover:underline">Cómo verificamos <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
