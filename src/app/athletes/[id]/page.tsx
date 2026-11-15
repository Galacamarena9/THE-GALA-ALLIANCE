import type { Metadata } from 'next';
import type { Division } from '@/lib/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Badge, ButtonLink, Card, CardTitle, EmptyState } from '@/components/ui';
import { ContactRequestForm, RepresentationForm, ReportButton } from '@/components/forms';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { loadCatalog, loadPassport } from '@/lib/data/athlete';
import { myOrganizations } from '@/lib/data/orgs';
import { DIVISION_LABEL, LINK_KIND_LABEL, domainOf } from '@/lib/domain/labels';
import { toGpa4 } from '@/lib/domain/match';
import { formatEsDate, ncaaWindow } from '@/lib/domain/ncaa';
import { SPORT_TONE_CLASS, sportTone } from '@/lib/domain/sport-tone';
import { initials } from '@/lib/domain/portfolio';
import { saveAthlete } from '@/app/actions/lists';

const SOURCE = { self_reported: ['Declarado', 'neutral'], documented: ['Documentado', 'brass'], club_verified: ['Verificado por el club', 'ok'] } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
  // Por defecto no indexable: solo se indexa si el atleta es adulto y su perfil es público (lo decide la RLS para anónimos).
  return { title: data?.display_name ?? 'Atleta', robots: { index: false, follow: false } };
}

