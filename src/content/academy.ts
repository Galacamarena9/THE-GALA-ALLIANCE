/**
 * Academia SAT / TOEFL.
 *
 * Recuperada de la versión Lovable y corregida:
 * - SAT alineado con el SAT digital (Bluebook, dos módulos adaptativos por sección).
 * - TOEFL alineado con el formato vigente desde el 21 de enero de 2026 (escala 1–6).
 * - Eliminados los "mínimos NCAA" de SAT y TOEFL: la NCAA no exige SAT/ACT desde 2023 ni fija
 *   TOEFL; los mínimos los pone cada universidad para la admisión.
 * - Sin rachas, XP ni rankings: la plataforma la usan menores (sin patrones adictivos).
 * Revisar fechas y tarifas cada temporada.
 */
export type Exam = 'sat' | 'toefl';

export interface Concept {
  concept: string;
  explanation: string;
  example?: string;
  tip?: string;
}
export interface Topic {
  id: string;
  exam: Exam;
  section: string;
  title: string;
  summary: string;
  concepts: Concept[];
}
export interface Question {
  id: string;
  exam: Exam;
  topicId: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  /** Ritmo real del examen en segundos por pregunta (solo SAT). */
  paceSeconds?: number;
}

export const ACADEMY_REVIEWED = '2026-11';

const RW_PACE = Math.round((64 * 60) / 54); // 64 min, 54 preguntas
const MATH_PACE = Math.round((70 * 60) / 44); // 70 min, 44 preguntas

export const EXAM_FACTS: Record<Exam, { name: string; format: string[]; scoring: string; sources: { label: string; url: string }[] }> = {
  sat: {
    name: 'SAT digital',
    format: [
      'Se hace en la app Bluebook, con dos secciones: Reading and Writing (54 preguntas, 64 min) y Math (44 preguntas, 70 min). Total: 2 h 14 min con una pausa de 10 min.',
      'Cada sección tiene dos módulos: el segundo es más fácil o más difícil según cómo te haya ido el primero.',
      'Textos cortos con una sola pregunta cada uno. Calculadora Desmos integrada en toda la parte de matemáticas.',
    ],
    scoring: 'De 400 a 1600 (200–800 por sección).',
    sources: [
      { label: 'College Board · Estructura del SAT', url: 'https://satsuite.collegeboard.org/sat/whats-on-the-test/structure' },
      { label: 'College Board · Práctica oficial en Bluebook', url: 'https://bluebook.collegeboard.org/students/download-bluebook' },
      { label: 'Khan Academy · Curso oficial del SAT digital', url: 'https://www.khanacademy.org/digital-sat' },
    ],
  },
  toefl: {
    name: 'TOEFL iBT (formato 2026)',
    format: [
      'Reading (≈50 ítems, ≈30 min): Complete the Words, Read in Daily Life y Read an Academic Passage. Adaptativo.',
      'Listening (≈47 ítems, ≈29 min): Listen and Choose a Response, Conversation, Announcement y Academic Talk. Adaptativo.',
      'Writing (12 ítems, ≈23 min): Build a Sentence, Write an Email y Write for an Academic Discussion.',
      'Speaking (11 ítems, ≈8 min): Listen and Repeat y Take an Interview. Calcula unas 2 horas en total.',
    ],
    scoring:
      'Escala de 1 a 6 en medios puntos, alineada con el MCER (5 = C1). Hasta enero de 2028 el informe incluye también la puntuación comparable 0–120.',
    sources: [
      { label: 'ETS · Contenido y estructura del TOEFL iBT', url: 'https://www.ets.org/toefl/test-takers/ibt/about/content.html' },
      { label: 'ETS · Nueva escala 1–6 y tabla de equivalencias', url: 'https://toeflaccess.ets.org/help/en/articles/11758616-toefl-ibt-score-scale-update-what-you-need-to-know' },
      { label: 'ETS · Envío de resultados y validez', url: 'https://www.ets.org/toefl/test-takers/ibt/scores/sending' },
    ],
  },
};

/** Equivalencias oficiales ETS (puntuación total). */
export const TOEFL_CONCORDANCE: { band: string; legacy: string }[] = [
  { band: '6', legacy: '114–120' },
  { band: '5.5', legacy: '107–113' },
  { band: '5 (C1)', legacy: '95–106' },
  { band: '4.5', legacy: '86–94' },
  { band: '4', legacy: '72–85' },
  { band: '3.5', legacy: '58–71' },
  { band: '3', legacy: '44–57' },
];

