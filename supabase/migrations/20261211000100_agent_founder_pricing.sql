-- Precio fundador para agencias (22-nov-2026): señal de pago real en lugar de «gratis hasta el 31/03/2027».
-- Nueva versión 2 de los planes Agente y Agencia: 29 €/mes y 79 €/mes, sin periodo gratis por fecha
-- (la prueba de 30 días la da Stripe al suscribirse). La versión 1 queda inactiva y se conserva para el histórico:
-- las suscripciones existentes siguen apuntando a su versión.
insert into public.plan_catalog (code, version, audience, name, billing_interval, price_cents, seats_included, features, free_until, active)
select code, 2, audience, name, billing_interval,
       case code when 'agent_solo' then 2900 when 'agent_team' then 7900 end,
       seats_included, features, null, true
from public.plan_catalog
where code in ('agent_solo', 'agent_team') and version = 1
on conflict (code, version) do nothing;

update public.plan_catalog set active = false
where code in ('agent_solo', 'agent_team') and version = 1;
