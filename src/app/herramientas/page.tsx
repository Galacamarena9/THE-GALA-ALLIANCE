import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BookOpen, Bot, Calculator, ClipboardList, FileText, GraduationCap, Lock, Map, Scale, Search, Sparkles, Trophy,
} from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/PublicShell';
import { BRAND } from '@/content/brand';

export const metadata: Metadata = {
  title: 'Herramientas gratuitas de recruiting deportivo',
  description: 'Test de opciones, calculadora del coste real de una beca, guía oficial del proceso y explorador de oportunidades. Gratis y sin registro.',
  alternates: { canonical: '/herramientas' },
};

/**
 * Hub de herramientas. Regla: solo herramientas que EXISTEN y funcionan hoy.
 * Lo que no existe (p. ej. análisis de vídeo con IA) no aparece.
 */
type Tool = { Icon: typeof Calculator; name: string; question: string; text: string; href: string; cta: string };

const OPEN: Tool[] = [
  { Icon: Sparkles, name: 'Test de opciones', question: '¿Tengo opciones de beca en EE. UU.?', text: 'Cuatro preguntas: dónde encajarías (NCAA, NAIA, JUCO), qué te haría subir de nivel y tu roadmap.', href: '/#test', cta: 'Hacer el test' },
  { Icon: Calculator, name: 'Calculadora del coste real', question: '¿Cuánto pagaría de verdad?', text: 'Coste y ayudas de cada oferta en tres escenarios, el total a 4 años y un comparador de hasta 5 opciones.', href: '/calculadora', cta: 'Calcular' },
  { Icon: BookOpen, name: 'Guía oficial del proceso', question: '¿Por dónde empiezo?', text: 'Divisiones, becas, admisión, visado y plazos, con la fuente oficial en cada capítulo.', href: '/guia', cta: 'Leer la guía' },
  { Icon: Search, name: 'Explorador de oportunidades', question: '¿Qué oportunidades hay?', text: 'Becas, pruebas y eventos publicados por organizaciones verificadas, con su sello de confianza.', href: '/oportunidades', cta: 'Explorar' },
];

const WITH_PASSPORT: Tool[] = [
  { Icon: Map, name: 'Mi plan', question: '¿Qué hago ahora?', text: 'Tu roadmap generado desde el Passport y datos oficiales. Se actualiza cuando lo mejoras.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: Trophy, name: 'Gala Match por áreas', question: '¿Encajo en esta oportunidad?', text: 'Deportivo, académico, económico y plazos: por qué encajas, qué te falta y con qué confianza.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: GraduationCap, name: 'Universidades y comparador', question: '¿Qué universidad me conviene?', text: 'Coste y web de College Scorecard (Departamento de Educación de EE. UU.) y comparación lado a lado. Catálogo en construcción.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: Scale, name: 'Comparador de ofertas', question: '¿Qué oferta elijo?', text: 'Coste neto, sello de confianza y señales de alarma de cada oferta, con un memo de lo que falta por preguntar.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: ClipboardList, name: 'Academia SAT/TOEFL', question: '¿Cómo preparo los exámenes?', text: 'SAT digital y TOEFL 2026: práctica con explicación y calendario oficial. Tu familia puede seguir tu progreso.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: Bot, name: 'Gala IA', question: '¿Qué significa esto para mí?', text: 'Explica, compara y te dice el siguiente paso con tu Passport y fuentes oficiales. Nunca promete becas.', href: '/signup?role=athlete', cta: 'Crear Passport' },
  { Icon: FileText, name: 'CV deportivo', question: '¿Qué le envío a un coach?', text: 'Tu Passport en una página lista para imprimir o enviar a un coach.', href: '/signup?role=athlete', cta: 'Crear Passport' },
];

function ToolCard({ t, locked }: { t: Tool; locked?: boolean }) {
  return (
    <li className="min-w-0">
      <Link href={t.href} className="hover-lift group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 focus-visible:outline-brass">
        <span className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass/10"><t.Icon className="h-5 w-5 text-brass" aria-hidden /></span>
          {locked && <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-muted"><Lock className="h-3 w-3" aria-hidden />Con Passport gratis</span>}
        </span>
        <span className="mt-5 block text-sm font-semibold text-brass">{t.question}</span>
        <span className="mt-1 block text-lg font-bold text-paper">{t.name}</span>
        <span className="mt-2 block flex-1 text-sm leading-relaxed text-muted">{t.text}</span>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brass">{t.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
      </Link>
    </li>
  );
}

export default function ToolsPage() {
  return (
    <div className="relative">
      <PublicHeader />
      <main id="main-content">
        <section className="relative overflow-hidden bg-night px-6 py-20 text-white">
          <div className="court-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-5xl">
            <p className="mb-3 text-sm font-semibold text-lime">Herramientas</p>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.92] md:text-7xl">Respuestas antes de registrarte</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-lavender">Cada herramienta responde a una pregunta real del proceso. Las primeras cuatro son gratis y sin registro; el resto se activa con tu {BRAND.passport}, también gratis.</p>
          </div>
        </section>

        <section aria-labelledby="abiertas" className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 id="abiertas" className="font-display text-3xl font-bold uppercase text-paper md:text-4xl">Sin registro</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{OPEN.map((t) => <ToolCard key={t.name} t={t} />)}</ul>
          </div>
        </section>

        <section aria-labelledby="passport" className="bg-surface-2/60 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 id="passport" className="font-display text-3xl font-bold uppercase text-paper md:text-4xl">Con tu {BRAND.passport}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">Usan tus datos para darte respuestas personales. Gratis para atletas: ningún plan compra visibilidad.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{WITH_PASSPORT.map((t) => <ToolCard key={t.name} t={t} locked />)}</ul>
            <p className="mt-6 text-sm text-muted">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brass hover:underline">Inicia sesión</Link></p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
