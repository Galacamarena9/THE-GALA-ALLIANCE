# Clubs & Academies · revisión del Prompt 11 (22-11-2026)

Clubs & Academies se construyó en los prompts 11 → 11E ([CLUBS_ACADEMIES_DATA_MODEL.md](CLUBS_ACADEMIES_DATA_MODEL.md), [CLUBS-ACADEMIES-RLS.md](CLUBS-ACADEMIES-RLS.md), [MOBILE_SCOUT_TRIAL.md](MOBILE_SCOUT_TRIAL.md), [CLUBS-ACADEMIES-PENTEST.md](CLUBS-ACADEMIES-PENTEST.md), [CLUBS-ACADEMIES-QA.md](CLUBS-ACADEMIES-QA.md) y [TRIALS.md](TRIALS.md)). Esta revisión contrasta el texto completo del Prompt 11 con el código y las pruebas.

## 1. Criterio de aceptación (§75)

| Criterio | Prueba directa en PostgreSQL (`test:rls`) | Estado |
|---|---|---|
| Un club verificado crea una necesidad real | `recruiting_needs` + 11B equipos | ✅ |
| Gala Match devuelve solo atletas autorizados | Discovery (`discover_athlete_ids` con cuota diaria) + 7B | ✅ |
| El scout revisa el Passport sin saltarse la privacidad | 11B, P10A (campos por permiso) | ✅ |
| La shortlist funciona y no se manipula | 7B shortlists, **G-08 (11B revisión)** | ✅ |
| El trial se publica solo con lo obligatorio | 11A publicación (fecha, lugar, categoría, coste, requisitos) | ✅ |
| El atleta aplica y la familia interviene cuando toca | 11A escenarios 1, 3 y 4 | ✅ |
| Documentos solo con permiso | 11B documentos, P10D | ✅ |
| El club confirma la participación; confirmado ≠ asistió | 11A escenario 1 (asistencia explícita) | ✅ |
| Del trial al recruiting | 11A escenario 1 | ✅ |
| La oferta es real y trazable | `athlete_offers` / `campaign_offers` con origen; nunca se crea sola | ✅ |
| El club A no accede al B | 11A escenario 5, 11B aislamiento | ✅ |
| Una organización sin verificar no tiene acceso privilegiado | 11B suspensión y verificación | ✅ |
| Las protecciones de menores funcionan | 11B, `minor_contact_mode`, P10 | ✅ |
| No se generan oportunidades falsas para rellenar | No hay datos de relleno: Discovery y oportunidades solo muestran registros reales (regla del proyecto) | ✅ |

## 2. Producto: comprobaciones de hoy

| Punto | Estado |
|---|---|
| §14–15, §33 Coste visible y sin urgencia falsa | ✅ Precio «gratis» o «de pago» obligatorio y costes obligatorios separados de los opcionales (11A escenario 2). Ningún texto de «últimas plazas», «alta probabilidad» ni «garantizado» en la interfaz; el detector de confianza avisa de becas «garantizadas» y prisas |
| §61 Trials caducados fuera de Discovery | ✅ `expire_stale_opportunities` (pg_cron) y `expires_at` |
| §62 Zona horaria del evento | ✅ `timezone` validada en la base de datos; hora local del evento |
| §65 Viaje, alojamiento y comidas | ✅ «incluido», «disponible de pago», «no incluido» o «desconocido» por trial o programa |
| **§64 Atletas internacionales «con condiciones»** | **Hoy.** Antes solo había sí / no / sin indicar. Ahora existe «con condiciones», que obliga a explicarlas: la base de datos rechaza el valor sin texto. Se muestra en la ficha |
| **§53 Denunciar una oportunidad** | **Hoy.** Motivos propios en la ficha: información engañosa, organización falsa, pago sospechoso, **garantía falsa**, **coste incorrecto**, contacto inapropiado, privacidad y menores. La garantía falsa entra con prioridad alta |

## 3. Cambios de hoy

`20261209000700_11r_opportunity_trust.sql` (expand, sin cambios de datos) + formulario y ficha de oportunidad + panel de moderación. Prueba «P11 revisión».

## 4. Abierto

| Punto | Estado |
|---|---|
| E2E de navegador del recorrido completo atleta ↔ club ↔ familia | ⛔ Cubierto en la base de datos (11A escenarios 1–5); el navegador necesita el remoto al día |
| Pagos de trials y academias | ⬜ Preparado (importe, moneda, reembolsable, `payment_status`), sin cobro: fuera de alcance |
| Escaneo de malware de los archivos subidos | ⬜ Cuando haya volumen real (ver `supabase/storage.md`) |
