-- Supabase concede por defecto privilegios de tabla a anon en tablas nuevas de public.
-- La RLS ya impedía cualquier lectura anónima (no hay política para anon); se retira el
-- privilegio para que la tabla ni siquiera sea alcanzable sin sesión (defensa en profundidad).
revoke all on public.agency_athlete_notes from anon;
