/** Datos estructurados (schema.org). Solo hechos que están en la página; nunca valores inventados. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // JSON.stringify escapa comillas; se neutraliza «<» para que el contenido no pueda cerrar la etiqueta script.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