/** Calendario oficial SAT 2026-27 (College Board). Las mismas fechas para EE. UU. e internacional. */
export const SAT_DATES: { test: string; deadline: string; late: string }[] = [
  { test: '2026-10-03', deadline: '2026-09-18', late: '2026-09-22' },
  { test: '2026-11-07', deadline: '2026-10-23', late: '2026-10-27' },
  { test: '2026-12-05', deadline: '2026-11-20', late: '2026-11-24' },
  { test: '2027-03-06', deadline: '2027-02-19', late: '2027-02-23' },
  { test: '2027-05-01', deadline: '2027-04-16', late: '2027-04-20' },
  { test: '2027-06-05', deadline: '2027-05-21', late: '2027-05-25' },
];

export const REGISTRATION = {
  sat: {
    url: 'https://satsuite.collegeboard.org/sat/registration',
    datesUrl: 'https://satsuite.collegeboard.org/sat/dates-deadlines',
    feesUrl: 'https://satsuite.collegeboard.org/sat/registration/international-testing/fees',
    facts: [
      'Inscripción fuera de EE. UU.: 68 USD más una tasa internacional de 43 USD. La inscripción tardía cuesta 38 USD más.',
      'Puedes enviar 4 informes de resultados gratis a universidades desde tu cuenta de College Board.',
      'La NCAA ya no exige SAT/ACT para la elegibilidad inicial (desde 2023). Envíalo solo a las universidades que lo pidan o lo valoren para becas académicas.',
    ],
  },
  toefl: {
    url: 'https://www.ets.org/toefl.html',
    feesUrl: 'https://www.ets.org/toefl/ibt/about/fees/',
    facts: [
      'El precio depende del país. En España ronda los 260–280 USD en 2026: comprueba el importe exacto en la página de tarifas de ETS antes de pagar.',
      'Incluye hasta 4 informes gratuitos a universidades si los eliges antes del examen. Los resultados valen 2 años.',
      'Inscríbete con al menos 7 días de antelación para evitar el recargo por inscripción urgente.',
      'La NCAA no fija un mínimo de TOEFL: lo pide cada universidad para la admisión. Algunas aceptan IELTS o Duolingo English Test.',
    ],
  },
};

