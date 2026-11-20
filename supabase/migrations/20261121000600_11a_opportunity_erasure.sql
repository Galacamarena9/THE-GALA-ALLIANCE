-- 11A · Las oportunidades nunca bloquean el borrado de una cuenta.
-- guard_opportunity_status restauraba created_by := old.created_by para no-admins, lo que revertía el
-- «on delete set null» del FK al borrar al autor (opportunities_created_by_fkey). Ahora, si la única
-- diferencia es anular columnas de autoría, la fila pasa sin más (mismo patrón que only_nulled en 7C).
-- Lo mismo para guard_org_verification (restauraba created_by/verified_by y bloqueaba borrar al creador de una organización).
-- Reversión: volver a ejecutar las definiciones de 20261117000500_universities_v2.sql y 20261113000800_autonomous_operations.sql.

create or replace function public.guard_opportunity_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Borrado de cuenta (RGPD): los FK «on delete set null» solo anulan autores/revisores; no se revierten.
  if tg_op = 'UPDATE' and public.only_nulled(to_jsonb(old), to_jsonb(new), '{created_by,reviewed_by,updated_by,moderated_by,program_id,team_id}', tg_relid) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending_review') and not public.is_admin() then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
    if not public.is_admin() then
      new.review_note := null;
      new.reviewed_by := null;
      new.published_at := null;
    end if;
    return new;
  end if;

  if not public.is_admin() then
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.published_at := old.published_at;
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
  end if;

  if new.status is distinct from old.status and not public.is_admin() then
    if not ((new.status in ('draft', 'pending_review') and old.status in ('draft', 'pending_review', 'rejected', 'published'))
            or (new.status in ('closed', 'filled') and old.status = 'published')) then
      raise exception 'opportunity_status_admin_only' using errcode = '42501';
    end if;
  end if;

  if old.status = 'published' and new.status = 'published' and not public.is_admin()
     and (new.title, new.description, new.annual_cost_usd, new.aid_amount_usd, new.aid_kind, new.deadline)
         is distinct from (old.title, old.description, old.annual_cost_usd, old.aid_amount_usd, old.aid_kind, old.deadline) then
    new.status := 'pending_review';
    new.published_at := null;
  end if;

  if new.status = 'published' and old.status <> 'published' then
    if not exists (select 1 from public.organizations where id = new.organization_id and verification_status = 'verified') then
      raise exception 'organization_not_verified' using errcode = 'P0001';
    end if;
    new.published_at := now();
    new.reviewed_by := auth.uid();
  end if;
  if new.status = 'published' then
    new.last_confirmed_at := coalesce(new.last_confirmed_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.guard_org_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Borrado de cuenta (RGPD): anular autor/verificador no es «editar la organización».
  if public.only_nulled(to_jsonb(old), to_jsonb(new), '{created_by,verified_by}', tg_relid) then return new; end if;
  -- Paso automático controlado por auto_verify_organization() en esta misma transacción.
  if current_setting('gala.auto_verify', true) = 'on' then
    if new.verification_status = 'verified' and old.verification_status <> 'verified' then
      new.verified_at := now();
      new.verified_by := null;
    end if;
    return new;
  end if;
  if not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       and not (new.verification_status = 'submitted' and old.verification_status in ('unverified', 'rejected')) then
      raise exception 'verification_admin_only' using errcode = '42501';
    end if;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
    new.created_by := old.created_by;
    if old.verification_status = 'verified'
       and (new.name, new.type, new.website, new.country) is distinct from (old.name, old.type, old.website, old.country) then
      new.verification_status := 'submitted';
      new.verified_at := null;
      new.verified_by := null;
    end if;
  elsif new.verification_status = 'verified' and old.verification_status <> 'verified' then
    new.verified_at := now();
    new.verified_by := auth.uid();
  end if;
  return new;
end;
$$;
