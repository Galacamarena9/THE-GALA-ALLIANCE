import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { Card, CardTitle, Notice, PageHeader } from '@/components/ui';
import { ShareInvite } from '@/components/ShareInvite';

export const metadata: Metadata = { title: 'Invitar' };

/**
 * 20 · Invitar a tu equipo, club o compañeros. Sin premios que empujen al spam y sin listas de quién se unió:
 * solo cuántas personas llegaron con tu enlace. Los menores no tienen enlace de invitación.
 */
export default async function InvitePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: code }, { data: count }] = await Promise.all([supabase.rpc('my_referral_code'), supabase.rpc('my_referral_count')]);
  const isOrg = session.roles.some((r) => ['coach', 'university', 'agent', 'brand'].includes(r));
  return (
    <>
      <PageHeader kicker="Crecer juntos" title="Invita a quien lo necesite" description={isOrg ? 'Comparte The Gala Alliance con tu equipo, tus atletas o tus colegas.' : 'Comparte The Gala Alliance con tus compañeros de equipo o tu club.'} />
      {code ? (
        <Card>
          <CardTitle kicker="Tu enlace">Compártelo por WhatsApp, email o redes</CardTitle>
          <ShareInvite url={`${siteUrl()}/signup?ref=${code}`} />
          <p className="mt-4 text-sm text-muted">{count ? `${count} persona${count === 1 ? '' : 's'} se ha${count === 1 ? '' : 'n'} unido con tu enlace.` : 'Todavía nadie se ha unido con tu enlace.'} No te mostramos quién: lo verás si os conectáis.</p>
        </Card>
      ) : (
        <Notice tone="neutral">Las invitaciones están disponibles a partir de los 18 años. Si alguien de tu equipo quiere unirse, puede registrarse directamente.</Notice>
      )}
    </>
  );
}
