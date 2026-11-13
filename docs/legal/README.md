# Documentación legal externa (borradores para el asesor)

> **Borradores técnicos, no asesoramiento jurídico.** Los ha preparado el equipo de producto a partir de lo que la plataforma hace realmente (migraciones de `supabase/migrations`, código y `src/content/legal.ts`). Antes del lanzamiento, un abogado especializado en protección de datos (y uno en EE. UU. para FERPA/COPPA/NCAA) debe revisarlos, completar los campos entre corchetes y firmarlos.

| Documento | Norma | Estado |
|---|---|---|
| [EIPD (evaluación de impacto)](EIPD.md) | RGPD art. 35; lista AEPD de tratamientos que requieren EIPD | Borrador |
| [Registro de actividades de tratamiento](RAT.md) | RGPD art. 30 | Borrador |
| [Plan de respuesta a brechas](PLAN_BRECHAS.md) | RGPD arts. 33 y 34 | Borrador |
| [Política de conservación](CONSERVACION.md) | RGPD art. 5.1.e | Borrador, alineada con `run_retention()` |

## Datos que faltan (los aporta la empresa)

- Razón social, NIF, domicilio y email de privacidad del responsable.
- Delegado de Protección de Datos, si se designa (recomendable por el tratamiento a escala de datos de menores).
- DPA firmados con cada encargado y mecanismo de transferencia internacional de cada uno.
- Plazo de conservación de registros de consentimiento y auditoría.