export const TOPICS: Topic[] = [
  // ---------------------------------------------------------------- SAT · Reading and Writing
  {
    id: 'rw-information', exam: 'sat', section: 'Reading and Writing', title: 'Information and Ideas',
    summary: 'Idea central, inferencias y uso de evidencias del texto o de un gráfico.',
    concepts: [
      { concept: 'Responde solo con lo que dice el texto', explanation: 'La respuesta correcta siempre está respaldada por el pasaje. Si necesitas conocimiento externo para justificarla, es una trampa.', tip: 'Antes de mirar las opciones, resume el texto en una frase.' },
      { concept: 'Evidencia cuantitativa', explanation: 'Algunas preguntas combinan un texto con una tabla o gráfico. La opción correcta debe ser cierta según los datos, no solo sonar razonable.', example: 'Si el texto dice que las ventas "subieron ligeramente" y el gráfico muestra +200 %, manda el gráfico.' },
      { concept: 'Inferencias prudentes', explanation: 'Una inferencia es la conclusión más lógica y conservadora. Descarta las opciones que van más allá de lo que el texto permite afirmar.' },
    ],
  },
  {
    id: 'rw-craft', exam: 'sat', section: 'Reading and Writing', title: 'Craft and Structure',
    summary: 'Palabras en contexto, estructura y propósito del texto, y conexiones entre dos textos.',
    concepts: [
      { concept: 'Palabras en contexto', explanation: 'El SAT usa palabras comunes con significados menos habituales. Sustituye la palabra por un hueco y predice tú el significado antes de leer las opciones.', example: '"The data reflect a steady rise…" → reflect = show (muestran), no mirror.' },
      { concept: 'Propósito frente a tema', explanation: 'Tema = de qué trata. Propósito = para qué lo escribe el autor (informar, argumentar, comparar, describir un proceso).' },
      { concept: 'Dos textos (Cross-Text Connections)', explanation: 'Identifica la postura de cada autor y pregúntate cómo respondería uno al otro: ¿coincide, matiza o rebate?' },
    ],
  },
  {
    id: 'rw-expression', exam: 'sat', section: 'Reading and Writing', title: 'Expression of Ideas',
    summary: 'Conectores lógicos y síntesis retórica (usar unas notas para cumplir un objetivo).',
    concepts: [
      { concept: 'Conectores', explanation: 'Lee la frase anterior y la siguiente y decide la relación: contraste (however, nevertheless), causa (therefore, thus), adición (moreover) o ejemplo (for instance).', tip: 'Si dudas, tapa el conector y explica la relación con tus palabras.' },
      { concept: 'Rhetorical Synthesis', explanation: 'Te dan unas notas y un objetivo ("enfatizar una diferencia", "presentar el estudio a un público nuevo"). Elige la opción que cumple el objetivo, aunque otras sean ciertas.' },
    ],
  },
  {
    id: 'rw-conventions', exam: 'sat', section: 'Reading and Writing', title: 'Standard English Conventions',
    summary: 'Puntuación entre oraciones, concordancia, pronombres y tiempos verbales.',
    concepts: [
      { concept: 'Concordancia sujeto-verbo', explanation: 'El verbo concuerda con el núcleo del sujeto, no con el sustantivo más cercano.', example: '"The list of items IS long" — el sujeto es list.', tip: 'Tacha mentalmente las frases preposicionales (of items).' },
      { concept: 'Punto y coma y dos puntos', explanation: 'El punto y coma une dos oraciones completas. Los dos puntos introducen una lista o explicación, y lo que va antes debe ser una oración completa.', example: '"She had three goals: win the league, improve her free throws, and earn a scholarship."' },
      { concept: 'Pronombres claros', explanation: 'Cada pronombre debe referirse a un único sustantivo. Si "they" puede referirse a dos grupos, la frase es ambigua.' },
    ],
  },
  // ---------------------------------------------------------------- SAT · Math
  {
    id: 'm-algebra', exam: 'sat', section: 'Math', title: 'Algebra',
    summary: 'Ecuaciones e inecuaciones lineales, sistemas y funciones lineales.',
    concepts: [
      { concept: 'Ecuaciones lineales', explanation: 'En y = mx + b, m es la pendiente (cambio por unidad) y b el valor inicial.', example: '3x + 5 = 20 → 3x = 15 → x = 5', tip: '"Por cada" o "cada" suele ser la pendiente; "inicialmente", el término independiente.' },
      { concept: 'Sistemas de ecuaciones', explanation: 'Resuelve por sustitución o por reducción (sumar o restar ecuaciones). En el examen, Desmos te deja ver el punto de corte.', example: 'x + y = 10 y x − y = 4 → 2x = 14 → x = 7, y = 3' },
      { concept: 'Inecuaciones', explanation: 'Se resuelven como ecuaciones, pero el signo cambia al multiplicar o dividir por un negativo.', example: '−2x > 6 → x < −3' },
    ],
  },
  {
    id: 'm-advanced', exam: 'sat', section: 'Math', title: 'Advanced Math',
    summary: 'Cuadráticas, exponenciales, polinomios y funciones no lineales.',
    concepts: [
      { concept: 'Ecuaciones de segundo grado', explanation: 'Factoriza o usa x = (−b ± √(b² − 4ac)) / 2a. El discriminante b² − 4ac indica cuántas soluciones reales hay (>0: dos, =0: una, <0: ninguna).', example: 'x² − 5x + 6 = 0 → (x − 2)(x − 3) = 0 → x = 2 o x = 3' },
      { concept: 'Crecimiento y decrecimiento exponencial', explanation: 'f(t) = a · bᵗ: a es el valor inicial y b el factor (b > 1 crece, 0 < b < 1 decrece).', example: 'Se duplica cada 3 años desde 100: f(t) = 100 · 2^(t/3)' },
    ],
  },
  {
    id: 'm-data', exam: 'sat', section: 'Math', title: 'Problem-Solving and Data Analysis',
    summary: 'Porcentajes, proporciones, estadística y probabilidad.',
    concepts: [
      { concept: 'Porcentajes', explanation: 'Variación porcentual = (nuevo − original) / original × 100. Divide siempre entre el valor original.', example: 'De 50 a 60 USD: (60 − 50) / 50 = 20 %' },
      { concept: 'Media y mediana', explanation: 'Media = suma / número de datos. La mediana es el valor central y no le afectan los valores extremos.', tip: 'Si te dan la media y el número de datos, ya conoces la suma.' },
      { concept: 'Probabilidad y tablas', explanation: 'P = casos favorables / casos posibles. En tablas de doble entrada, "given that" significa usar solo esa fila o columna como total.' },
    ],
  },
  {
    id: 'm-geometry', exam: 'sat', section: 'Math', title: 'Geometry and Trigonometry',
    summary: 'Áreas y volúmenes, triángulos, trigonometría básica y circunferencias.',
    concepts: [
      { concept: 'Fórmulas clave', explanation: 'El examen incluye una hoja de referencia: aprende dónde está cada fórmula para no perder tiempo.', example: 'Área del círculo = πr² · Pitágoras: a² + b² = c²' },
      { concept: 'SOH-CAH-TOA', explanation: 'sen = opuesto/hipotenusa, cos = contiguo/hipotenusa, tan = opuesto/contiguo.', example: 'Triángulo 3-4-5: sen θ = 3/5 si θ es el ángulo opuesto al lado 3.' },
    ],
  },
  // ---------------------------------------------------------------- TOEFL 2026
  {
    id: 't-reading', exam: 'toefl', section: 'Reading', title: 'Reading',
    summary: 'Completar palabras, textos del día a día (avisos, emails) y un texto académico.',
    concepts: [
      { concept: 'Complete the Words', explanation: 'Completa las letras que faltan en palabras de un párrafo. Se apoya en vocabulario frecuente y en la gramática de la frase.', tip: 'Lee la frase entera: el contexto te dice si falta un plural, un verbo en pasado o un adverbio.' },
      { concept: 'Read in Daily Life', explanation: 'Avisos, emails o publicaciones del campus. Busca datos concretos (horas, fechas, condiciones) y lo que se puede deducir de ellos.' },
      { concept: 'Read an Academic Passage', explanation: 'Texto académico breve con preguntas de idea principal, detalle, vocabulario e inferencia. La inferencia correcta es la más prudente.' },
    ],
  },
  {
    id: 't-listening', exam: 'toefl', section: 'Listening', title: 'Listening',
    summary: 'Respuestas breves, conversaciones, avisos y charlas académicas.',
    concepts: [
      { concept: 'Listen and Choose a Response', explanation: 'Escuchas una frase y eliges la respuesta más natural. Atiende a la intención (pregunta, petición, queja), no solo a las palabras.', example: '"Do you know if practice moved to the afternoon?" → "Yes, it starts at four now."' },
      { concept: 'Señales en charlas académicas', explanation: 'Frases como "What\'s crucial here is…" o "Let me emphasize…" anuncian información que suele preguntarse.', tip: 'Toma notas en dos columnas: ideas principales | ejemplos y datos.' },
    ],
  },
  {
    id: 't-writing', exam: 'toefl', section: 'Writing', title: 'Writing',
    summary: 'Ordenar frases, escribir un email y participar en una discusión académica.',
    concepts: [
      { concept: 'Build a Sentence', explanation: 'Ordenas palabras para formar una respuesta correcta dentro de una conversación entre estudiantes. Fíjate en el orden de las preguntas en inglés: auxiliar + sujeto + verbo.', example: 'could / you / send / me / the schedule → "Could you send me the schedule?"' },
      { concept: 'Write an Email', explanation: 'Unos 7 minutos para un email con un propósito claro. Saludo adecuado, motivo en la primera frase, detalles concretos y cierre cortés.', example: '"Dear Professor Smith, I am writing to ask whether…"' },
      { concept: 'Academic Discussion', explanation: 'Responde al profesor y a dos compañeros: da tu postura y añade un argumento o ejemplo nuevo, no repitas lo que ya dijeron.' },
    ],
  },
  {
    id: 't-speaking', exam: 'toefl', section: 'Speaking', title: 'Speaking',
    summary: 'Repetir frases y responder a una entrevista breve sin tiempo de preparación.',
    concepts: [
      { concept: 'Listen and Repeat', explanation: 'Repites frases del entorno del campus. Cuentan la exactitud y la pronunciación clara, no la velocidad.', tip: 'Practica con frases cortas grabándote y comparando con el audio original.' },
      { concept: 'Take an Interview', explanation: 'Cuatro preguntas sobre un tema, unos 45 segundos por respuesta y sin preparación. Responde directo, da una razón y un ejemplo personal.', tip: 'Las plantillas del formato antiguo (tareas integradas) ya no sirven para este examen.' },
    ],
  },
];

