import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Ban, Download, Eye, FileCheck2, Gavel, Lock, Scale, ShieldCheck, Sparkles, UserCheck, Users } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';
import { publicMeta } from '@/lib/seo/page-meta';

export const metadata: Metadata = publicMeta({
  title: 'Seguridad y confianza',
  description: 'Cómo protege The Gala Alliance a menores, familias y datos: verificación de organizaciones, privacidad por defecto, matching explicado y control de tus datos.',
  path: '/seguridad',
});

/**
 * Centro de confianza. Regla: cada compromiso describe algo que la plataforma ya hace (código o base de datos),
 * no una intención. Si algo no está implementado, no aparece aquí.
 */
const COMMITMENTS: { Icon: typeof Lock; title: string; how: string }[] = [
  { Icon: Lock, title: 'Menores privados por defecto', how: 'Nunca visibles para visitantes anónimos, marcas ni agentes. Lo garantiza la base de datos, no solo la interfaz.' },
  { Icon: Users, title: 'La familia en el circuito', how: 'Con menores, solo contactan organizaciones verificadas, con aprobación de la familia, que puede leer el hilo. Sin emails ni teléfonos en los mensajes.' },
  { Icon: Ban, title: 'Las marcas no acceden a menores', how: 'Las campañas solo se muestran a atletas mayores de edad y nunca son públicas.' },
  { Icon: BadgeCheck, title: 'Organizaciones verificadas', how: 'Universidades, clubes, agencias y marcas se verifican con su dominio oficial antes de publicar o contactar.' },
  { Icon: ShieldCheck, title: 'Sello de confianza en cada oportunidad', how: 'Cinco niveles y un detector de señales de alarma: pagos por adelantado, becas «garantizadas», prisas o cifras sin fuente.' },
  { Icon: FileCheck2, title: 'Origen visible de cada dato', how: 'Cada dato del Passport indica si es declarado, documentado o confirmado por el club. Verificado no significa mejor: significa comprobado.' },
  { Icon: Scale, title: 'Matching explicado, no por popularidad', how: 'Cada encaje dice qué criterios cumples, cuáles no y qué datos faltan. Es compatibilidad, nunca probabilidad de beca.' },
  { Icon: Sparkles, title: 'Nadie paga por salir primero', how: 'Ningún plan compra posición ni «destacados». La visibilidad deportiva básica es gratis para siempre.' },
  { Icon: Gavel, title: 'Normas NCAA integradas', how: 'Una universidad D-I o D-II no puede escribirte antes de la fecha de contacto que marca tu promoción y tu deporte.' },
  { Icon: UserCheck, title: 'Ningún agente sin tu permiso', how: 'Un agente solo representa a un atleta que lo ha aceptado, y el atleta puede retirarlo.' },
  { Icon: Eye, title: 'Denuncia y bloqueo efectivos', how: 'Puedes bloquear a cualquier usuario y denunciar perfiles u oportunidades; un equipo revisa cada denuncia.' },
  { Icon: Download, title: 'Tus datos, tus reglas', how: 'Visibilidad por bloque, descarga de tus datos y baja de la cuenta en autoservicio, con borrado programado.' },
];

const NEVER = [
  'Garantizar becas, admisiones, contratos ni resultados.',
  'Inventar universidades, becas, estadísticas, testimonios o usuarios.',
  'Usar urgencia falsa o patrones oscuros para que pagues.',
  'Vender tus datos ni mostrarte publicidad perfilada.',
];

export default function SecurityPage() {
  return (
    <div className="relative">
      <PublicHeader />
      <main id="main-content">
        <section className="relative overflow-hidden bg-night px-6 py-20 text-white">
          <div className="court-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-4xl">
            <p className="mb-3 text-sm font-semibold text-lime">Seguridad y confianza</p>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.92] md:text-7xl">La confianza es el producto</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-lavender">{BRAND.promise}</p>
          </div>
        </section>

        <section aria-labelledby="compromisos-title" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 id="compromisos-title" className="font-display text-4xl font-bold uppercase leading-none text-paper md:text-5xl">Lo que hacemos</h2>
            <p className="mt-3 max-w-2xl text-muted">Cada compromiso está aplicado en la plataforma hoy. Si algo todavía no lo está, no aparece en esta lista.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COMMITMENTS.map(({ Icon, title, how }) => (
                <li key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/10"><Icon className="h-5 w-5 text-brass" aria-hidden /></span>
                  <h3 className="mt-5 text-base font-bold text-paper">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{how}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="nunca-title" className="bg-surface-2/60 px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            <div>
              <h2 id="nunca-title" className="font-display text-4xl font-bold uppercase leading-none text-paper md:text-5xl">Lo que nunca haremos</h2>
              <ul className="mt-6 space-y-3">
                {NEVER.map((t) => <li key={t} className="flex items-start gap-3 text-paper"><Ban className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />{t}</li>)}
              </ul>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <h3 className="text-lg font-bold text-paper">Documentos y estado legal</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Diseñamos la plataforma pensando en el RGPD y la LOPDGDD. Los textos legales son borradores pendientes de revisión jurídica: no afirmamos un cumplimiento completo hasta que esa revisión exista.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[['proteccion-menores', 'Protección de menores'], ['privacidad', 'Privacidad'], ['normas', 'Normas de la comunidad'], ['cookies', 'Cookies'], ['terminos', 'Términos']].map(([slug, label]) => (
                  <li key={slug}><Link href={`/legal/${slug}`} className="inline-flex items-center gap-1 font-semibold text-brass hover:underline">{label} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
