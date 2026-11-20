import Link from 'next/link';
import { Badge, Card, CardTitle, EmptyState, Notice } from '@/components/ui';
import type { FamilyAction, FamilyDeadline } from '@/lib/domain/family';
import { daysBetween } from '@/lib/domain/family';
import type { FamilyChildHome, GuardianLink } from '@/lib/data/family-home';
import { FamilyNotes, FamilyTaskForm } from '@/components/family/FamilyForms';

const DEADLINE_KIND: Record<FamilyDeadline['kind'], { label: string; tone: 'danger' | 'brass' | 'neutral' }> = {
  official: { label: 'Oficial', tone: 'danger' },
  personal: { label: 'Vuestra', tone: 'brass' },
  recommended: { label: 'Recomendada', tone: 'neutral' },
};
const CONTACT_STATUS: Record<string, string> = {
  pending_guardian: 'Espera tu aprobación', pending: 'Pendiente del atleta', accepted: 'Aceptado', declined: 'Rechazado', blocked: 'Bloqueado',
};
const RELATIONSHIP: Record<string, string> = {
  parent: 'Familiar', mother: 'Madre', father: 'Padre', legal_guardian: 'Tutor legal', other_guardian: 'Tutor autorizado', other_family: 'Familiar',
};
const SCOPES: [keyof GuardianLink['scopes'], string][] = [
  ['profile', 'Passport y shortlist'], ['applications', 'Candidaturas y proceso'], ['academics', 'Académico'], ['costs', 'Costes y presupuesto'],
  ['documents', 'Documentos'], ['contacts', 'Quién contacta'], ['messages', 'Mensajes'], ['edit', 'Editar su perfil'],
];