export const QUESTIONS: Question[] = [
  // SAT
  { id: 's1', exam: 'sat', topicId: 'm-algebra', prompt: 'If 3x + 7 = 22, what is the value of x?', options: ['3', '5', '7', '15'], answer: 1, explanation: '3x = 22 − 7 = 15, así que x = 5.', paceSeconds: MATH_PACE },
  { id: 's2', exam: 'sat', topicId: 'rw-conventions', prompt: 'Which choice completes the text? "The list of items on the coach\'s desk ___ long."', options: ['is', 'are', 'were', 'have been'], answer: 0, explanation: 'El sujeto es "list" (singular); "of items" es una frase preposicional que no cambia la concordancia.', paceSeconds: RW_PACE },
  { id: 's3', exam: 'sat', topicId: 'rw-craft', prompt: '"The data reflect a steady rise in applications from international athletes." As used in the text, "reflect" most nearly means:', options: ['mirror', 'show', 'reconsider', 'bounce'], answer: 1, explanation: 'En contexto académico "reflect" significa mostrar o indicar.', paceSeconds: RW_PACE },
  { id: 's4', exam: 'sat', topicId: 'm-algebra', prompt: 'What is the slope of the line y = −2x + 5?', options: ['5', '2', '−2', '−5'], answer: 2, explanation: 'En y = mx + b, la pendiente es m = −2.', paceSeconds: MATH_PACE },
  { id: 's5', exam: 'sat', topicId: 'm-advanced', prompt: 'What are the solutions of x² − 5x + 6 = 0?', options: ['x = 1 and x = 6', 'x = 2 and x = 3', 'x = −2 and x = −3', 'x = −1 and x = 6'], answer: 1, explanation: '(x − 2)(x − 3) = 0, luego x = 2 o x = 3.', paceSeconds: MATH_PACE },
  { id: 's6', exam: 'sat', topicId: 'm-data', prompt: 'The mean of 5 numbers is 12. What is their sum?', options: ['17', '60', '48', '2.4'], answer: 1, explanation: 'Media = suma / 5 → suma = 12 × 5 = 60.', paceSeconds: MATH_PACE },
  { id: 's7', exam: 'sat', topicId: 'm-geometry', prompt: 'A circle has a radius of 5. What is its area?', options: ['10π', '25π', '15π', '5π'], answer: 1, explanation: 'A = πr² = π · 5² = 25π.', paceSeconds: MATH_PACE },
  { id: 's8', exam: 'sat', topicId: 'm-data', prompt: 'A bag has 3 red and 7 blue marbles. What is the probability of drawing a red one?', options: ['3/7', '3/10', '7/10', '7/3'], answer: 1, explanation: '3 casos favorables entre 10 posibles: 3/10.', paceSeconds: MATH_PACE },
  { id: 's9', exam: 'sat', topicId: 'm-advanced', prompt: 'If f(x) = 2x² − 3x + 1, what is f(2)?', options: ['3', '5', '7', '1'], answer: 0, explanation: 'f(2) = 2·4 − 3·2 + 1 = 8 − 6 + 1 = 3.', paceSeconds: MATH_PACE },
  { id: 's10', exam: 'sat', topicId: 'rw-expression', prompt: 'The team lost its first three games. ___, it finished the season with a winning record. Which choice completes the text with the most logical transition?', options: ['Therefore', 'For example', 'Nevertheless', 'Similarly'], answer: 2, explanation: 'La segunda frase contrasta con la primera: "Nevertheless" (aun así).', paceSeconds: RW_PACE },
  { id: 's11', exam: 'sat', topicId: 'rw-conventions', prompt: '"She had three goals___ win the league, improve her free throws, and earn a scholarship." Which choice completes the text?', options: [';', ':', ',', 'no punctuation'], answer: 1, explanation: 'Antes hay una oración completa y después una lista: dos puntos.', paceSeconds: RW_PACE },
  { id: 's12', exam: 'sat', topicId: 'm-data', prompt: 'A jersey\'s price rises from $50 to $60. What is the percent increase?', options: ['10%', '16.7%', '20%', '60%'], answer: 2, explanation: '(60 − 50) / 50 = 0,2 = 20 %. Se divide entre el valor original.', paceSeconds: MATH_PACE },
  { id: 's13', exam: 'sat', topicId: 'm-algebra', prompt: 'If x + y = 10 and x − y = 4, what is the value of x?', options: ['3', '6', '7', '14'], answer: 2, explanation: 'Sumando las ecuaciones: 2x = 14, x = 7.', paceSeconds: MATH_PACE },
  { id: 's14', exam: 'sat', topicId: 'm-advanced', prompt: 'A population of 100 doubles every 3 years. What is it after 9 years?', options: ['300', '600', '800', '900'], answer: 2, explanation: '9 años = 3 duplicaciones: 100 · 2³ = 800.', paceSeconds: MATH_PACE },
  // TOEFL
  { id: 't1', exam: 'toefl', topicId: 't-reading', prompt: 'Complete the word: "Many first-year students choose to live on cam___."', options: ['pus', 'ps', 'pas', 'pous'], answer: 0, explanation: '"campus".' },
  { id: 't2', exam: 'toefl', topicId: 't-reading', prompt: 'Complete the word: "The library is open un___ midnight on weekdays."', options: ['tel', 'til', 'tol', 'tal'], answer: 1, explanation: '"until".' },
  { id: 't3', exam: 'toefl', topicId: 't-writing', prompt: 'Build a sentence: you / could / send / me / the schedule', options: ['You could send me the schedule?', 'Could you send me the schedule?', 'Could send you me the schedule?', 'Send could you me the schedule?'], answer: 1, explanation: 'Pregunta en inglés: auxiliar (could) + sujeto (you) + verbo (send).' },
  { id: 't4', exam: 'toefl', topicId: 't-reading', prompt: 'Notice: "The gym will close at 6 p.m. on Friday for floor maintenance. Regular hours resume Saturday at 8 a.m." What is true at 7 p.m. on Friday?', options: ['Students can use the gym as usual.', 'The gym is closed.', 'The gym opens early.', 'Maintenance has finished.'], answer: 1, explanation: 'Cierra a las 6 p.m. del viernes y no reabre hasta el sábado a las 8 a.m.' },
  { id: 't5', exam: 'toefl', topicId: 't-reading', prompt: '"Ephemeral" most nearly means:', options: ['eternal', 'short-lived', 'powerful', 'complex'], answer: 1, explanation: 'Ephemeral = que dura muy poco.' },
  { id: 't6', exam: 'toefl', topicId: 't-listening', prompt: 'You hear: "Do you know if the coach moved practice to the afternoon?" Choose the best response.', options: ['Yes, it starts at four now.', 'I practice every day.', 'The coach is very tall.', 'I had breakfast this morning.'], answer: 0, explanation: 'Es la única respuesta que contesta a la pregunta sobre el horario.' },
  { id: 't7', exam: 'toefl', topicId: 't-reading', prompt: '"Although the new training method increased speed, injury rates also rose." What can be inferred?', options: ['The method has no drawbacks.', 'The method has a trade-off.', 'Speed decreased.', 'Injuries were unrelated to training.'], answer: 1, explanation: '"Although" marca que hay una ventaja (velocidad) y un coste (lesiones).' },
  { id: 't8', exam: 'toefl', topicId: 't-writing', prompt: 'Which is the most appropriate opening for an email to a professor?', options: ['Hey prof!!', 'Dear Professor Smith,', 'Yo Smith', 'To whoever reads this'], answer: 1, explanation: 'Registro formal: "Dear Professor + apellido".' },
  { id: 't9', exam: 'toefl', topicId: 't-writing', prompt: 'Which transition shows contrast?', options: ['Furthermore', 'However', 'Moreover', 'In addition'], answer: 1, explanation: '"However" marca contraste; las demás añaden información.' },
  { id: 't10', exam: 'toefl', topicId: 't-writing', prompt: 'In "Write for an Academic Discussion", a strong post…', options: ['repeats what both classmates said', 'states a position and adds a new reason or example', 'avoids taking any position', 'only asks the professor a question'], answer: 1, explanation: 'Se valora aportar una idea propia y bien apoyada a la discusión.' },
];

export const topicsFor = (exam: Exam) => TOPICS.filter((t) => t.exam === exam);
export const questionsFor = (exam: Exam) => QUESTIONS.filter((q) => q.exam === exam);
