-- Réplica mínima de lo que Supabase ya trae (roles, esquema auth y auth.uid()),
-- solo para ejecutar las pruebas de RLS en un Postgres local sin Docker.
-- No se aplica nunca en el proyecto Supabase real.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'
);

alter table auth.users add column if not exists email_confirmed_at timestamptz;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Réplica mínima de Supabase Storage (buckets, objetos y storage.foldername) para probar
-- las policies de Storage con la misma RLS que en producción (Prompt 10C).
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
