-- Roles de staff (Fase 07). Separada porque un valor nuevo de enum no puede usarse en la misma transacción.
-- Reversión: los valores de enum no se eliminan; basta con no usarlos (mapear a 'coach'/'recruiter').
alter type public.org_member_role add value if not exists 'owner';
alter type public.org_member_role add value if not exists 'head_coach';
alter type public.org_member_role add value if not exists 'assistant_coach';
alter type public.org_member_role add value if not exists 'recruiting_coordinator';
alter type public.org_member_role add value if not exists 'admissions';
alter type public.org_member_role add value if not exists 'compliance';
alter type public.org_member_role add value if not exists 'staff';
