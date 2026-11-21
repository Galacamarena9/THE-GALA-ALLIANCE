# Arquitectura de información: cada actor resuelve rápido

Principio: **un inicio por actor, lo que resuelve su día a un clic, el resto a dos**. Nada se repite con otro nombre.

Fuente única: `src/lib/domain/navigation.ts` (barra lateral, buscador ⌘K y mosaicos del inicio) y
`src/app/app/MobileNav.tsx` (barra inferior en móvil). Las reglas están fijadas en `navigation.test.ts`.

## Inicio por actor

| Actor | Qué es «Inicio» | Lo que resuelve a un clic (barra / móvil) |
|---|---|---|
| Atleta | Command Center: siguiente acción, Passport, matches, plazos | Passport · Gala Match · Mi pipeline · Becas · Universidades · Mensajes |
| Familia | Panel familiar: lo que necesita su decisión y los plazos | Coste real · Su pipeline · Plan familiar · Documentos · Seguridad |
| Agente | Workspace: «Hoy» (vencidos, alertas), cartera, procesos, propuestas | Cartera · Trials · Procesos · Listas · Escaparate · Mensajes |
| Coach / universidad | Recruiting: qué revisar, necesidades, equipo | Descubrir atletas · Listas de seguimiento · Procesos · (Uni) Nuestras becas |
| Marca | Mis campañas | Talento · Listas · Mensajes |
| Admin | Operaciones | Panel de mando · Revisión · Trust & Safety · Analítica |

`/app` muestra los primeros pasos mientras falten; cuando están hechos, lleva directo al espacio del rol
(`WORKSPACE_HOME`), salvo que haya algo pendiente que revisar. La entrada «Inicio» se marca activa también en ese espacio.

## Reglas

- Máximo 8 entradas a la vista por rol; lo secundario tras «Ver más» y siempre en el buscador ⌘K.
- Sin duplicados: el espacio de trabajo no aparece otra vez en «Mi espacio»; coaches y universidades
  tienen un único buscador de talento (el de su espacio, con privacidad y encaje).
- El rol principal del perfil decide el inicio y la barra; con varios roles ningún espacio queda inaccesible.
- Nombres en castellano (Listas, Procesos), sin jerga en inglés.
- Facturación: las organizaciones la ven en Cuenta («Plan y facturación»); atletas y familias ven los planes públicos.
- Las notificaciones viven en la campana, no en la barra.
