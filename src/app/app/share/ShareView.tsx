import Link from 'next/link';
import { Eye, Lock, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { revokeRecruitingLink } from '@/app/actions/recruiting';
import { ButtonLink, EmptyState, PageHeader, cx } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { CopyButton, NewLinkForm } from '@/components/recruiting-client';
import { daysLeft, linkState, shareTexts } from '@/lib/domain/recruiting';
import { relativeTime } from '@/lib/domain/portfolio';

export interface ShareAthlete { id: string; name: string; sport: string | null; position: string | null; gradYear: number | null; isMinor: boolean; isSelf: boolean }
export interface ShareLink { id: string; athleteId: string; label: string; url: string; expiresAt: string; revokedAt: string | null; createdAt: string; views: number }

const STATE = {
  active: { label: 'Activo', cls: 'bg-ok/10 text-ok ring-ok/25' },
  expired: { label: 'Caducado', cls: 'bg-surface-2 text-muted ring-line-strong' },
  revoked: { label: 'Revocado', cls: 'bg-danger/10 text-danger ring-danger/25' },
} as const;

/**
 * "Compartir mi perfil": el momento clave de la Oleada 1. Un enlace por coach o universidad,
 * listo para WhatsApp o email en inglés, con aperturas visibles y revocable en un toque.
 */
export function ShareView({ athletes, links, isParent }: { athletes: ShareAthlete[]; links: ShareLink[]; isParent: boolean }) {
  if (!athletes.length) {
    return (
      <>
        <PageHeader title="Compartir mi perfil" description="Envía tu ficha de reclutamiento a coaches de EE. UU. con un enlace privado." />
        <EmptyState
          title={isParent ? 'Aún no tienes un atleta vinculado' : 'Primero completa tu Passport'}
          action={<ButtonLink href={isParent ? '/app/family' : '/app/athlete/passport'}>{isParent ? 'Vincular a mi hijo o hija' : 'Completar mi Passport'}</ButtonLink>}
        >
          {isParent ? 'Cuando tu hijo o hija apruebe el vínculo, podrás crear sus enlaces de reclutamiento.' : 'La ficha que ve el coach sale de tu Passport: deporte, posición, vídeo y notas.'}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Compartir mi perfil"
        description="Crea un enlace privado para cada coach o universidad. Lo abren sin registrarse, ves cuántas veces lo han abierto y lo desactivas cuando quieras."
      />

      <div className="space-y-10">
        {athletes.map((a) => {
          const mine = links.filter((l) => l.athleteId === a.id);
          const canCreate = !a.isMinor || !a.isSelf;
          return (
            <section key={a.id} aria-labelledby={`ath-${a.id}`} className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="space-y-4">
                {athletes.length > 1 && <h2 id={`ath-${a.id}`} className="font-display text-lg font-bold text-paper">{a.name}</h2>}
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <h3 className="font-display text-base font-bold text-paper">Nuevo enlace</h3>
                  {canCreate ? (
                    <div className="mt-4"><NewLinkForm athleteId={a.id} /></div>
                  ) : (
                    <p className="mt-2 flex gap-2.5 text-sm leading-relaxed text-muted">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust" aria-hidden />
                      Como eres menor de edad, tu madre, padre o tutor crea los enlaces desde su cuenta. Tú puedes verlos y desactivarlos.
                    </p>
                  )}
                </div>
                <div className="rounded-[var(--radius-card)] border border-line p-5 text-sm leading-relaxed text-muted">
                  <p className="flex items-center gap-2 font-semibold text-paper"><Lock className="h-4 w-4 text-brass" aria-hidden /> Qué ve el coach</p>
                  <p className="mt-2">Tu vídeo, posición, promoción, altura y nota media convertida, en inglés. Nunca tu presupuesto ni tus datos de contacto.{a.isMinor ? ' Al ser menor, tampoco tus apellidos, equipo ni ciudad.' : ''}</p>
                </div>
              </div>

              <div className="min-w-0">
                {!mine.length ? (
                  <EmptyState title="Todavía no has compartido tu perfil">
                    Crea un enlace para cada coach: así sabrás quién lo ha abierto.
                  </EmptyState>
                ) : (
                  <ul className="space-y-3">
                    {mine.map((l) => {
                      const st = linkState({ expires_at: l.expiresAt, revoked_at: l.revokedAt });
                      const t = shareTexts({ name: a.name, sport: a.sport, position: a.position, gradYear: a.gradYear, url: l.url });
                      const left = daysLeft(l.expiresAt);
                      return (
                        <li key={l.id} className={cx('rounded-[var(--radius-card)] border bg-surface p-4 sm:p-5', st === 'active' ? 'border-line' : 'border-line/60 opacity-70')}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-paper">{l.label}</p>
                              <p className="mt-0.5 text-xs text-faint">
                                Creado {relativeTime(l.createdAt)}{st === 'active' ? `, caduca en ${left} día${left === 1 ? '' : 's'}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-sm tabular-nums text-paper" title="Veces que se ha abierto">
                                <Eye className="h-4 w-4 text-faint" aria-hidden /> {l.views} <span className="sr-only">aperturas</span>
                              </span>
                              <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATE[st].cls)}>{STATE[st].label}</span>
                            </div>
                          </div>
                          {st === 'active' && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <CopyButton text={l.url} />
                              <a href={t.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-paper transition-colors hover:border-brass/50">
                                <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                              </a>
                              <a href={t.mailto} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-paper transition-colors hover:border-brass/50">
                                <Mail className="h-4 w-4" aria-hidden /> Email en inglés
                              </a>
                              <Link href={l.url} target="_blank" className="px-2 text-sm font-medium text-brass hover:underline">Ver como coach</Link>
                              <form action={revokeRecruitingLink} className="ml-auto">
                                <input type="hidden" name="id" value={l.id} />
                                <SubmitButton variant="ghost" pendingText="…" className="px-3 py-2 text-sm hover:text-danger">Desactivar</SubmitButton>
                              </form>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
