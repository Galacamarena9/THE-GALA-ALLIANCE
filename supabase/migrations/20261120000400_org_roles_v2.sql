-- Roles de organización v2 (Prompt 7B · 10). Separada: un valor nuevo de enum no puede usarse en la misma transacción.
-- Reversión: los valores de enum no se eliminan; basta con no usarlos.
alter type public.org_member_role add value if not exists 'athletic_director';
alter type public.org_member_role add value if not exists 'analyst';
alter type public.org_member_role add value if not exists 'viewer';
