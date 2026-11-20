import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabaseEnv } from '@/lib/env';

/**
 * Prompt 20 · Datos públicos para SEO, con el cliente anónimo (sin cookies): solo lo que la RLS permite ver a
 * cualquiera — oportunidades publicadas de organizaciones verificadas. Nunca atletas.
 */
function anon() {
  const { url, publishableKey } = supabaseEnv();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface PublicOppRow { id: string; title: string; type: string; sport_id: string | null; deadline: string | null; location: string | null; updated_at: string | null; organization_id: string }
const OPP_COLS = 'id, title, type, sport_id, deadline, location, updated_at, organization_id, organizations!inner(verification_status)';

export const publishedOpportunities = cache(async (limit = 2000): Promise<PublicOppRow[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await anon().from('opportunities').select(OPP_COLS).eq('status', 'published').eq('organizations.verification_status', 'verified')
      .order('updated_at', { ascending: false }).limit(limit);
    return ((data ?? []) as unknown as PublicOppRow[]);
  } catch { return []; }
});

export interface PublicOrg { id: string; name: string; type: string; website: string | null; country: string | null; city: string | null; division: string | null }

export const publicOrganization = cache(async (id: string): Promise<{ org: PublicOrg; opportunities: PublicOppRow[] } | null> => {
  if (!/^[0-9a-f-]{36}$/.test(id) || !isSupabaseConfigured()) return null;
  try {
    const db = anon();
    const { data: org } = await db.from('organizations').select('id, name, type, website, country, city, division, verification_status, org_status')
      .eq('id', id).eq('verification_status', 'verified').eq('org_status', 'active').maybeSingle();
    if (!org) return null;
    const { data: opps } = await db.from('opportunities').select(OPP_COLS).eq('organization_id', id).eq('status', 'published').order('deadline', { ascending: true }).limit(100);
    return { org: org as unknown as PublicOrg, opportunities: (opps ?? []) as unknown as PublicOppRow[] };
  } catch { return null; }
});
