-- Passport v2 · nuevo nivel de visibilidad "Solo organizaciones verificadas".
-- Va en su propia migración: un valor de enum nuevo no puede usarse en la misma transacción en que se crea.
-- Reversión: no se borra un valor de enum; basta con no usarlo (las filas vuelven a 'members').
alter type public.visibility_level add value if not exists 'verified_orgs' before 'connections';
