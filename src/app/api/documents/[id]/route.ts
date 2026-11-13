import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Descarga de un documento privado: la RLS decide si puedes leer la fila; el enlace firmado caduca en 60 s. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse('Unauthorized', { status: 401 });
  const { data: doc } = await supabase.from('athlete_documents').select('storage_path').eq('id', id).maybeSingle();
  if (!doc?.storage_path) return new NextResponse('Not found', { status: 404 });
  const { data: signed, error } = await supabase.storage.from('athlete-documents').createSignedUrl(doc.storage_path, 60);
  if (error || !signed) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
