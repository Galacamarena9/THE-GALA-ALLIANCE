/**
 * Plantillas legales. ESTADO: BORRADOR — REVISIÓN JURÍDICA OBLIGATORIA antes de abrir el registro.
 * Deben revisarlas profesionales en España/UE (RGPD, LOPDGDD, LSSI-CE, DSA, consumo) y EE. UU. (COPPA, FERPA, NIL, inmigración).
 * Los campos entre [corchetes] los completa la titular.
 */
export interface LegalDoc {
  slug: string;
  title: string;
  sections: { heading: string; body: string[] }[];
}

const TITULAR = '[Nombre completo o razón social] · NIF/CIF [pendiente] · Avinguda de la Valldigna 3, 46760 Tavernes de la Valldigna (Valencia), España · Contacto: [email de privacidad]';

export const LEGAL: LegalDoc[] = [
  {
    slug: 'aviso-legal',
    title: 'Aviso legal',
    sections: [
      { heading: 'Titular del sitio (art. 10 LSSI-CE)', body: [TITULAR, 'Inscripción registral: [si procede].'] },
      { heading: 'Objeto', body: ['The Gala Alliance es una plataforma que conecta a deportistas, familias, universidades, coaches, agentes y marcas para facilitar el acceso a oportunidades académico-deportivas, principalmente en Estados Unidos. No es una agencia de representación ni garantiza admisión, becas o resultados.'] },
      { heading: 'Enlaces externos', body: ['Enlazamos a webs oficiales (universidades, NCAA, NAIA, organismos públicos). No controlamos su contenido; cada enlace muestra su dominio antes de salir de la plataforma.'] },
    ],
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    sections: [
      { heading: 'Responsable', body: [TITULAR, 'Delegado de Protección de Datos: [designar si procede tras la EIPD].'] },
      {
        heading: 'Qué datos tratamos y para qué',
        body: [
          'Cuenta: nombre, email y fecha de nacimiento (para aplicar las protecciones de menores y la edad mínima de 13 años).',
          'Opportunity Passport: datos deportivos, académicos, idiomas, vídeo y enlaces que tú decides incluir, con visibilidad configurable por bloque.',
          'Actividad: candidaturas, mensajes con organizaciones verificadas y solicitudes de derechos.',
          'Presupuesto familiar: solo lo ven el atleta y su familia vinculada.',
        ],
      },
      {
        heading: 'Base jurídica de cada tratamiento',
        body: [
          'Cuenta, Passport, candidaturas y mensajes: ejecución del contrato (art. 6.1.b RGPD).',
          'Perfil visible, novedades, publicaciones con tu nombre, cookies no esenciales y comunicaciones comerciales: consentimiento (art. 6.1.a), retirable en cualquier momento.',
          'Seguridad, prevención del fraude, moderación y métricas agregadas del servicio: interés legítimo (art. 6.1.f).',
          'Atención de derechos, registros de consentimiento y obligaciones del DSA: obligación legal (art. 6.1.c).',
          'Solicitudes de planes y servicios: medidas precontractuales a petición tuya (art. 6.1.b).',
        ],
      },
      {
        heading: 'Bases jurídicas',
        body: [
          'Ejecución del contrato (prestar el servicio que solicitas), consentimiento (perfil visible, publicaciones con tu nombre, cookies no esenciales), interés legítimo (seguridad, prevención de fraude y moderación) y obligación legal (atención de derechos, DSA).',
          'Menores en España: desde los 14 años pueden consentir por sí mismos cuando la base es el consentimiento; por debajo, se requiere el de quien ejerza la patria potestad o tutela (art. 7 LOPDGDD). No admitimos cuentas de menores de 13 años.',
        ],
      },
      { heading: 'Con quién compartimos', body: ['Con las organizaciones verificadas que tú eliges (al aplicar, aceptar un contacto o autorizar a una agencia) y con proveedores encargados del tratamiento.'] },
      {
        heading: 'Encargados del tratamiento',
        body: [
          'Supabase (base de datos, autenticación y almacenamiento) · Netlify (alojamiento web) · Anthropic (asistente Gala IA; no usamos tus conversaciones para entrenar modelos).',
          'Stripe (pagos de Core y Elite: Stripe trata los datos de la tarjeta; nosotros nunca los vemos). Cuando se active: Resend (emails transaccionales).',
          'Contratos de encargo (DPA) y garantías para transferencias internacionales: [completar con cada proveedor antes del lanzamiento].',
        ],
      },
      { heading: 'Conservación', body: [
        'Mientras tu cuenta esté activa. Puedes borrarla tú mismo desde Privacidad y datos en cualquier momento.',
        'Borrado automático diario: eventos de uso a los 13 meses; notificaciones leídas a los 6 meses y cualquier notificación a los 12; novedades del atleta 30 días después de caducar; registros de uso de Gala IA a los 90 días; invitaciones caducadas a los 90 días; comentarios de mejora a los 24 meses.',
        'Documentos subidos: hasta que los borres o borres tu cuenta. Registros de consentimiento y auditoría: se conservan desvinculados de tu identidad durante el plazo de prescripción de responsabilidades [plazo a validar por el asesor].',
      ] },
      { heading: 'Tus derechos', body: ['Acceso, rectificación, supresión, oposición, limitación y portabilidad desde Privacidad y datos (descarga en JSON y solicitudes con seguimiento). Respondemos en un mes. Puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).'] },
      { heading: 'Registros educativos (EE. UU.)', body: ['Cuando una institución educativa estadounidense nos encargue tratar registros educativos de sus estudiantes, lo haremos únicamente bajo contrato y conforme a FERPA, como proveedor de servicios bajo el control directo de la institución. [Revisión jurídica en EE. UU. pendiente].'] },
    ],
  },
  {
    slug: 'terminos',
    title: 'Términos y condiciones',
    sections: [
      { heading: 'Qué ofrecemos', body: ['Herramientas para crear un perfil deportivo-académico, descubrir oportunidades revisadas, comunicarse de forma segura y entender el proceso. No garantizamos admisión, beca, elegibilidad ni contratos.'] },
      { heading: 'Cuentas', body: ['Edad mínima: 13 años. Familias, universidades, coaches, agentes y marcas deben ser mayores de edad. Las organizaciones se verifican antes de publicar o contactar.'] },
      { heading: 'Contenido y conducta', body: ['Eres responsable de la veracidad de tus datos. Está prohibido publicar información falsa, suplantar organizaciones, pedir datos de contacto a menores fuera de la plataforma o hacer ofertas que condicionen resultados deportivos a pagos.'] },
      { heading: 'Moderación y recursos (DSA)', body: ['Puedes denunciar cualquier contenido. Revisamos cada denuncia, priorizando la seguridad infantil, y comunicamos decisiones motivadas. Puedes recurrir una decisión escribiendo a [email].'] },
      {
        heading: 'Planes y servicios de pago',
        body: [
          'Para atletas, el perfil, el escaparate, las candidaturas y recibir contacto son gratuitos. Ningún plan compra visibilidad ni prioridad en búsquedas, ni garantiza admisión, beca o contrato.',
          'Los servicios para familias (Core y Elite) son de pago único; los planes para organizaciones se detallan en /precios. Solicitar un plan no genera ningún cargo: el precio y el alcance se confirman por escrito antes de pagar.',
          'Consumidores: derecho de desistimiento de 14 días naturales cuando corresponda; si pides que el servicio empiece antes, se descontará la parte ya prestada. [Completar con el formulario de desistimiento y la política de reembolsos antes de activar cobros].',
        ],
      },
      { heading: 'Resolución de conflictos', body: ['Escríbenos primero a [email]. Como consumidor, puedes acudir a los tribunales de tu domicilio y a los organismos de consumo de tu comunidad autónoma. [Indicar si nos adherimos a una entidad de resolución alternativa de litigios]. La plataforma europea ODR cerró el 20 de julio de 2025, por eso no se enlaza.'] },
    ],
  },
  {
    slug: 'cookies',
    title: 'Política de cookies',
    sections: [
      { heading: 'Esenciales', body: ['Sesión de usuario (Supabase), seguridad y tu preferencia de cookies. No requieren consentimiento.'] },
      { heading: 'Opcionales', body: ['Funcionales (recordar filtros), analítica agregada y de terceros (vídeos incrustados). Solo se activan si las aceptas; rechazarlas es igual de fácil que aceptarlas y puedes cambiarlo en Privacidad y datos.'] },
      { heading: 'Registro', body: ['Guardamos prueba de tu elección (fecha, categorías y un identificador anónimo; la IP solo como hash) para poder acreditarla.'] },
    ],
  },
  {
    slug: 'proteccion-menores',
    title: 'Protección de menores',
    sections: [
      { heading: 'Por defecto, máxima protección', body: ['Los perfiles de menores no son visibles para anónimos, marcas ni agentes, ni se indexan en buscadores. Solo los ven universidades y clubes verificados y la familia vinculada.'] },
      { heading: 'Contacto', body: ['Solo organizaciones verificadas pueden pedir contacto. Con un menor, la familia vinculada aprueba la solicitud, ve la conversación y no se permite compartir emails, teléfonos ni redes sociales.'] },
      { heading: 'Sin patrones adictivos ni publicidad perfilada', body: ['No usamos rankings públicos de menores, rachas ni notificaciones agresivas, ni mostramos publicidad basada en perfiles a menores.'] },
      { heading: 'Si algo va mal', body: ['Usa "Denunciar" en cualquier perfil, oferta o conversación: las denuncias de seguridad infantil tienen prioridad máxima. Si hay riesgo inmediato, llama al 112.'] },
    ],
  },
  {
    slug: 'normas',
    title: 'Normas de la comunidad',
    sections: [
      { heading: 'Lo que esperamos', body: ['Respeto, veracidad y transparencia. Los datos deportivos y económicos deben indicar su origen; las ofertas deben detallar condiciones reales.'] },
      { heading: 'Lo que no permitimos', body: ['Acoso, discriminación, suplantación, spam, promesas de becas garantizadas, cobros por "prioridad" encubierta y cualquier intento de sacar a un menor de la plataforma.'] },
    ],
  },
];

export const legalDoc = (slug: string) => LEGAL.find((d) => d.slug === slug);
