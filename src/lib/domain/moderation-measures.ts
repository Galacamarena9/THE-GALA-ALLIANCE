/** Medidas que se pueden aplicar desde la cola de denuncias (las restricciones con ámbito se hacen en Trust & Safety). */
export const REPORT_MEASURES = ['warning', 'content_removed', 'opportunity_paused', 'suspended', 'verification_revoked', 'escalate'] as const;
export type ReportMeasure = (typeof REPORT_MEASURES)[number];
export const REPORT_MEASURE_LABEL: Record<ReportMeasure, string> = {
  warning: 'Aviso',
  content_removed: 'Retirar contenido',
  opportunity_paused: 'Pausar oportunidad',
  suspended: 'Suspender',
  verification_revoked: 'Retirar verificación',
  escalate: 'Escalar a Trust & Safety',
};
