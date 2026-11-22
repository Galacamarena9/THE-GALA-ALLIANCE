-- Prompt 10B §26 (revisión 22-11) · transición a la mayoría de edad: abrir la revisión de forma activa.
-- Hasta ahora la revisión existía, pero era pasiva: al vencer la ventana el acceso del tutor se suspendía
-- (family_link_lapsed), y ni el atleta ni la familia recibían aviso ni quedaba un evento de auditoría
-- cuando la revisión se abría.
-- Ahora una tarea diaria idempotente (pg_cron si está disponible; también se puede llamar a mano como admin):
--   · avisa al atleta que acaba de cumplir 18 años: quién de su familia tiene acceso, hasta cuándo puede
--     confirmarlo y cuántos documentos suyos siguen compartidos con organizaciones (para que los revise);
--   · avisa a cada tutor de que su acceso necesita la confirmación del atleta;
--   · registra `family_link.majority_review_opened` en audit_logs, que sirve también de marca de
--     idempotencia (no se repite para el mismo vínculo).
-- No cambia permisos: la suspensión al vencer la ventana sigue siendo la de family_link_lapsed.
-- Riesgo: bajo. Sin cambios de schema ni de datos existentes.

create or replace function public.family_open_majority_reviews()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n int := 0;
  v_grants int;
  v_due date;
begin
  for r in
    select l.id, l.athlete_id, l.parent_id
      from public.parent_athlete_links l
      join public.private_profile_data d on d.user_id = l.athlete_id
     where l.status = 'approved'
       and l.guardian_consent_given                     -- el vínculo se creó siendo menor
       and d.date_of_birth + interval '18 years' <= current_date
       and (l.last_reviewed_at is null or l.last_reviewed_at < (d.date_of_birth + interval '18 years'))
       and not exists (select 1 from public.audit_logs a
                        where a.action = 'family_link.majority_review_opened' and a.entity_id = l.id)
  loop
    v_due := public.family_review_due_at(r.athlete_id)::date;
    select count(*) into v_grants from public.document_access_grants g
     where g.athlete_id = r.athlete_id and g.revoked_at is null and g.expires_at > now();

    perform public.notify(r.athlete_id, 'family.review', 'Ya eres mayor de edad: revisa el acceso de tu familia',
      'Confirma o retira el acceso de tu familia antes del ' || to_char(v_due, 'DD/MM/YYYY')
        || '. Si no respondes, se pausará hasta que lo confirmes.'
        || case when v_grants > 0 then ' Tienes ' || v_grants || ' documento(s) compartido(s) con organizaciones: revísalos también.' else '' end,
      '/app/settings');
    perform public.notify(r.parent_id, 'family.review', 'El acceso familiar necesita confirmación',
      'Tu familiar ya es mayor de edad. Tu acceso seguirá hasta el ' || to_char(v_due, 'DD/MM/YYYY')
        || ' y después solo si lo confirma.',
      '/app/family');

    insert into public.audit_logs (actor_id, action, entity, entity_id, classification, details)
    values (null, 'family_link.majority_review_opened', 'parent_athlete_links', r.id, 'sensitive',
            jsonb_build_object('due', v_due, 'active_document_grants', v_grants));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.family_open_majority_reviews() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gala-family-majority-review', '41 5 * * *', 'select public.family_open_majority_reviews()');
  end if;
end $$;

-- ROLLBACK
-- do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then
--   perform cron.unschedule('gala-family-majority-review'); end if; end $$;
-- drop function if exists public.family_open_majority_reviews();
