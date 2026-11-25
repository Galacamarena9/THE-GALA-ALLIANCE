import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EXPORT_SOURCES } from '@/lib/privacy/export-tables';

/**
 * Derecho de acceso y portabilidad: descarga en JSON de todos los datos propios.
 * Usa el cliente del usuario, así que solo puede devolver lo que la RLS le permite ver de sí mismo.
 * La lista de tablas vive en src/lib/privacy/export-tables.ts (comprobada en CI contra el catálogo de datos).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'auth_required' }, { status: 401 });

  const results = await Promise.all(
    EXPORT_SOURCES.map(async (s) => {
      let q = supabase.from(s.table).select(s.select ?? '*');
      q = s.either ? q.or(`${s.either[0]}.eq.${uid},${s.either[1]}.eq.${uid}`) : q.eq(s.column ?? 'user_id', uid);
      const { data, error } = await q;
      return [s.key, error ? { error: 'No se pudo leer esta sección; vuelve a intentarlo o pídela a privacidad.' } : data] as const;
    }),
  );

  // Fase 6 (S4): los campos con visibilidad por bloque se leen por función; el titular los ve todos.
  const sections = Object.fromEntries(results) as Record<string, unknown>;
  if (Array.isArray(sections.athlete_profile) && sections.athlete_profile.length) {
    const { data: block } = await supabase.rpc('athlete_block_fields', { p_athlete: uid });
    const extra = (block as Record<string, unknown>[] | null)?.[0];
    if (extra) {
      const { user_id: _u, ...fields } = extra;
      void _u;
      sections.athlete_profile = [{ ...(sections.athlete_profile[0] as object), ...fields }];
    }
  }

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: auth.user?.email, created_at: auth.user?.created_at },
    note: 'Los archivos de tus documentos se descargan uno a uno desde Documentos. Las notas internas que una organización escribe sobre ti pertenecen a esa organización.',
    ...sections,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="the-gala-alliance-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
