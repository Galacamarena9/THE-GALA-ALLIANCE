/** Motivos para denunciar a un agente o a una agencia (Prompt 12 §60). */
export const AGENT_REPORT_REASONS: readonly (readonly [string, string])[] = [
  ['unauthorized_representation', 'Representación no autorizada'],
  ['impersonation', 'Suplantación de identidad'],
  ['misleading_fees', 'Honorarios engañosos'],
  ['payment_request', 'Petición de pago sospechosa'],
  ['harassment', 'Contacto inapropiado'],
  ['privacy', 'Problema de privacidad'],
  ['unauthorized_document_use', 'Uso no autorizado de documentos'],
  ['other', 'Otro'],
] as const;
