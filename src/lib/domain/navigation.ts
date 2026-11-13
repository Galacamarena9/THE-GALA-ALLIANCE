import type { AppRole } from '@/lib/types';
import { ACTORS } from './roles';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}
export type IconName =
  | 'home' | 'showcase' | 'trophy' | 'campus' | 'book' | 'calc' | 'spark' | 'path' | 'id' | 'inbox'
  | 'megaphone' | 'handshake' | 'family' | 'pipeline' | 'list' | 'building' | 'shield' | 'users' | 'chat' | 'news'
  | 'grad' | 'bell' | 'tag' | 'chart';

/** Servicios comunes: todos los usuarios los tienen. */
export const COMMON_SERVICES: NavItem[] = [
  { href: '/app/inbox', label: 'Mensajes', icon: 'chat' },
  { href: '/app/news', label: 'Actualidad', icon: 'news' },
  { href: '/app/discover', label: 'Escaparate de atletas', icon: 'showcase' },
  { href: '/app/opportunities', label: 'Becas y oportunidades', icon: 'trophy' },
  { href: '/app/universities', label: 'Universidades', icon: 'campus' },
  { href: '/app/guia', label: 'Centro de información', icon: 'book' },
  { href: '/app/calculator', label: 'Calculadora de becas', icon: 'calc' },
  { href: '/app/ia', label: 'Gala IA', icon: 'spark' },
];

/** Servicios personales por tipo de usuario. */
export const PERSONAL_SERVICES: Record<AppRole, NavItem[]> = {
  athlete: [
    { href: '/app/athlete', label: 'Mi camino', icon: 'path' },
    { href: '/app/athlete/passport', label: 'Mi Passport', icon: 'id' },
    { href: '/app/plan', label: 'Mi plan', icon: 'spark' },
    { href: '/app/documents', label: 'Documentos', icon: 'book' },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad' },
    { href: '/app/applications', label: 'Mis candidaturas', icon: 'inbox' },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'calc' },
    { href: '/app/campaigns', label: 'Ofertas de marcas', icon: 'megaphone' },
    { href: '/app/agents', label: 'Agentes', icon: 'handshake' },
  ],
  parent: [
    { href: '/app/family', label: 'Panel familiar', icon: 'family' },
    { href: '/app/plan', label: 'Plan familiar', icon: 'spark' },
    { href: '/app/documents', label: 'Documentos', icon: 'book' },
    { href: '/app/offers', label: 'Comparar ofertas', icon: 'calc' },
    { href: '/app/academia', label: 'Academia SAT/TOEFL', icon: 'grad' },
  ],
  university: [
    { href: '/app/opportunities?view=mine', label: 'Nuestras becas', icon: 'trophy' },
    { href: '/app/applications', label: 'Pipeline de recruiting', icon: 'pipeline' },
    { href: '/app/lists', label: 'Shortlists', icon: 'list' },
    { href: '/app/organization', label: 'Perfil y equipo', icon: 'building' },
  ],
  coach: [
    { href: '/app/lists', label: 'Mis shortlists', icon: 'list' },
    { href: '/app/applications', label: 'Pipeline', icon: 'pipeline' },
    { href: '/app/organization', label: 'Mi universidad o club', icon: 'building' },
    { href: '/app/club', label: 'Portal de academia o club', icon: 'family' },
  ],
  agent: [
    { href: '/app/portfolio', label: 'Mi cartera', icon: 'handshake' },
    { href: '/app/lists', label: 'Prospectos', icon: 'list' },
    { href: '/app/organization', label: 'Agencia', icon: 'building' },
  ],
  brand: [
    { href: '/app/campaigns?view=mine', label: 'Mis ofertas', icon: 'megaphone' },
    { href: '/app/lists', label: 'Atletas guardados', icon: 'list' },
    { href: '/app/organization', label: 'Marca', icon: 'building' },
  ],
  admin: [
    { href: '/app/admin/panel', label: 'Panel de mando', icon: 'chart' },
    { href: '/app/admin', label: 'Revisión y verificación', icon: 'shield' },
  ],
};

export function sidebarFor(roles: AppRole[]): NavSection[] {
  const sections: NavSection[] = [
    { title: 'Para todos', items: [{ href: '/app', label: 'Inicio', icon: 'home' }, ...COMMON_SERVICES] },
  ];
  const order: AppRole[] = ['athlete', 'parent', 'university', 'coach', 'agent', 'brand', 'admin'];
  for (const role of order) {
    if (!roles.includes(role)) continue;
    const label = role === 'admin' ? 'Admin' : `Espacio ${ACTORS.find((a) => a.role === role)?.label.toLowerCase()}`;
    sections.push({ title: label, items: PERSONAL_SERVICES[role] });
  }
  sections.push({
    title: 'Cuenta',
    items: [
      { href: '/app/notifications', label: 'Notificaciones', icon: 'bell' },
      { href: '/precios', label: 'Planes y servicios', icon: 'tag' },
      { href: '/app/settings', label: 'Privacidad y datos', icon: 'shield' },
    ],
  });
  return sections;
}
