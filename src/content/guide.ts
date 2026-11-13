/**
 * Centro de información de The Gala Alliance.
 *
 * Reglas editoriales:
 * - Cada dato normativo enlaza a su fuente oficial y lleva fecha de revisión.
 * - Nunca prometemos elegibilidad, admisión ni beca: la decisión es de la universidad
 *   y de los centros de elegibilidad.
 * - Las normas cambian (p. ej. NCAA 2023 y acuerdo House 2025): revisar cada temporada.
 * - Gala puede sustituir o ampliar el capítulo "lo-que-te-vas-a-encontrar" con su guía propia.
 */
export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}
export interface GuideChapter {
  slug: string;
  title: string;
  audience: string;
  summary: string;
  sections: GuideSection[];
  sources: { label: string; url: string }[];
  reviewed: string;
}

const NCAA_INTL = { label: 'NCAA · Estudiantes-atletas internacionales', url: 'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/international-student-athletes/' };
const NCAA_D1 = { label: 'NCAA · Requisitos Division I', url: 'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/division-i/' };
const NCAA_D3 = { label: 'NCAA · Division III', url: 'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/division-iii/' };
const NCAA_EC = { label: 'NCAA Eligibility Center (registro)', url: 'https://www.eligibilitycenter.org' };
const NCAA_ROSTER = { label: 'NCAA · Límites de plantilla (2025)', url: 'https://www.ncaa.org/news/2025/6/23/media-center-di-board-of-directors-formally-adopts-changes-to-roster-limits.aspx' };
const NAIA_INTL = { label: 'NAIA · Estudiantes internacionales', url: 'https://www.naia.org/student-athletes/prospective/international-students/' };
const PLAY_NAIA = { label: 'PlayNAIA (registro NAIA)', url: 'https://play.mynaia.org/' };
const STATE_VISA = { label: 'U.S. Department of State · Visado de estudiante', url: 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html' };
const SEVIS_FEE = { label: 'Pago oficial de la tasa SEVIS I-901', url: 'https://fmjfee.com/i901fee/index.html' };
const EDUCATIONUSA = { label: 'EducationUSA (orientación oficial)', url: 'https://educationusa.state.gov/' };

export const GUIDE: GuideChapter[] = [
  {
    slug: 'divisiones-y-becas',
    title: 'Divisiones y tipos de beca',
    audience: 'Atletas y familias',
    summary: 'NCAA D1, D2, D3, NAIA y JUCO: qué ofrece cada una y dónde hay becas deportivas.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'Las asociaciones',
        bullets: [
          'NCAA Division I: el nivel deportivo más alto y con más recursos.',
          'NCAA Division II: nivel competitivo con equilibrio entre deporte y estudios; las becas suelen ser parciales.',
          'NCAA Division III: no ofrece becas deportivas, pero sí ayudas académicas o por necesidad económica.',
          'NAIA: asociación independiente de la NCAA, con su propio centro de elegibilidad y becas deportivas.',
          'NJCAA (JUCO): colleges de dos años; una vía habitual para dar el salto después a una universidad de cuatro años.',
        ],
      },
      {
        heading: 'Qué ha cambiado desde 2025 en Division I',
        paragraphs: [
          'Tras el acuerdo House v. NCAA, las universidades de Division I que se adhieren ya no tienen límites de becas por deporte: en su lugar hay límites de plantilla (roster). En la práctica, el número de becas posibles crece, pero también la competencia por cada plaza en el equipo.',
          'Cada universidad decide cuántas becas da y de qué importe. Pregunta siempre por el coste neto y por tu plaza en la plantilla, no solo por el porcentaje de beca.',
        ],
      },
      {
        heading: 'Beca deportiva ≠ coste cero',
        paragraphs: [
          'Una "beca del 50 %" puede significar costes muy distintos según la matrícula, el alojamiento, el seguro médico y los viajes. Compara siempre por coste neto anual con la calculadora.',
        ],
      },
    ],
    sources: [NCAA_D3, NCAA_ROSTER, NAIA_INTL],
  },
  {
    slug: 'requisitos-academicos',
    title: 'Requisitos académicos y elegibilidad',
    audience: 'Atletas y familias',
    summary: 'Qué pide el centro de elegibilidad y cómo se valoran tus notas españolas.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'NCAA Division I y II',
        bullets: [
          'Registrarte en el NCAA Eligibility Center, que certifica tu elegibilidad académica y tu condición de amateur.',
          'Division I exige 16 cursos troncales ("core courses") y una nota media mínima de 2,3 en esos cursos.',
          'Desde enero de 2023, el SAT y el ACT ya no son requisito de elegibilidad inicial en Division I y II. Algunas universidades pueden seguir pidiéndolos para la admisión o para becas académicas.',
          'Para estudiantes con formación solo internacional, la NCAA aplica estándares por país: consulta el apartado de España.',
        ],
      },
      {
        heading: 'NCAA Division III',
        paragraphs: [
          'Cada universidad fija sus propios requisitos de admisión. Aun así, los estudiantes internacionales deben registrarse en el Eligibility Center para la certificación deportiva antes de competir.',
        ],
      },
      {
        heading: 'NAIA',
        paragraphs: [
          'Todos los atletas que juegan por primera vez en la NAIA deben registrarse en su centro de elegibilidad (PlayNAIA). A los estudiantes internacionales se les exige además una evaluación de sus títulos a través de InCred.',
        ],
      },
      {
        heading: 'Cómo lo usa la plataforma',
        paragraphs: [
          'Para calcular encajes convertimos tu nota a escala 4.0 de forma aproximada. La conversión oficial la hace el centro de elegibilidad: úsala como orientación, no como certificación.',
        ],
      },
    ],
    sources: [NCAA_D1, NCAA_INTL, NCAA_D3, NCAA_EC, NAIA_INTL, PLAY_NAIA],
  },
  {
    slug: 'documentos',
    title: 'Documentos que vas a necesitar',
    audience: 'Familias',
    summary: 'La checklist completa, desde el pasaporte hasta las notas oficiales traducidas.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'Para el perfil y el contacto con coaches',
        bullets: ['Vídeo de highlights (3-5 minutos, lo mejor al principio)', 'Estadísticas de la temporada y del club', 'Calendario de partidos o competiciones', 'Referencias de tu entrenador actual'],
      },
      {
        heading: 'Para elegibilidad y admisión',
        bullets: [
          'Pasaporte en vigor',
          'Certificados oficiales de notas de secundaria y bachillerato',
          'Traducción de esos certificados cuando se exija',
          'Prueba de graduación al terminar el instituto',
          'Certificado de inglés (TOEFL, IELTS, Duolingo English Test…) según pida cada universidad',
        ],
      },
      {
        heading: 'Para el visado',
        bullets: ['Formulario I-20 emitido por la universidad', 'Justificante de pago de la tasa SEVIS I-901', 'Confirmación del formulario DS-160', 'Documentación económica coherente con la que figura en el I-20'],
      },
    ],
    sources: [NCAA_INTL, STATE_VISA, SEVIS_FEE],
  },
  {
    slug: 'proceso-paso-a-paso',
    title: 'El proceso, paso a paso',
    audience: 'Atletas y familias',
    summary: 'Qué hacer en cada curso: de 3.º de ESO al primer día en el campus.',
    reviewed: '2026-11',
    sections: [
      { heading: '1. Explorar (3 o más años antes)', paragraphs: ['Entiende las divisiones, define un presupuesto familiar realista y empieza a cuidar las notas: cuentan todos los cursos de secundaria.'] },
      { heading: '2. Preparar el perfil (2 años antes)', paragraphs: ['Graba tu vídeo de highlights, reúne estadísticas, prepara el examen de inglés y regístrate en el centro de elegibilidad que corresponda.'] },
      { heading: '3. Contactar (1 año antes)', paragraphs: ['Haz una lista de 20-30 programas que encajen contigo y escribe a cada coach un mensaje personal con tu vídeo y tus datos. Las plantillas masivas funcionan mal.'] },
      { heading: '4. Solicitar (último curso)', paragraphs: ['Solicita la admisión académica en cada universidad: la beca deportiva no la sustituye. Compara ofertas por coste neto.'] },
      { heading: '5. Comprometerse y viajar', paragraphs: ['Tras aceptar una oferta, la universidad emite el I-20. Paga la tasa SEVIS, rellena el DS-160, ve a la entrevista consular y completa la certificación final de elegibilidad.'] },
    ],
    sources: [NCAA_EC, EDUCATIONUSA, STATE_VISA],
  },
  {
    slug: 'visado',
    title: 'Visado de estudiante (F-1)',
    audience: 'Familias',
    summary: 'Del I-20 a la entrevista en el consulado, en orden.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'El orden correcto',
        bullets: [
          'La universidad (certificada por SEVP) acepta tu matrícula, te registra en SEVIS y te envía el formulario I-20.',
          'Pagas la tasa SEVIS I-901 en el portal oficial y guardas el justificante.',
          'Rellenas el DS-160 y pagas la tasa de visado.',
          'Pides cita y vas a la entrevista en la embajada o consulado con el I-20 firmado.',
        ],
      },
      {
        heading: 'Importante',
        paragraphs: [
          'No compres billetes hasta tener el visado. Comprueba los importes vigentes en las webs oficiales: cambian.',
          'Con visado F-1 hay limitaciones para trabajar. Cualquier acuerdo con marcas (NIL) debe revisarlo la oficina internacional de tu universidad antes de firmar nada.',
        ],
      },
    ],
    sources: [STATE_VISA, SEVIS_FEE, EDUCATIONUSA],
  },
  {
    slug: 'coste-real',
    title: 'El coste real (y cómo comparar ofertas)',
    audience: 'Familias',
    summary: 'Qué entra en el coste anual y por qué hay que comparar por coste neto.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'Partidas del coste anual',
        bullets: ['Matrícula y tasas obligatorias', 'Alojamiento y comidas', 'Seguro médico', 'Libros y material', 'Viajes (ida y vuelta, vacaciones)', 'Visado, tasa SEVIS y trámites'],
      },
      {
        heading: 'Ayudas',
        bullets: ['Beca deportiva', 'Beca académica o por mérito', 'Ayudas institucionales', 'Otras ayudas confirmadas por escrito'],
        paragraphs: ['Separa lo confirmado de lo estimado. Una ayuda solo cuenta cuando está por escrito en la oferta.'],
      },
      {
        heading: 'Úsalo en la plataforma',
        paragraphs: ['La calculadora de becas te da tres escenarios (prudente, esperado y optimista), el coste a 4 años y un comparador de hasta 5 ofertas.'],
      },
    ],
    sources: [EDUCATIONUSA],
  },
  {
    slug: 'elegir-universidad',
    title: 'Cómo elegir universidad',
    audience: 'Atletas y familias',
    summary: 'Más allá del ranking: plaza en el equipo, carrera, coach y coste.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'Las preguntas que de verdad importan',
        bullets: [
          '¿Qué papel tendré en el equipo el primer año?',
          '¿Ofrecen la carrera que quiero estudiar?',
          '¿Cuánto pagaremos al año, de verdad, durante 4 años?',
          '¿Cómo apoyan a los estudiantes internacionales (idioma, tutorías, visado)?',
          '¿Quién es el coach y cuánto tiempo lleva en el programa?',
        ],
      },
      {
        heading: 'Mezcla tu lista',
        paragraphs: ['Combina programas de encaje fuerte, encaje posible y exigentes. La plataforma te los separa así en cada oportunidad.'],
      },
    ],
    sources: [EDUCATIONUSA],
  },
  {
    slug: 'lo-que-te-vas-a-encontrar',
    title: 'Lo que te vas a encontrar',
    audience: 'Atletas',
    summary: 'La parte que nadie cuenta: el primer año, la adaptación y la vida en el campus.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'El primer año',
        paragraphs: [
          'Llegarás a un equipo con jerarquía propia. Es normal empezar con menos minutos de los que tenías en casa: el primer año se gana en entrenamientos, en clase y en la confianza del cuerpo técnico.',
          'El ritmo es exigente: entrenamientos, gimnasio, viajes, clases y estudio. Organizarte es tan importante como tu nivel deportivo.',
        ],
      },
      {
        heading: 'La adaptación',
        paragraphs: [
          'Idioma, comida, horarios y estar lejos de casa. Los primeros meses pueden ser duros, y eso no significa que te hayas equivocado. Apóyate en tus compañeros internacionales, en tu tutor académico y en el personal de apoyo de la universidad.',
        ],
      },
      {
        heading: 'Volver también es una opción',
        paragraphs: [
          'Si después de un año decides volver o cambiar de universidad, es una decisión legítima. Lo importante es tomarla con información y sin presión.',
        ],
      },
    ],
    sources: [EDUCATIONUSA],
  },
  {
    slug: 'nil-y-marcas',
    title: 'Marcas y NIL',
    audience: 'Atletas 18+ y marcas',
    summary: 'Qué es el NIL y por qué los atletas internacionales necesitan revisión previa.',
    reviewed: '2026-11',
    sections: [
      {
        heading: 'Qué es',
        paragraphs: ['NIL (Name, Image and Likeness) son los acuerdos en los que un atleta cobra por el uso de su nombre, imagen o contenido: embajador de marca, publicaciones en redes, eventos…'],
      },
      {
        heading: 'En The Gala Alliance',
        bullets: [
          'Las ofertas de marcas son solo para atletas mayores de 18 años.',
          'Cada oferta indica entregables, compensación y derechos de uso.',
          'La plataforma no firma contratos ni gestiona pagos: conecta y da transparencia.',
          'Si estudias o vas a estudiar en EE. UU. con visado F-1, consulta con la oficina internacional y el área de compliance de tu universidad antes de aceptar cualquier acuerdo.',
        ],
      },
    ],
    sources: [STATE_VISA],
  },
];

export function guideChapter(slug: string) {
  return GUIDE.find((c) => c.slug === slug);
}

/** Texto plano de la guía para dar contexto a Gala IA. */
export function guideAsContext() {
  return GUIDE.map((c) =>
    [
      `## ${c.title} (/guia/${c.slug})`,
      ...c.sections.flatMap((s) => [`### ${s.heading}`, ...(s.paragraphs ?? []), ...(s.bullets ?? []).map((b) => `- ${b}`)]),
      `Fuentes: ${c.sources.map((x) => `${x.label} <${x.url}>`).join('; ')}`,
    ].join('\n'),
  ).join('\n\n');
}