export default async function AthleteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const session = await getSession();
  const supabase = await createClient();
  const passport = await loadPassport(id);
  if (!passport.profile) notFound();
  const { profile: p, person, academics, stats, languages, achievements } = passport;
  const catalog = await loadCatalog();
  const { data: links } = await supabase.from('athlete_links').select('id, kind, url, verified').eq('athlete_id', id);
  const { data: updates } = await supabase.from('athlete_updates').select('id, kind, body, link_url, created_at').eq('athlete_id', id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5);
  const sport = catalog.sports.find((s) => s.id === p.sport_id)?.name_es;
  const pos = catalog.positions.find((x) => x.id === p.primary_position_id)?.name_es;
  const pos2 = catalog.positions.find((x) => x.id === p.secondary_position_id)?.name_es;
  const isOwner = session?.userId === id;

  const orgs = session ? await myOrganizations(session.userId) : [];
  // Cumplimiento NCAA: una universidad D-I/D-II no puede iniciar contacto antes de la ventana (la base de datos también lo impide).
  const ncaaFor = (o: { type: string; division?: Division | null }) => (['university', 'college'].includes(o.type) ? ncaaWindow(p.graduation_year, o.division ?? null, p.sport_id) : { open: true, opensOn: null });
  const verifiedAll = orgs.filter((o) => o.verification_status === 'verified');
  const verifiedOrgs = verifiedAll.filter((o) => ncaaFor(o).open).map((o) => ({ id: o.id, name: o.name }));
  const ncaaBlocked = verifiedAll.map((o) => ({ name: o.name, w: ncaaFor(o) })).filter((x) => !x.w.open);
  const agencies = orgs.filter((o) => o.type === 'agency' && o.verification_status === 'verified').map((o) => ({ id: o.id, name: o.name }));
  const canSave = session?.roles.some((r) => ['university', 'coach', 'agent', 'brand'].includes(r));
  // Para recruiters: ¿es menor? Lo deducimos sin ver su fecha: si no podemos leer sus finanzas/edad, tratamos con precaución.
  const { data: minorFlag } = session ? await supabase.rpc('is_minor', { p_user: id }) : { data: true };
  const isMinor = Boolean(minorFlag);
  const gpa4 = toGpa4(academics?.gpa ?? null, academics?.gpa_scale ?? null);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo href={session ? '/app' : '/'} />
          {session ? <ButtonLink href="/app/discover" variant="ghost">← Escaparate</ButtonLink> : <ButtonLink href="/signup">Crear cuenta</ButtonLink>}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {/* Portada: color del deporte sobre la pista de marca; sin fotos del atleta salvo las que suba él. */}
          <div className={`court-lines relative h-36 sm:h-44 ${SPORT_TONE_CLASS[sportTone(sport ?? '')]}`} aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-t from-night/70 to-transparent" />
            <p className="absolute bottom-4 right-5 font-display text-4xl font-bold uppercase leading-none text-white/25 sm:text-6xl">{sport ?? 'Deporte'}</p>
          </div>
          <div className="p-6 pt-0 sm:p-8 sm:pt-0">
          <span className="-mt-11 mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-3xl border-4 border-surface bg-night font-display text-3xl font-bold text-lime shadow-lg">{initials(person?.display_name ?? 'Atleta')}</span>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[13px] font-semibold text-brass">Opportunity Passport</p>
              <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-[0.95] text-paper">{person?.display_name ?? 'Atleta'}</h1>
              <p className="mt-2 text-muted">{[sport, pos, pos2 && `/ ${pos2}`, p.graduation_year && `Clase ${p.graduation_year}`, person?.country, p.city].filter(Boolean).join(' · ')}</p>
              {p.headline && <p className="mt-4 max-w-2xl text-lg text-paper">{p.headline}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.open_to_opportunities && <Badge tone="ok">Abierto/a a oportunidades</Badge>}
                {p.target_divisions.map((d) => <Badge key={d}>{DIVISION_LABEL[d]}</Badge>)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {p.highlight_video_url && <a href={p.highlight_video_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-brass px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-gold)] hover:bg-brass-soft">▶ Ver highlights ({domainOf(p.highlight_video_url)})</a>}
              <Link href={`/athletes/${id}/cv`} className="text-sm text-brass hover:underline">CV deportivo (imprimir o PDF)</Link>
              {isOwner && <Link href="/app/athlete/passport" className="text-sm text-muted hover:text-paper">Editar mi Passport</Link>}
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Altura', p.height_cm ? `${p.height_cm} cm` : '—'],
              ['Equipo', p.current_team ?? '—'],
              ['Nivel / liga', p.competitive_level ?? '—'],
              ['Lado dominante', p.dominant_side === 'left' ? 'Zurdo/a' : p.dominant_side === 'right' ? 'Diestro/a' : p.dominant_side === 'both' ? 'Ambos' : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-surface-2 p-4"><dt className="text-xs font-medium text-faint">{k}</dt><dd className="mt-1 truncate font-semibold text-paper">{v}</dd></div>
            ))}
          </dl>
          </div>
        </section>

        {session && !isOwner && ncaaBlocked.length > 0 && (
          <div className="mt-5 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn" role="status">
            <p className="font-semibold">Ventana NCAA cerrada para {ncaaBlocked.map((x) => x.name).join(', ')}</p>
            <p className="mt-1">Por las normas de reclutamiento NCAA, vuestra universidad no puede iniciar contacto con este atleta hasta el {formatEsDate(ncaaBlocked[0].w.opensOn!)}. Mientras tanto puedes guardarlo en una lista.</p>
          </div>
        )}
        {session && !isOwner && (verifiedOrgs.length > 0 || canSave) && (
          <div className="mt-5 flex flex-wrap items-start gap-3">
            {canSave && (
              <form action={saveAthlete}><input type="hidden" name="athlete_id" value={id} /><button className="rounded-lg border border-line-strong px-4 py-2.5 text-sm text-paper hover:border-brass">Guardar en una lista</button></form>
            )}
            {verifiedOrgs.length > 0 && <ContactRequestForm organizations={verifiedOrgs} athleteId={id} isMinor={isMinor} />}
            {agencies.length > 0 && !isMinor && <RepresentationForm agencies={agencies} athleteId={id} />}
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <Card>
              <CardTitle kicker="Rendimiento">Estadísticas</CardTitle>
              {stats.length ? (
                <ul className="divide-y divide-line">
                  {stats.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="text-muted">{s.sport_stat_definitions?.label_es} <span className="text-faint">· {s.season}</span></span>
                      <span className="flex items-center gap-2"><span className="font-display text-lg tabular-nums text-paper">{s.value}{s.sport_stat_definitions?.unit ? ` ${s.sport_stat_definitions.unit}` : ''}</span><Badge tone={SOURCE[s.source][1]}>{SOURCE[s.source][0]}</Badge></span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="Estadísticas no visibles o sin datos" />}
            </Card>
            {!!updates?.length && (
              <Card>
                <CardTitle kicker="Últimos 30 días">Novedades</CardTitle>
                <ul className="divide-y divide-line">
                  {updates.map((u) => (
                    <li key={u.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="text-paper">{u.body}{u.link_url && <> · <a href={u.link_url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{domainOf(u.link_url)} ↗</a></>}</span>
                      {session && !isOwner && <ReportButton entityType="athlete_update" entityId={u.id} label="Denunciar" />}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {p.bio && <Card><CardTitle kicker="Sobre mí">Presentación</CardTitle><p className="whitespace-pre-line text-muted">{p.bio}</p></Card>}
            {achievements.length > 0 && (
              <Card>
                <CardTitle kicker="Trayectoria">Logros</CardTitle>
                <ul className="space-y-2">{achievements.map((a) => <li key={a.id} className="text-paper">{a.title}{a.year && <span className="text-faint"> · {a.year}</span>}</li>)}</ul>
              </Card>
            )}
          </div>
          <div className="space-y-5">
            <Card>
              <CardTitle kicker="Académico">Estudios</CardTitle>
              {academics ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Nota media</dt><dd className="text-paper">{academics.gpa ?? '—'} / {academics.gpa_scale}{gpa4 != null && <span className="text-faint"> (≈ {gpa4} / 4.0)</span>}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Inglés</dt><dd className="text-paper">{academics.english_test && academics.english_test !== 'none' ? `${academics.english_test.toUpperCase()} ${academics.english_score ?? ''}` : '—'}</dd></div>
                  {p.intended_major && <div className="flex justify-between"><dt className="text-muted">Quiere estudiar</dt><dd className="text-paper">{p.intended_major}</dd></div>}
                </dl>
              ) : <p className="text-sm text-muted">El atleta comparte su bloque académico solo con organizaciones con las que conecta.</p>}
            </Card>
            {languages.length > 0 && (
              <Card><CardTitle kicker="Idiomas">Idiomas</CardTitle><div className="flex flex-wrap gap-1.5">{languages.map((l) => <Badge key={l.language_code}>{l.language_code.toUpperCase()} · {l.level.toUpperCase()}</Badge>)}</div></Card>
            )}
            {links && links.length > 0 && (
              <Card>
                <CardTitle kicker="Fuentes externas">Enlaces oficiales</CardTitle>
                <ul className="space-y-2 text-sm">
                  {links.map((l) => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="text-muted">{LINK_KIND_LABEL[l.kind]}</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-brass hover:underline">{domainOf(l.url)} ↗ {l.verified ? <span className="text-ok">✓</span> : <span className="text-faint">(sin verificar)</span>}</a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {session && !isOwner && <div className="text-right"><ReportButton entityType="athlete_profile" entityId={id} label="Denunciar este perfil" /></div>}
          </div>
        </div>
        <p className="mt-8 text-xs text-faint">Cada dato indica su origen: declarado por el atleta, documentado o verificado por su club. The Gala Alliance no garantiza admisión ni beca.</p>
      </main>
    </div>
  );
}
