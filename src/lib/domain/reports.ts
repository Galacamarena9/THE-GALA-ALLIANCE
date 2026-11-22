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

/** Motivos para denunciar una oportunidad, un trial o un programa (Prompt 11 §53). */
export const OPPORTUNITY_REPORT_REASONS: readonly (readonly [string, string])[] = [
  ['fake_or_misleading', 'Información engañosa'],
  ['impersonation', 'Organización falsa o suplantada'],
  ['payment_request', 'Petición de pago sospechosa'],
  ['false_guarantee', 'Garantía falsa (plaza, beca o contrato «asegurados»)'],
  ['incorrect_cost', 'Coste incorrecto u oculto'],
  ['harassment', 'Contacto inapropiado'],
  ['privacy', 'Problema de privacidad'],
  ['child_safety', 'Seguridad de un menor'],
  ['other', 'Otro'],
] as const;
