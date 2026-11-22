import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Eye } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { loadCatalog, loadPassport, loadPassportViews } from '@/lib/data/athlete';
import { athletePhotoUrl } from '@/lib/data/passport-view';
import { Badge, ButtonLink, Card, CardTitle, Notice } from '@/components/ui';
import { AthleteLinkForm } from '@/components/forms';
import { createClient } from '@/lib/supabase/server';
import { LINK_KIND_LABEL, domainOf } from '@/lib/domain/labels';
import { AUDIENCE_LABEL, PROVENANCE_LABEL, type Audience } from '@/lib/domain/passport';
import { siteUrl } from '@/lib/env';
import { deleteAthleteLink } from '@/app/actions/marketplace';
import { AthleteUpdateForm } from '@/components/growth';
import { deleteAthleteUpdate } from '@/app/actions/growth';
import { decideRecommendation } from '@/app/actions/recommendations';
import { AcademicSection, GoalsSection, IdentitySection, PrivacySection, ShareSection, SportSection, StatsSection, VideoSection } from './PassportEditor';

export const metadata: Metadata = { title: 'Opportunity Passport' };

const SECTIONS = [
  ['identidad', 'Identidad'], ['deportivo', 'Deportivo'], ['estadisticas', 'Estadísticas'], ['video', 'Vídeo'], ['academico', 'Académico'],
  ['objetivos', 'Objetivos'], ['verificacion', 'Verificación'], ['privacidad', 'Privacidad'], ['compartir', 'Compartir'],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];

