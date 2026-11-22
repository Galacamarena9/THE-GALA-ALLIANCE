# Storage

| Bucket | Público | Límite | Tipos | Quién lee | ¿Existe en remoto? |
|---|---|---|---|---|---|
| `athlete-documents` | No | 10 MB | PDF, JPG, PNG | Dueño, familia con permiso, organización con concesión vigente | Sí |
| `athlete-photos` | No | 5 MB | JPG, PNG, WebP | Quien puede ver el perfil (`can_view_athlete`) | Sí |
| `verification-evidence` | No | 5 MB | PDF, JPG, PNG | Quien la sube y los admins | **No** (llega con las migraciones pendientes) |

- **Ruta:** `<uuid del dueño>/<archivo>`. Los constraints de la base de datos impiden apuntar a carpetas ajenas (`path_belongs_to_athlete`, `photo_belongs_to_athlete`, `verification_evidence_path_owner`).
- **Metadatos y permisos** en PostgreSQL (`athlete_documents`, `document_access_grants`); el archivo vive en Storage.
- **Enlaces firmados:**
  - duran 60 s, o 5 min para documentos compartidos por solicitud;
  - se generan solo después de comprobar el permiso;
  - no se guardan ni se escriben en logs;
  - cada apertura por un tercero queda registrada (`document_open` → `audit_logs`).
- **Subidas:**
  - el bucket limita tamaño y tipo;
  - el servidor comprueba la firma real del archivo (magic bytes) y su tamaño, y guarda `content_sha256`;
  - si algo no coincide, borra el archivo;
  - no se confía en la extensión que envía el navegador.
- **No hay buckets públicos.** Transcripciones, identidad, evidencias, ofertas, archivos de menores y vídeos privados van siempre en buckets privados.
- **Pendiente con volumen real:** escaneo de malware y procesado de imagen y vídeo con estado de procesamiento.
- **Los backups de base de datos no incluyen los archivos de Storage** (ver [backup-recovery.md](backup-recovery.md)).
