# Auditoría de contenido

Criterios: una sola explicación por página, ninguna promesa que no se pueda cumplir, datos con su fuente y acción clara.
Microcopy objetivo: "cumples 8 de 10 requisitos; faltan X e Y", no "92 % preparado"; "identidad verificada el…", no "verificado".

## `/oportunidades` (revisión de la auditoría externa del 16 nov 2026)

| Elemento | Hallazgo | Estado / cambio propuesto | Prioridad |
|---|---|---|---|
| Mensaje repetido | "Organizaciones verificadas / no se paga por posición" aparece en el H1, el párrafo, el estado vacío, la franja de confianza y el pie | Dejar **una** explicación (franja de confianza) y quitar las otras | P0 |
| Estado vacío | Honesto, pero no da valor inmediato | Formulario de alerta por deporte, edad, país y destino; "Pide que invitemos a una organización"; checklist del proceso | P0 |
| Filtros | Solo las 4 verticales | Deporte, país o ubicación, división, plazo, coste e importe de ayuda en la URL (se pueden compartir) | P1 |
| Sello | No se puede abrir | Hacerlo clicable: qué se verificó, cuándo, por quién y **qué no significa** | P1 |
| CTA | No conserva el contexto | Registrarse desde una oportunidad debe volver a ella (`from=opportunity` existe en la URL, pero el registro no lo usa) | P1 |
| Pie | Sin accesibilidad, contacto de seguridad ni idioma | Enlazar la declaración de accesibilidad y el canal de seguridad; selector de idioma cuando haya i18n | P2 |

## Resto del sitio

| ID | Hallazgo | Evidencia | Prioridad |
|---|---|---|---|
| CONT-01 | `Readiness` se muestra como cifra (72/100) en la vista previa de la home | `src/components/landing/PassportPreview.tsx` | P2: añadir "x de y apartados" junto a la cifra |
| CONT-02 | El sello dice "Verificado" sin fecha ni alcance | `TrustSeal`, `OpportunityCard` | P1: fecha de la comprobación y alcance |
| CONT-03 | Recurso de moderación con un `[email]` sin rellenar | `src/content/legal.ts:80` | P0 legal: bloquea abrir el registro |
| CONT-04 | Textos legales sin fecha de vigencia ni versión visible | `src/content/legal.ts` | P1 |
| CONT-05 | Interfaz solo en castellano; textos repartidos por los componentes | 69 páginas, sin capa i18n | P1 (antes de abrir mercados no hispanohablantes) |
| CONT-06 | Componente sin uso | `src/components/landing/Timeline.tsx` | P2: borrarlo o reutilizarlo |
