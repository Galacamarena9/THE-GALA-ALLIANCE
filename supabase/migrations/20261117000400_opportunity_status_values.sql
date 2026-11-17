-- Fase 03 · nuevos estados de oportunidad (en su propia migración: un valor de enum no se usa en la misma transacción).
-- closed = cerrada por la organización · filled = plaza cubierta. Reversión: no se borran valores; basta con no usarlos.
alter type public.opportunity_status add value if not exists 'closed';
alter type public.opportunity_status add value if not exists 'filled';