export default async function PassportEditPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const session = await requireSession(['athlete']);
  const { s } = await searchParams;
  const section: SectionKey = (SECTIONS.find(([k]) => k === s)?.[0] ?? 'identidad');
  const [passport, catalog] = await Promise.all([loadPassport(session.userId), loadCatalog()]);
  const r = passport.readiness;

  if (!passport.profile) return <Notice tone="warn">Aún no tienes Passport. Completa el registro de atleta.</Notice>;
  const profile = passport.profile;

  return (
    <>
      {/* ===== RECRUITING READINESS ===== */}
      <section aria-labelledby="readiness-t" className="carbon mb-6 overflow-hidden rounded-[28px] p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Recruiting Readiness ${r.score} de 100`}>
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2.6" />
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-lime)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="100" className="ring-fill" style={{ ['--ring-offset' as string]: 100 - r.score, strokeDashoffset: 100 - r.score }} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden><span className="font-display text-3xl font-bold leading-none text-white">{r.score}</span><span className="text-[10px] text-white/60">/ 100</span></span>
            </div>
            <div>
              <p className="eyebrow text-lime">Recruiting Readiness</p>
              <h1 id="readiness-t" className="mt-1 font-display text-3xl font-bold uppercase leading-none text-white sm:text-4xl">Tu Gala Passport</h1>
              <p className="mt-2 max-w-md text-sm text-white/70">Mide lo preparado que está tu perfil para un proceso de recruiting. No es una nota de talento.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/athlete/passport/preview" className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-bold text-[#0a0a0c]"><Eye className="h-4 w-4" aria-hidden />Ver mi Passport</Link>
            <Link href="?s=compartir" className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">Compartir</Link>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <details className="group rounded-2xl border border-white/10 p-4" open>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">¿Por qué tengo {r.score}?<span className="text-xs text-white/60 group-open:hidden">Ver desglose</span></summary>
            <ul className="mt-4 space-y-3">
              {r.categories.map((c) => (
                <li key={c.key}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-white/85">{c.label}</span><span className="tabular-nums text-white">{c.earned}/{c.max}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime" style={{ width: `${(c.earned / c.max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </details>
          <div className="rounded-2xl border border-lime/30 bg-lime/[0.06] p-4">
            {r.plan.length ? (
              <>
                <p className="text-sm font-semibold text-white">Cómo llegar a {r.target}</p>
                <ul className="mt-3 space-y-2">
                  {r.plan.map((i) => (
                    <li key={i.key}>
                      <Link href={i.href} className="group flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-white transition-colors hover:bg-white/10">
                        <span>{i.action}</span>
                        <span className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-lime">+{i.points}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="font-display text-xl font-bold uppercase text-lime">Passport completo</p>}
          </div>
        </div>
      </section>

      {/* ===== EDIT PASSPORT: navegación por secciones ===== */}
      <nav aria-label="Secciones del Passport" className="sticky top-14 z-20 -mx-4 mb-5 overflow-x-auto border-b border-line bg-ink/90 px-4 py-2 backdrop-blur [scrollbar-width:none] md:static md:mx-0 md:rounded-2xl md:border md:px-2">
        <ul className="flex w-max gap-1">
          {SECTIONS.map(([k, label]) => (
            <li key={k}>
              <Link href={`?s=${k}`} aria-current={section === k ? 'page' : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${section === k ? 'bg-paper text-ink' : 'text-muted hover:text-paper'}`}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {section === 'identidad' && <IdentitySection profile={profile} catalog={catalog} athleteId={session.userId} photoUrl={await athletePhotoUrl(profile.photo_path)} />}
      {section === 'deportivo' && <SportSection career={passport.career} achievements={passport.achievements} />}
      {section === 'estadisticas' && <StatsSection stats={passport.stats} statDefs={catalog.statDefs} sportId={profile.sport_id} />}
      {section === 'video' && <VideoSection videos={passport.videos} />}
      {section === 'academico' && <AcademicSection academics={passport.academics} languages={passport.languages} />}
      {section === 'objetivos' && <GoalsSection goals={passport.goals} budget={passport.annualBudgetUsd} legacyDivisions={profile.target_divisions} />}
      {section === 'verificacion' && <VerificationPanel userId={session.userId} links={passport.officialLinks} />}
      {section === 'privacidad' && <PrivacySection profile={profile} isMinor={session.isMinor} />}
      {section === 'compartir' && (
        <>
          <ShareSection profile={profile} displayName={session.displayName} siteUrl={siteUrl()} athleteId={session.userId} isMinor={session.isMinor} />
          <SharePanel userId={session.userId} />
        </>
      )}
    </>
  );
}

async function VerificationPanel({ userId, links }: { userId: string; links: { id: string; kind: string; url: string; verified: boolean }[] }) {
  const supabase = await createClient();
  const { data: recs } = await supabase.from('club_recommendations').select('id, body, status, organizations(name)').eq('athlete_id', userId).order('created_at', { ascending: false });
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle kicker="Sistema de verificación">Tres niveles, siempre visibles</CardTitle>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(['self_reported', 'documented', 'club_verified'] as const).map((k) => (
            <li key={k} className="rounded-2xl border border-line p-4">
              <Badge tone={k === 'club_verified' ? 'ok' : k === 'documented' ? 'brass' : 'neutral'}>{k === 'club_verified' ? 'Verificado' : PROVENANCE_LABEL[k].short}</Badge>
              <p className="mt-2 text-sm text-muted">{PROVENANCE_LABEL[k].who}</p>
              <p className="mt-2 text-sm text-paper">{k === 'self_reported' ? 'Todo lo que escribes empieza aquí.' : k === 'documented' ? <>Sube tu expediente o certificado en <Link href="/app/documents" className="text-brass hover:underline">Documentos</Link> y lo revisamos.</> : 'Pide a tu club que se registre en Gala y te añada a su plantilla: podrá confirmar tus estadísticas.'}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Nunca mostramos un dato como verificado si no lo está. Si cambias un dato documentado, vuelve a «Declarado».</p>
      </Card>
      <Card id="enlaces">
        <CardTitle kicker="Fuentes oficiales">Enlaces que respaldan tu perfil</CardTitle>
        <p className="-mt-2 mb-4 text-sm text-muted">Tu ficha en la web del club, las estadísticas de la federación o tu ranking oficial. Los revisamos y los marcamos como verificados.</p>
        {links.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate"><span className="text-paper">{LINK_KIND_LABEL[l.kind]}</span> · <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-brass">{domainOf(l.url)} ↗</a></span>
                <span className="flex items-center gap-3">
                  <Badge tone={l.verified ? 'ok' : 'neutral'}>{l.verified ? 'Verificado' : 'Pendiente'}</Badge>
                  <form action={deleteAthleteLink}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-faint hover:text-danger">Quitar</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <AthleteLinkForm />
      </Card>
      {(recs ?? []).length > 0 && (
        <Card id="recomendaciones">
          <CardTitle kicker="Respaldo de tu club">Recomendaciones</CardTitle>
          <ul className="space-y-3">
            {(recs ?? []).map((rec) => (
              <li key={rec.id} className="rounded-2xl border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-paper">{(rec.organizations as unknown as { name: string } | null)?.name ?? 'Tu club'}</span>
                  <Badge tone={rec.status === 'published' ? 'ok' : rec.status === 'hidden' ? 'neutral' : 'brass'}>{rec.status === 'published' ? 'Visible en tu perfil' : rec.status === 'hidden' ? 'Oculta' : 'Nueva: decide si se muestra'}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted">“{rec.body}”</p>
                <form action={decideRecommendation} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={rec.id} />
                  {rec.status !== 'published' && <button name="status" value="published" className="rounded-full bg-brass px-4 py-2 text-sm font-semibold text-ink">Mostrar en mi perfil</button>}
                  {rec.status !== 'hidden' && <button name="status" value="hidden" className="rounded-full border border-line-strong px-4 py-2 text-sm text-paper hover:border-brass">Ocultar</button>}
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

async function SharePanel({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [views, { data: updates }] = await Promise.all([
    loadPassportViews(userId),
    supabase.from('athlete_updates').select('id, body, link_url, expires_at').eq('athlete_id', userId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  ]);
  return (
    <div className="mt-5 space-y-5">
      <Card>
        <CardTitle kicker="Previsualizar">¿Cómo lo ve otra persona?</CardTitle>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
            <ButtonLink key={a} href={`/app/athlete/passport/preview?as=${a}`} variant="secondary">{AUDIENCE_LABEL[a]}</ButtonLink>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle kicker="Versión para coaches" action={<Link href="/app/share" className="text-sm text-brass hover:underline">Gestionar</Link>}>Enlaces de recruiting</CardTitle>
        <p className="text-sm text-muted">Un enlace privado para cada coach, con caducidad y contador de aperturas. Puedes revocarlo cuando quieras.</p>
      </Card>
      <Card>
        <CardTitle kicker="Passport views">Quién ha visto tu Passport</CardTitle>
        {views && views.total > 0 ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Visitas', views.total], ['Usuarios únicos', views.uniqueMembers], ['Universidades', views.universities], ['Clubes', views.clubs]].map(([k, v]) => (
                <div key={k as string} className="rounded-2xl border border-line p-4"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 font-display text-3xl font-bold text-paper">{v}</dd></div>
              ))}
            </dl>
            {views.organizations.length > 0 && <p className="mt-4 text-sm text-muted">Organizaciones verificadas: <span className="text-paper">{views.organizations.join(', ')}</span></p>}
          </>
        ) : <p className="text-sm text-muted">Todavía no hay visitas registradas. Contamos solo visitas reales desde hoy: comparte tu enlace para empezar.</p>}
      </Card>
      <Card>
        <CardTitle kicker="Visibilidad activa">Novedades</CardTitle>
        <p className="mb-3 text-sm text-muted">Resultados, vídeos nuevos o tu disponibilidad. Las ve quien ya puede ver tu perfil y desaparecen a los 30 días.</p>
        <AthleteUpdateForm />
        {!!updates?.length && (
          <ul className="mt-4 divide-y divide-line">
            {updates.map((u) => (
              <li key={u.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="text-paper">{u.body}{u.link_url && <> · <a href={u.link_url} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{domainOf(u.link_url)} ↗</a></>}</span>
                <form action={deleteAthleteUpdate}><input type="hidden" name="id" value={u.id} /><button className="text-xs text-faint hover:text-danger">Borrar</button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
