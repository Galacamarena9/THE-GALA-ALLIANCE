-- Prompt 11 (revisión 22-11) · confianza en oportunidades de clubs y academias. Expand, sin cambios de datos.
--   A) §64 Atletas internacionales: además de sí / no / sin indicar, «con condiciones», con el texto de las
--      condiciones conocidas. Si es «con condiciones», hay que explicarlas (no se asume visado, viaje ni alojamiento).
--   B) §53 Denunciar una oportunidad: motivos propios «garantía falsa» y «coste incorrecto» (los demás ya existen:
--      falso o engañoso, organización falsa → suplantación, pago sospechoso, contacto inapropiado, privacidad).
--      Una garantía falsa entra con prioridad alta, como el pago sospechoso.
-- Riesgo: bajo.

-- A ------------------------------------------------------------------------------------------------
alter table public.opportunities drop constraint if exists opportunities_international_eligible_check;
alter table public.opportunities add constraint opportunities_international_eligible_check
  check (international_eligible in ('yes', 'no', 'conditional', 'unknown'));
alter table public.opportunities add column if not exists international_conditions text
  check (international_conditions is null or char_length(btrim(international_conditions)) between 10 and 1000);
alter table public.opportunities add constraint international_conditions_when_conditional
  check (international_eligible <> 'conditional' or international_conditions is not null) not valid;
alter table public.opportunities validate constraint international_conditions_when_conditional;

-- B ------------------------------------------------------------------------------------------------
alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports add constraint content_reports_reason_check
  check (reason in ('child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other',
                    'impersonation', 'unauthorized_representation', 'misleading_fees', 'payment_request', 'unauthorized_document_use',
                    'false_guarantee', 'incorrect_cost'));

create or replace function public.content_report_agent_priority()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.reason in ('unauthorized_representation', 'payment_request', 'impersonation', 'false_guarantee') and new.priority > 1 then
    new.priority := 1;
  end if;
  return new;
end;
$$;

-- ROLLBACK
-- (reclasificar antes a 'fake_or_misleading' las denuncias false_guarantee / incorrect_cost)
-- alter table public.content_reports drop constraint content_reports_reason_check;  -- y recrearla con la lista de 20261209000400
-- create or replace function public.content_report_agent_priority() ... (versión de 20261209000400)
-- update public.opportunities set international_eligible = 'unknown' where international_eligible = 'conditional';
-- alter table public.opportunities drop constraint international_conditions_when_conditional;
-- alter table public.opportunities drop column international_conditions;
-- alter table public.opportunities drop constraint opportunities_international_eligible_check;
-- alter table public.opportunities add constraint opportunities_international_eligible_check
--   check (international_eligible in ('yes', 'no', 'unknown'));
