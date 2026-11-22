import type { Metadata } from 'next';
import type { Division } from '@/lib/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { PrintButton } from '@/components/autonomy';
import { ContactRequestForm, RepresentationForm, ReportButton } from '@/components/forms';
import { PassportView } from '@/components/passport/PassportView';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';
import { loadCatalog } from '@/lib/data/athlete';
import { loadPassportView } from '@/lib/data/passport-view';
import { myOrganizations } from '@/lib/data/orgs';
import { domainOf } from '@/lib/domain/labels';
import { formatEsDate, ncaaWindow } from '@/lib/domain/ncaa';
import { saveAthlete } from '@/app/actions/lists';
import { BRAND } from '@/content/brand';

export async function athleteMetadata(id: string): Promise<Metadata> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return { title: 'Atleta', robots: { index: false, follow: false } };
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
  // Por defecto no indexable: solo se indexa si el atleta es adulto y su perfil es público (lo decide la RLS para anónimos).
  const base: Metadata = { title: data?.display_name ?? 'Atleta', robots: { index: false, follow: false } };
  if (!data?.display_name) return base;

  // Vista previa al compartir. Los rastreadores (WhatsApp, LinkedIn, X) entran como anónimos: la RLS solo les deja leer
  // perfiles públicos de mayores de edad, así que un menor nunca genera vista previa. Solo deporte, posición y promoción.
  const { data: ap } = await supabase.from('athlete_profiles').select('sport_id, primary_position_id, graduation_year, headline').eq('user_id', id).maybeSingle();
  if (!ap) return base;
  const catalog = await loadCatalog();
  const parts = [
    catalog.sports.find((s) => s.id === ap.sport_id)?.name_es,
    catalog.positions.find((x) => x.id === ap.primary_position_id)?.name_es,
    ap.graduation_year ? `Promoción ${ap.graduation_year}` : null,
  ].filter(Boolean);
  const title = `${data.display_name} · ${BRAND.passport}`;
  const description = [parts.join(' · '), ap.headline].filter(Boolean).join('. ') || `${BRAND.passport} en ${BRAND.name}.`;
  return {
    ...base,
    description,
    openGraph: { type: 'profile', title, description, siteName: BRAND.name, images: [{ url: '/media/hero-bg-poster.jpg', alt: BRAND.network }] },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Passport público o de miembros (el mismo para /athletes/<id> y /athlete/<username>). */
export async function AthletePassportPage({ id }: { id: string }) {
  const session = await getSession();
  const supabase = await createClient();
  const view = await loadPassportView(id);
  if (!view) notFound();
  const { data: d } = view;
  const p = d.profile;
  const isOwner = session?.userId === id;
  // Visita real (la función ignora al propio atleta y a quien no puede ver el perfil).
  if (!isOwner) await supabase.rpc('record_passport_view', { p_athlete: id });

  const { data: updates } = await supabase.from('athlete_updates').select('id, kind, body, link_url, created_at').eq('athlete_id', id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5);
  const orgs = session ? await myOrganizations(session.userId) : [];
  // Cumplimiento NCAA: una universidad D-I/D-II no puede iniciar contacto antes de la ventana (la base de datos también lo impide).
  const ncaaFor = (o: { type: string; division?: Division | null }) => (['university', 'college'].includes(o.type) ? ncaaWindow(p.graduation_year, o.division ?? null, p.sport_id) : { open: true, opensOn: null });
  const verifiedAll = orgs.filter((o) => o.verification_status === 'verified');
  const verifiedOrgs = verifiedAll.filter((o) => ncaaFor(o).open).map((o) => ({ id: o.id, name: o.name }));
  const ncaaBlocked = verifiedAll.map((o) => ({ name: o.name, w: ncaaFor(o) })).filter((x) => !x.w.open);
  const agencies = orgs.filter((o) => o.type === 'agency' && o.verification_status === 'verified').map((o) => ({ id: o.id, name: o.name }));
  const canSave = session?.roles.some((r) => ['university', 'coach', 'agent', 'brand'].includes(r));
  const { data: minorFlag } = session ? await supabase.rpc('viewer_is_minor', { p_user: id }) : { data: true };
  const isMinor = Boolean(minorFlag);

  const actions = (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/athletes/${id}/cv`} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">CV deportivo (PDF)</Link>
      {isOwner && <Link href="/app/athlete/passport" className="inline-flex h-11 items-center rounded-full bg-lime px-5 text-sm font-bold text-[#0a0a0c]">Editar mi Passport</Link>}
      {session && !isOwner && canSave && (
        <form action={saveAthlete}><input type="hidden" name="athlete_id" value={id} /><button className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">Guardar en una lista</button></form>
      )}
    </div>
  );

  return (
    <div className="carbon min-h-dvh">
      <header className="no-print border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Logo href={session ? '/app' : '/'} />
          {session ? (
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="Imprimir ficha" />
              <ButtonLink href="/app/discover" variant="ghost">← Escaparate</ButtonLink>
            </div>
          ) : <ButtonLink href="/signup">Crear mi Passport</ButtonLink>}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-3 py-6 sm:px-5 sm:py-10">
        <PassportView d={d} actions={actions} mode={isOwner ? 'owner' : 'public'} />

        {session && !isOwner && ncaaBlocked.length > 0 && (
          <div className="mt-5 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn" role="status">
            <p className="font-semibold">Ventana NCAA cerrada para {ncaaBlocked.map((x) => x.name).join(', ')}</p>
            <p className="mt-1">Por las normas de reclutamiento NCAA, vuestra universidad no puede iniciar contacto con este atleta hasta el {formatEsDate(ncaaBlocked[0].w.opensOn!)}. Mientras tanto puedes guardarlo en una lista.</p>
          </div>
        )}
        {session && !isOwner && (verifiedOrgs.length > 0 || agencies.length > 0) && (
          <section aria-label="Contactar" className="mt-5 flex flex-wrap items-start gap-3 rounded-[28px] border border-white/10 p-5">
            {verifiedOrgs.length > 0 && <ContactRequestForm organizations={verifiedOrgs} athleteId={id} isMinor={isMinor} />}
            {agencies.length > 0 && !isMinor && <RepresentationForm agencies={agencies} athleteId={id} />}
          </section>
        )}
        {!!updates?.length && (
          <section aria-labelledby="novedades-t" className="mt-5 rounded-[28px] border border-white/10 p-5 sm:p-8">
            <h2 id="novedades-t" className="font-display text-2xl font-bold uppercase text-white">Novedades</h2>
            <ul className="mt-3 divide-y divide-white/10">
              {updates.map((u) => (
                <li key={u.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="text-white/90">{u.body}{u.link_url && <> · <a href={u.link_url} target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">{domainOf(u.link_url)} ↗</a></>}</span>
                  {session && !isOwner && <ReportButton entityType="athlete_update" entityId={u.id} label="Denunciar" />}
                </li>
              ))}
            </ul>
          </section>
        )}
        {session && !isOwner && <div className="mt-5 text-right"><ReportButton entityType="athlete_profile" entityId={id} label="Denunciar este perfil" /></div>}
      </main>
    </div>
  );
}
