-- 11A · Trials & Academy Programs · A0: valores nuevos de enums existentes (separados: no pueden usarse en la misma transacción).
-- Taxonomía de tipos (se reutiliza el enum; no hay strings libres):
--   PLAYER_RECRUITMENT = club_recruitment · TRIAL = tryout · CAMP / SHOWCASE = camp_showcase (el subtipo vive en trial_details.trial_type)
--   ACADEMY_PROGRAM = academy · DEVELOPMENT_PROGRAM = development_program (nuevo) · universidades: athletic_scholarship, university_recruitment
-- Reversión: los valores de enum no se eliminan; basta con no usarlos.
alter type public.opportunity_type add value if not exists 'development_program';
-- Ciclo de vida: draft → pending_review (READY_FOR_REVIEW) → published → paused / closed / expired / filled → archived.
alter type public.opportunity_status add value if not exists 'paused';
alter type public.opportunity_status add value if not exists 'archived';
-- Candidaturas: applied = SUBMITTED · information_requested = ADDITIONAL_INFORMATION_REQUIRED · + waitlisted · expired.
alter type public.application_status add value if not exists 'waitlisted';
alter type public.application_status add value if not exists 'expired';
