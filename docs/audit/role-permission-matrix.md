# Matriz de roles y permisos

Fuente de verdad: RLS en Postgres (`supabase/migrations/`, ver [data-map.md](data-map.md)) y guardias de servidor
(`requireSession`, `src/lib/session.ts:48-50`). La interfaz (`src/lib/domain/navigation.ts`) solo refleja lo que la base
de datos permite. RLS probada con 84 casos por actor (`supabase/tests/rls.test.mjs`, job `rls` del CI).

Roles en la base de datos (`app_role`, `20261113000100_foundation.sql:22`): `athlete`, `parent`, `university`, `coach`, `agent`, `brand`, `admin`.
Una cuenta puede tener varios roles (`user_roles`). Los roles de organización actúan a través de `organization_members`
(`admin`, `recruiter`, `coach`) y solo publican o contactan si la organización está `verified`.

Leyenda: ✅ permitido · 🔶 condicionado · ❌ denegado.

| Recurso | Anónimo | Atleta adulto | Atleta menor | Familia (vínculo aprobado) | Universidad / coach (org. verificada) | Agente | Marca | Admin |
|---|---|---|---|---|---|---|---|---|
| Passport (perfil) | 🔶 solo adultos con visibilidad `public` | ✅ propio | ✅ propio | ✅ si `view_profile` | 🔶 adultos según visibilidad; menores solo si `public/members` y recruiter verificado | 🔶 adultos según visibilidad; menores ❌ salvo representación | 🔶 adultos; menores ❌ | ✅ |
| Datos académicos | ❌ | ✅ propio | ✅ propio | 🔶 `view_academics` | 🔶 por bloque `academics_visibility` | 🔶 ídem | 🔶 ídem | ✅ |
| Fecha de nacimiento, presupuesto (`private_profile_data`, `athlete_finances`) | ❌ | ✅ propio | ✅ propio | 🔶 | ❌ | ❌ | ❌ | ✅ |
| Documentos (bucket privado `athlete-documents`) | ❌ | ✅ propios (URL firmada 60 s) | ✅ propios | 🔶 `view_profile` | ❌ | ❌ | ❌ | 🔶 |
| Oportunidades publicadas | ✅ (todas las columnas, ver hallazgo P1-SEC-01) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publicar oportunidad | ❌ | ❌ | ❌ | ❌ | 🔶 miembro de org. verificada; estado solo `draft/pending_review` | ❌ | ❌ | ✅ publica |
| Candidatar | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Iniciar contacto | ❌ | ❌ | ❌ | — | 🔶 org. verificada, ventana NCAA abierta, 20/día; con menor requiere aprobación familiar | 🔶 representación aceptada | 🔶 solo adultos | — |
| Mensajes | ❌ | ✅ participante | 🔶 participante; sin emails/teléfonos/redes; familia lee el hilo | 🔶 lectura del hilo del menor | ✅ participante, 60/día | ✅ participante | ✅ participante | 🔶 por moderación |
| Campañas de marca | ❌ | ✅ (18+) | ❌ | ❌ | ❌ | ❌ | ✅ propias | ✅ |
| Denunciar / bloquear | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | revisa |
| Exportar datos de terceros (`/api/lists/export`, `/api/agency/export`) | ❌ | ❌ | ❌ | ❌ | 🔶 sus listas | 🔶 su cartera | 🔶 sus listas | ✅ |
| Auditoría (`audit_logs`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ lectura; nadie edita ni borra (trigger `audit_immutable`) |

## Huecos frente al modelo objetivo (RBAC + ABAC)

| ID | Hueco | Prioridad |
|---|---|---|
| PERM-01 | Nivel de verificación de **persona** (L1/L2) no existe: se verifica la organización por dominio, no al empleado | P1 |
| PERM-02 | Agentes: no se registran licencia, jurisdicción ni vigencia; el mandato es la "representación aceptada" | P1 |
| PERM-03 | Vínculo familia-menor por invitación aceptada, sin prueba de tutela proporcional | P1 (requiere decisión legal) |
| PERM-04 | Exportaciones B2B sin registro de finalidad ni base jurídica visible al exportar | P1 |
| PERM-05 | Administración sin "cuatro ojos" para decisiones graves | P2 |
