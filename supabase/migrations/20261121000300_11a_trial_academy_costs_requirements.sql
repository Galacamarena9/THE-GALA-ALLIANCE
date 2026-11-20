-- 11A · C: especialización por tipo (trial_details, academy_program_details), costes, requisitos y materiales.
-- Dónde vive cada dato (sin duplicar):
--   opportunities: fechas reales (start_at/end_at timestamptz + timezone IANA), plazo de candidatura (deadline),
--                  ubicación estructurada, categoría de edad, programa/equipo/temporada.
--   trial_details: solo lo propio de un trial (tipo, modo de inscripción, plazo de inscripción si difiere, capacidad
--                  CONFIRMADA o desconocida, estado de precio, reembolso, logística, menores).
--   academy_program_details: lo propio de un programa (calendario, nivel, residencia, apoyo educativo, ayudas declaradas).
--   opportunity_cost_components: TODOS los importes (inscripción, cuota del programa, alojamiento, comidas…).
--   opportunity_requirements: requisitos estructurados (REQUIRED / PREFERRED / INFORMATIONAL) para Gala Match.
--   opportunity_required_materials: qué hay que aportar, quién, con qué sensibilidad.
-- Reversión: recrear opportunity_event_details desde trial_details + costes (ver 20261120000300) y borrar las tablas nuevas.

-- 1. Detalles de trial (sustituye a opportunity_event_details, creada en 11 y vacía en producción) -----------------
create table public.trial_details (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  trial_type text not null default 'open_trial' check (trial_type in ('open_trial', 'invitation_only', 'id_camp', 'showcase', 'camp', 'assessment')),
  -- direct: inscripción directa · application_required: primero candidatura aceptada · invitation_only: solo por invitación del club
  registration_mode text not null default 'direct' check (registration_mode in ('direct', 'application_required', 'invitation_only')),
  registration_deadline timestamptz,
  registration_status text not null default 'open' check (registration_status in ('open', 'closed', 'waitlist_only')),
  -- Capacidad CONFIRMADA por la organización. null = desconocida (nunca «plazas ilimitadas»). Las plazas libres se calculan.
  capacity int check (capacity between 1 and 10000),
  min_participants int check (min_participants between 1 and 10000),
  -- free ≠ paid ≠ price_not_provided: 0 o null nunca significan «gratis» por accidente.
  price_status text not null default 'price_not_provided' check (price_status in ('free', 'paid', 'price_not_provided')),
  refundable text not null default 'unknown' check (refundable in ('yes', 'no', 'partial', 'unknown')),
  refund_deadline date,
  refund_percentage smallint check (refund_percentage between 0 and 100),
  refund_policy text check (char_length(refund_policy) <= 500),
  accommodation text not null default 'unknown' check (accommodation in ('included', 'available_paid', 'not_included', 'unknown')),
  meals text not null default 'unknown' check (meals in ('included', 'not_included', 'unknown')),
  travel text not null default 'unknown' check (travel in ('included', 'not_included', 'unknown')),
  equipment_requirements text check (char_length(equipment_requirements) <= 300),
  minor_policy text not null default 'guardian_consent_required' check (minor_policy in ('guardian_consent_required', 'adults_only')),
  video_requirements text check (char_length(video_requirements) <= 500),
  additional_conditions text check (char_length(additional_conditions) <= 1000),
  updated_at timestamptz not null default now(),
  constraint trial_min_le_capacity check (min_participants is null or capacity is null or min_participants <= capacity)
);
create index trial_details_deadline_idx on public.trial_details (registration_deadline);

-- 2. Detalles de programa de academia ------------------------------------------------------------------------------
create table public.academy_program_details (
  opportunity_id uuid primary key references public.opportunities (id) on delete cascade,
  program_kind text not null default 'academy' check (program_kind in ('academy', 'full_time_academy', 'residential_program', 'day_program', 'development_program', 'seasonal_program')),
  -- La duración se calcula de start_at/end_at; aquí solo el tipo de calendario.
  calendar_type text not null default 'fixed_term' check (calendar_type in ('fixed_term', 'rolling', 'seasonal', 'one_off')),
  competition_level text check (char_length(competition_level) <= 80),
  training_sessions_per_week smallint check (training_sessions_per_week between 0 and 21),
  competition_exposure text check (char_length(competition_exposure) <= 300),
  residential text not null default 'unknown' check (residential in ('residential', 'non_residential', 'both', 'unknown')),
  accommodation text not null default 'unknown' check (accommodation in ('included', 'available_paid', 'not_included', 'unknown')),
  meals text not null default 'unknown' check (meals in ('included', 'not_included', 'unknown')),
  education_support text not null default 'unknown' check (education_support in ('yes', 'no', 'unknown')),
  language_support text[] not null default '{}' check (cardinality(language_support) <= 10),
  capacity int check (capacity between 1 and 10000),
  price_status text not null default 'price_not_provided' check (price_status in ('free', 'paid', 'price_not_provided')),
  -- La academia DECLARA si puede haber ayuda. Una ayuda concedida a un atleta es otra cosa (enrollment / oferta).
  financial_aid text not null default 'unknown' check (financial_aid in ('available', 'not_available', 'unknown')),
  minor_policy text not null default 'guardian_consent_required' check (minor_policy in ('guardian_consent_required', 'adults_only')),
  requirements_note text check (char_length(requirements_note) <= 1000),
  updated_at timestamptz not null default now()
);

