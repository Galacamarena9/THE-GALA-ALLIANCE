-- Mensajes en tiempo real: Supabase Realtime emite las inserciones de contact_messages.
-- Realtime aplica la RLS de SELECT de la tabla, así que cada persona solo recibe los mensajes que ya podía leer.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contact_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.contact_messages';
  end if;
end $$;
