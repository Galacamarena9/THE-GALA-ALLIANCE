import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Descarga de un documento privado. `document_open` (base de datos) decide si puedes abrirlo
 * —dueño, familia, organización con concesión vigente o admin— y registra los accesos de terceros.
 * El enlace firmado caduca en 60 s y no se guarda en ningún sitio.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse('Unauthorized', { status: 401 });
  const { data: path, error: openErr } = await supabase.rpc('document_open', { p_document: id });
  if (openErr || typeof path !== 'string') return new NextResponse('Not found', { status: 404 });
  const { data: signed, error } = await supabase.storage.from('athlete-documents').createSignedUrl(path, 60);
  if (error || !signed) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
