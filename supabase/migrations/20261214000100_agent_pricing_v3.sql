-- Precios de agencias v3 (decisión de Gala, 23-nov-2026): tarifa 79 €/199 €/mes; las 15 primeras agencias pagan el
-- precio fundador (−40 %, 47 €/119 €) de por vida. El catálogo cobra el precio fundador mientras dure el programa.
-- Se conserva free_until de la versión anterior hasta activar Stripe en modo real (otra migración lo pondrá a null).
insert into public.plan_catalog (code, version, audience, name, billing_interval, price_cents, seats_included, features, free_until, active)
select code, 3, audience, name, billing_interval,
       case code when 'agent_solo' then 4700 when 'agent_team' then 11900 end,
       seats_included, features, free_until, true
from public.plan_catalog
where code in ('agent_solo', 'agent_team') and version = 2
on conflict (code, version) do nothing;

update public.plan_catalog set active = false
where code in ('agent_solo', 'agent_team') and version = 2;
