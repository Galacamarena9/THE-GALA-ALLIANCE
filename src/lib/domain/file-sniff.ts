/** Tipos de archivo admitidos en documentos privados. */
export type DocMime = 'application/pdf' | 'image/jpeg' | 'image/png';

/**
 * Detecta el tipo real por la firma de los primeros bytes («magic bytes»).
 * No confía en la extensión ni en el content-type que declara el navegador.
 */
export function sniffMime(head: Uint8Array): DocMime | null {
  if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d) return 'application/pdf'; // %PDF-
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
    && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) return 'image/png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  return null;
}

/** El archivo subido es lo que dice ser y tiene el tamaño declarado. */
export function uploadMatches(bytes: Uint8Array, declared: { mime: DocMime; size: number }): boolean {
  return bytes.byteLength === declared.size && sniffMime(bytes.subarray(0, 16)) === declared.mime;
}