-- Cada especialización solo para su tipo de oportunidad.
create or replace function public.guard_opportunity_specialization()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text := (select type::text from public.opportunities where id = new.opportunity_id);
begin
  if tg_table_name = 'trial_details' and v_type not in ('tryout', 'camp_showcase', 'club_recruitment') then
    raise exception 'not_a_trial' using errcode = 'P0001';
  end if;
  if tg_table_name = 'academy_program_details' and v_type not in ('academy', 'development_program') then
    raise exception 'not_an_academy_program' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_trial_details before insert or update on public.trial_details for each row execute function public.guard_opportunity_specialization();
create trigger guard_academy_details before insert or update on public.academy_program_details for each row execute function public.guard_opportunity_specialization();

-- 3. Componentes de coste ------------------------------------------------------------------------------------------
create table public.opportunity_cost_components (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  component_type text not null check (component_type in ('registration', 'program_fee', 'accommodation', 'meals', 'equipment', 'insurance', 'transport', 'other')),
  label text not null check (char_length(btrim(label)) between 2 and 80),
  amount numeric(10, 2) check (amount >= 0 and amount <= 1000000),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  required boolean not null default true,
  -- Incluido en otra cuota: se muestra como «Incluido», sin importe propio.
  included boolean not null default false,
  period text not null default 'one_off' check (period in ('one_off', 'per_month', 'per_term', 'per_season', 'per_year')),
  source text not null default 'organization' check (source in ('organization', 'gala_review')),
  sort smallint not null default 100,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint cost_amount_has_currency check (amount is null or currency is not null),
  constraint cost_included_has_no_amount check (not included or amount is null)
);
create index cost_components_opp_idx on public.opportunity_cost_components (opportunity_id, sort);

-- 4. Requisitos estructurados (alimentan Gala Match; nada escondido en la descripción) -----------------------------
create table public.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  kind text not null check (kind in ('age', 'birth_year', 'position', 'sport', 'gender_category', 'competition_level', 'height', 'video', 'document', 'location', 'language', 'academic', 'other')),
  strength text not null check (strength in ('required', 'preferred', 'informational')),
  params jsonb not null default '{}' check (jsonb_typeof(params) = 'object' and pg_column_size(params) <= 2000 and case kind
    when 'age' then (params ? 'min' or params ? 'max')
    when 'birth_year' then (params ? 'min' or params ? 'max')
    when 'position' then jsonb_typeof(params -> 'position_ids') = 'array'
    when 'height' then params ? 'min_cm'
    when 'location' then jsonb_typeof(params -> 'countries') = 'array'
    when 'language' then jsonb_typeof(params -> 'languages') = 'array'
    else true end),
  label text check (char_length(label) <= 160),
  sort smallint not null default 100,
  created_at timestamptz not null default now()
);
create index opportunity_requirements_idx on public.opportunity_requirements (opportunity_id, strength);

-- 5. Materiales requeridos ------------------------------------------------------------------------------------------
create table public.opportunity_required_materials (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  material text not null check (material in ('passport', 'highlight_video', 'full_game_video', 'transcript', 'english_certificate', 'test_scores',
                                              'application_form', 'proof_of_age', 'guardian_consent', 'medical_clearance', 'custom_document')),
  label text check (char_length(label) <= 120),
  required boolean not null default true,
  -- organization: la organización lo ve al recibirlo · after_acceptance: solo tras aceptar la candidatura.
  visibility text not null default 'organization' check (visibility in ('organization', 'after_acceptance')),
  provided_by text not null default 'athlete' check (provided_by in ('athlete', 'guardian', 'either')),
  requires_guardian_consent boolean not null default false,
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'confidential', 'highly_restricted')),
  valid_days smallint check (valid_days between 1 and 3650),
  created_at timestamptz not null default now(),
  -- Documentos de tipo médico: siempre máxima restricción, nunca en Discovery.
  constraint medical_is_highly_restricted check (material <> 'medical_clearance' or sensitivity = 'highly_restricted'),
  constraint custom_has_label check (material <> 'custom_document' or label is not null)
);
create unique index required_materials_unique on public.opportunity_required_materials (opportunity_id, material) where material <> 'custom_document';

