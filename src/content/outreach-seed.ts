/**
 * Lista inicial de difusión (22-11-2026). Solo organizaciones, con la página pública de donde sale cada una.
 * Sin correos inventados: donde no hay un correo público verificado, el canal es «formulario web» y Gala completa
 * el contacto a mano antes de invitar. Detalle y criterios en el informe de fuentes y difusión.
 */
import type { OutreachChannel, OutreachSegment } from '@/lib/domain/outreach';

export interface SeedContact { segment: OutreachSegment; organizationName: string; country: string | null; channel: OutreachChannel; email: string | null; sourceUrl: string; notes: string }

const EUROHOOPS = 'https://www.eurohoops.net/en/trademarks/1958656/the-top-agencies-in-euroleague-basketball-2025-26-season/';
const EUROBASKET_ES = 'https://www.eurobasket.com/Spain/basketball-Agents.aspx';

export const OUTREACH_SEED: SeedContact[] = [
  { segment: 'agency', organizationName: 'BeoBasket', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: '1.ª agencia de la Euroliga 2025-26 (57 jugadores).' },
  { segment: 'agency', organizationName: 'Gersh Sports', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: 'Antes You First. 27 jugadores en la Euroliga 2025-26.' },
  { segment: 'agency', organizationName: 'Network Sports', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: '26 jugadores en la Euroliga 2025-26.' },
  { segment: 'agency', organizationName: 'Octagon Europe', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: '24 jugadores en la Euroliga 2025-26; agentes en España.' },
  { segment: 'agency', organizationName: 'The Team', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: 'Antes Wasserman. 24 jugadores en la Euroliga 2025-26.' },
  { segment: 'agency', organizationName: 'Priority Sports', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: '15 jugadores en la Euroliga 2025-26.' },
  { segment: 'agency', organizationName: 'Sigma Sports', country: null, channel: 'web_form', email: null, sourceUrl: EUROHOOPS, notes: '12 jugadores en la Euroliga 2025-26.' },
  { segment: 'agency', organizationName: 'Promo Sport ID BPC Group', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: 'Agencia destacada en España.' },
  { segment: 'agency', organizationName: 'Basketball International Group', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: 'Agencia destacada en España.' },
  { segment: 'agency', organizationName: 'Helping Ballers', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: 'Agencia destacada en España.' },
  { segment: 'agency', organizationName: 'FOZ Sports & Events', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: '37 jugadores según Eurobasket.' },
  { segment: 'agency', organizationName: 'Romaior Sports', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: '32 jugadores según Eurobasket.' },
  { segment: 'agency', organizationName: 'Stayline Sports', country: 'ES', channel: 'web_form', email: null, sourceUrl: EUROBASKET_ES, notes: 'Agencia española activa.' },
  { segment: 'agency', organizationName: 'AGM Sports', country: 'ES', channel: 'email', email: 'info@agmeducacion.com', sourceUrl: 'https://www.european-funding-guide.eu/es/node/71149', notes: 'Becas deportivas en EE. UU.; más de 1.000 estudiantes colocados. Correo genérico publicado.' },
  { segment: 'agency', organizationName: 'United Sports Agency (USAGENCY)', country: 'ES', channel: 'web_form', email: null, sourceUrl: 'https://www.que.es/2023/09/04/el-mercado-de-becas-deportivas-en-estados-unidos-lo-ha-roto-una-startup/', notes: 'Becas de fútbol en EE. UU.; sede en Lanzadera (Valencia).' },
  { segment: 'federation', organizationName: 'Federació de Bàsquet de la Comunitat Valenciana (FBCV)', country: 'ES', channel: 'email', email: 'fbcv@fbcv.es', sourceUrl: 'https://www.fbcv.es/wp-content/uploads/2018/06/LA-INFLUENCIA-DE-LA-ESTADI%cc%81STICA-EN-EL-JUEGO-DE-FORMACIO%cc%81N-IGNACIO-PALMERO.pdf', notes: 'Federación de Valencia. Proponer convenio de difusión (modelo AGM–Federación de Atletismo de Madrid).' },
];
