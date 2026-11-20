-- CAMBIOS DE ENCAJE (Fase 04 · punto 7 y Fase 05 · punto 29). Solo aditiva.
-- Foto mínima del resultado de Gala Match al guardar (versión, porcentaje, confianza y estado de cada factor),
-- para explicar después «82 % → 89 % porque añadiste tu certificado de inglés».
-- No guarda datos personales: solo estados de factores y etiquetas genéricas. El porcentaje sigue en match_score_at_save.
-- Reversión: alter table public.saved_items drop column match_snapshot;

alter table public.saved_items
  add column match_snapshot jsonb
    check (match_snapshot is null or (jsonb_typeof(match_snapshot) = 'object' and pg_column_size(match_snapshot) <= 8000));

comment on column public.saved_items.match_snapshot is
  'Foto de Gala Match al guardar: {v: versión, s: porcentaje, c: confianza, f: {factor: [estado, etiqueta, lado que falta]}}';
