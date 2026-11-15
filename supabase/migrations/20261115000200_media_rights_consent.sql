-- Derechos de imagen: al publicar un vídeo o foto en su perfil, el usuario confirma que puede
-- hacerlo y que las personas que aparecen lo consienten. Queda registrado como un consentimiento más.
alter table public.consents drop constraint consents_purpose_check;
alter table public.consents add constraint consents_purpose_check
  check (purpose in ('terms', 'privacy_notice', 'profile_discoverable', 'guardian_consent', 'marketing_email', 'media_rights'));