const shortDate = (d: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`));

/**
 * Family Command Center de un hijo/a. Orden: lo que necesita a la familia → esta semana → proceso → coste → seguridad.
 * Solo muestra lo que la relación permite; cada bloque sin permiso lo dice en lugar de aparecer vacío.
 */
export function FamilyHome({ links, current, home, action, today, switchHref }: {
  links: GuardianLink[];
  current: GuardianLink;
  home: FamilyChildHome | null;
  action: FamilyAction;
  today: string;
  switchHref: (athleteId: string) => string;
}) {
  const s = current.scopes;
  return (
    <div className="space-y-5">
      {links.length > 1 && (
        <nav aria-label="Elegir hijo o hija" className="flex flex-wrap gap-2">
          {links.map((l) => (
            <Link key={l.id} href={switchHref(l.athleteId)} aria-current={l.id === current.id ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${l.id === current.id ? 'border-brass bg-brass/10 text-paper' : 'border-line text-muted hover:text-paper'}`}>
              {l.name}
            </Link>
          ))}
        </nav>
      )}

      {!current.active && (
        <Notice tone="warn">
          {current.status === 'restricted'
            ? `${current.name} ha pausado tu acceso. La relación sigue, pero no verás su información hasta que lo reanude.`
            : `${current.name} ya es mayor de edad y debe confirmar si sigues teniendo acceso. Hasta entonces, su información no es visible.`}
        </Notice>
      )}

      {current.active && home && (
        <>
          <section aria-labelledby="family-action" className={`rounded-2xl border p-5 ${action.urgent ? 'border-brass bg-brass/10' : 'border-line bg-surface'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-brass">Acción de la familia</p>
            <h2 id="family-action" className="mt-1 text-lg font-semibold text-paper">{action.title}</h2>
            <p className="mt-1 text-sm text-muted">{action.why}</p>
            <Link href={action.href} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brass px-5 text-sm font-semibold text-ink">
              {action.urgent ? 'Revisar ahora' : 'Abrir'}
            </Link>
            {home.approvals.length > 1 && <p className="mt-2 text-xs text-muted">{home.approvals.length} decisiones esperan a la familia.</p>}
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle kicker="Próximos 30 días">Plazos</CardTitle>
              {home.deadlines.length ? (
                <ul className="divide-y divide-line">
                  {home.deadlines.slice(0, 6).map((d, i) => {
                    const days = daysBetween(today, d.date);
                    return (
                      <li key={`${d.date}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-paper">{d.label}</p>
                          <p className="text-xs text-muted">{shortDate(d.date)} · {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}</p>
                        </div>
                        <Badge tone={DEADLINE_KIND[d.kind].tone}>{DEADLINE_KIND[d.kind].label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">{s.applications ? 'No hay plazos en los próximos 30 días.' : `${current.name} no comparte sus candidaturas contigo, así que no ves sus plazos oficiales.`}</p>
              )}
              <p className="mt-3 text-xs text-faint">Oficial = lo fija la universidad u organización · Vuestra = la habéis puesto vosotros · Recomendada = la sugiere el proceso.</p>
            </Card>

            <Card>
              <CardTitle kicker="Proceso">Dónde está</CardTitle>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {([['Guardadas', home.process.saved], ['Candidaturas', home.process.applications], ['Ofertas', home.process.offers]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line p-3">
                    <dd className="text-2xl font-semibold tabular-nums text-paper">{v}</dd>
                    <dt className="text-xs text-muted">{k}</dt>
                  </div>
                ))}
              </dl>
              <Link href={`/athletes/${current.athleteId}`} className="mt-3 inline-block text-sm text-brass hover:underline">Ver su Passport</Link>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle kicker="Coste real" action={s.costs ? <Link href={`/app/family/costs?child=${current.athleteId}`} className="text-sm text-brass hover:underline">Comparar</Link> : undefined}>
                {s.costs ? (home.scenarios.total ? `${home.scenarios.total} opción(es) en estudio` : 'Aún sin comparar') : 'Sin acceso a costes'}
              </CardTitle>
              {s.costs ? (
                home.scenarios.total ? (
                  <p className="text-sm text-muted">
                    {home.scenarios.incomplete ? `${home.scenarios.incomplete} con información incompleta: os decimos qué falta, nunca inventamos la cifra.` : 'Todas tienen los costes esenciales.'}
                  </p>
                ) : (
                  <p className="text-sm text-muted">Añadid matrícula, alojamiento, comidas y la ayuda confirmada de cada opción. Lo que no sepáis, se queda como «desconocido».</p>
                )
              ) : (
                <p className="text-sm text-muted">{current.name} no comparte los costes contigo. Puede activarlo en sus ajustes.</p>
              )}
            </Card>

            <Card>
              <CardTitle kicker="Documentos" action={s.documents ? <Link href="/app/requests" className="text-sm text-brass hover:underline">Solicitudes</Link> : undefined}>
                {s.documents ? `${home.missingDocuments} por subir · ${home.pendingDocRequests} solicitud(es) abiertas` : 'Sin acceso a documentos'}
              </CardTitle>
              <p className="text-sm text-muted">
                {s.documents
                  ? 'Ninguna organización ve un documento sin una concesión con finalidad y caducidad. Cada apertura queda registrada.'
                  : `${current.name} no comparte sus documentos contigo.`}
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle kicker="Seguridad" action={<Link href="/app/inbox" className="text-sm text-brass hover:underline">Bandeja</Link>}>Quién contacta</CardTitle>
            {s.contacts ? (
              home.contacts.length ? (
                <ul className="divide-y divide-line">
                  {home.contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-paper">{c.org}</p>
                        <p className="text-xs text-muted">
                          {c.orgVerified ? <span title="Afiliación institucional verificada por The Gala Alliance. No es una recomendación ni una garantía.">Organización verificada ✓</span> : 'Organización sin verificar'}
                          {' · '}{shortDate(c.createdAt.slice(0, 10))}
                        </p>
                      </div>
                      <Badge tone={c.status === 'pending_guardian' ? 'warn' : c.status === 'accepted' ? 'ok' : 'neutral'}>{CONTACT_STATUS[c.status] ?? c.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nadie ha pedido contactar con {current.name} todavía.</p>
              )
            ) : (
              <p className="text-sm text-muted">{current.name} no comparte contigo quién le contacta.</p>
            )}
            <p className="mt-3 text-xs text-faint">«Verificada» significa que hemos comprobado su afiliación institucional. No significa que recomendemos al coach ni que garanticemos la oportunidad.</p>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle kicker="Solo familia">Notas</CardTitle>
              <FamilyNotes athleteId={current.athleteId} notes={home.notes} />
            </Card>
            <Card>
              <CardTitle kicker="Tareas">Algo que hacer</CardTitle>
              <FamilyTaskForm athleteId={current.athleteId} />
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardTitle kicker={`${RELATIONSHIP[current.relationship] ?? 'Familiar'} · ${current.verification === 'admin_verified' ? 'verificado por The Gala Alliance' : current.verification === 'athlete_confirmed' ? 'confirmado por el atleta' : 'sin confirmar'}`}>
          Lo que puedes ver de {current.name}
        </CardTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SCOPES.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
              <span className="text-paper">{label}</span>
              <span className={s[k] && current.active ? 'text-ok' : 'text-faint'}>{s[k] && current.active ? 'Sí' : 'No'}</span>
            </li>
          ))}
          <li className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
            <span className="text-paper">Sus notas privadas</span><span className="text-faint">Nunca</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-faint">Lo decide {current.name} desde sus ajustes. Si cumple 18 años, tendrá que confirmar si sigues teniendo acceso.</p>
      </Card>
    </div>
  );
}

export function FamilyWelcome() {
  return (
    <EmptyState title="Bienvenido a The Gala Alliance">
      Cuando tu hijo o hija acepte la invitación, aquí verás lo importante: documentos, costes, plazos, quién le contacta y qué permisos hay.
      Sin contraseñas compartidas: cada uno con su propia cuenta.
    </EmptyState>
  );
}
