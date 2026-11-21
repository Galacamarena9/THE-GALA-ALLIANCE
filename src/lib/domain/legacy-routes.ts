/**
 * Prompt 4 · Mapa de redirecciones: nombres nuevos de cada modo y pantallas fusionadas → ruta canónica.
 * Las rutas físicas no cambian (enlaces profundos, server actions y revalidaciones siguen funcionando);
 * estos alias permiten usar el nombre que ve el usuario y retiran pantallas duplicadas sin romper enlaces.
 * Lo comparten next.config.ts y las pruebas (sin bucles, destino existente).
 */
export interface LegacyRedirect { source: string; destination: string; permanent: boolean; why: string }

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  // Agent OS
  { source: '/app/athletes', destination: '/app/portfolio', permanent: false, why: 'Agent OS · «Atletas»' },
  { source: '/app/athletes/:id', destination: '/app/portfolio/:id', permanent: false, why: 'Agent OS · ficha del atleta' },
  { source: '/app/recruiting', destination: '/app/pipeline', permanent: false, why: 'Agent OS · «Recruiting»' },
  // Athlete OS
  { source: '/app/journey', destination: '/app/process', permanent: false, why: 'Athlete OS · «Mi camino»' },
  { source: '/app/profile', destination: '/app/athlete/passport', permanent: false, why: 'Athlete OS · «Perfil»' },
  // University OS
  { source: '/app/candidates', destination: '/app/recruit/candidates', permanent: false, why: 'University OS · «Candidatos»' },
  // Gala Operations
  { source: '/app/admin/verification', destination: '/app/admin', permanent: false, why: 'Operaciones · Verificación' },
  { source: '/app/admin/moderation', destination: '/app/admin?view=moderation', permanent: false, why: 'Operaciones · Moderación' },
  { source: '/app/admin/compliance', destination: '/app/admin/ops', permanent: false, why: 'Operaciones · Cumplimiento' },
  { source: '/app/admin/trust', destination: '/app/admin/safety', permanent: false, why: 'Operaciones · Confianza' },
  { source: '/app/admin/support', destination: '/app/admin/ops?view=support', permanent: false, why: 'Operaciones · Soporte' },
  // Pantallas fusionadas (contenido duplicado con la web pública)
  { source: '/app/portal/:slug', destination: '/para/:slug', permanent: true, why: 'Portales por perfil = páginas públicas /para' },
];