-- 6. Migración de datos (sin perder nada): opportunity_event_details → opportunities + trial_details/academy + costes + requisitos.
update public.opportunities o
   set start_at = case when d.event_start_date is not null then (d.event_start_date + coalesce(d.start_time_local, time '00:00')) at time zone coalesce(d.timezone, 'UTC') end,
       end_at = case when d.event_end_date is not null then (d.event_end_date + time '23:59') at time zone coalesce(d.timezone, 'UTC') end,
       timezone = d.timezone, country = d.country, region = d.region, city = d.city, venue_name = d.venue,
       age_category_code = (select c.code from public.age_categories c where c.code = upper(replace(btrim(d.age_category), ' ', '_'))),
       age_category_custom = case when d.age_category is not null and not exists (select 1 from public.age_categories c where c.code = upper(replace(btrim(d.age_category), ' ', '_'))) then d.age_category end
  from public.opportunity_event_details d where d.opportunity_id = o.id;

insert into public.trial_details (opportunity_id, trial_type, capacity, price_status, refundable, refund_policy, accommodation, meals, travel, minor_policy, video_requirements, additional_conditions)
select d.opportunity_id, case o.type when 'camp_showcase' then 'camp' when 'club_recruitment' then 'assessment' else 'open_trial' end,
       d.capacity, case d.fee_type when 'unknown' then 'price_not_provided' else d.fee_type end, d.refundable, d.refund_details,
       d.accommodation, d.meals, d.travel, d.minor_policy, d.video_requirements, d.program_schedule
  from public.opportunity_event_details d join public.opportunities o on o.id = d.opportunity_id
 where o.type in ('tryout', 'camp_showcase', 'club_recruitment');

insert into public.academy_program_details (opportunity_id, capacity, price_status, accommodation, meals, education_support, minor_policy, requirements_note)
select d.opportunity_id, d.capacity, case d.fee_type when 'unknown' then 'price_not_provided' else d.fee_type end, d.accommodation, d.meals,
       d.education_support, d.minor_policy, d.program_schedule
  from public.opportunity_event_details d join public.opportunities o on o.id = d.opportunity_id
 where o.type = 'academy';

insert into public.opportunity_cost_components (opportunity_id, component_type, label, amount, currency, required, sort)
select d.opportunity_id, case when o.type = 'academy' then 'program_fee' else 'registration' end,
       case when o.type = 'academy' then 'Cuota del programa' else 'Inscripción' end, d.fee_amount, d.currency, true, 10
  from public.opportunity_event_details d join public.opportunities o on o.id = d.opportunity_id
 where d.fee_type = 'paid' and d.fee_amount is not null;
insert into public.opportunity_cost_components (opportunity_id, component_type, label, included, required, sort)
select d.opportunity_id, 'other', left(i, 80), true, true, 20
  from public.opportunity_event_details d cross join unnest(d.fee_includes) i where char_length(btrim(i)) >= 2;
insert into public.opportunity_cost_components (opportunity_id, component_type, label, amount, currency, required, sort)
select d.opportunity_id, 'other', left(coalesce(x ->> 'label', 'Coste adicional'), 80), (x ->> 'amount')::numeric, nullif(x ->> 'currency', ''),
       coalesce((x ->> 'required')::boolean, true), 30
  from public.opportunity_event_details d cross join jsonb_array_elements(d.extra_costs) x
 where (x ->> 'amount') is null or nullif(x ->> 'currency', '') is not null;

insert into public.opportunity_requirements (opportunity_id, kind, strength, params, label)
select d.opportunity_id, 'age', 'required', jsonb_strip_nulls(jsonb_build_object('min', d.age_min, 'max', d.age_max)), 'Edad'
  from public.opportunity_event_details d where d.age_min is not null or d.age_max is not null;

-- Materiales: la lista existente pasa a filas (la columna array queda como legado para universidades; ver DATA_ARCHITECTURE).
insert into public.opportunity_required_materials (opportunity_id, material, required)
select o.id, m, true from public.opportunities o cross join unnest(o.required_materials) m
 where m in ('passport', 'highlight_video', 'full_game_video', 'transcript', 'english_certificate', 'test_scores', 'application_form')
on conflict do nothing;

drop table public.opportunity_event_details;

-- 7. RLS: lo publicado lo ve quien ve la oportunidad (también anónimos); escribe la organización con permiso.
do $$
declare t text;
begin
  foreach t in array array['trial_details', 'academy_program_details', 'opportunity_cost_components', 'opportunity_requirements', 'opportunity_required_materials'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (exists (select 1 from public.opportunities o where o.id = opportunity_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, ''opportunities'', o.program_id)))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, ''opportunities'', o.program_id))) with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, ''opportunities'', o.program_id)))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.org_can(o.organization_id, ''opportunities'', o.program_id)))', t || '_delete', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
