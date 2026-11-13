'use server';

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

const schema = z.object({
  anonymousId: z.string().min(8).max(64),
  analytics: z.boolean(),
  functional: z.boolean(),
  third_party: z.boolean(),
});

/** Registro inmutable de la decisión de cookies (prueba de consentimiento). IP solo como hash. */
export async function logCookieConsent(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success || !isSupabaseConfigured()) return;
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const salt = process.env.CONSENT_IP_SALT ?? 'tga';
  const ipHash = ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.from('cookie_consent_logs').insert({
    user_id: data.user?.id ?? null,
    anonymous_id: parsed.data.anonymousId,
    essential_allowed: true,
    analytics_allowed: parsed.data.analytics,
    functional_allowed: parsed.data.functional,
    third_party_allowed: parsed.data.third_party,
    user_agent: h.get('user-agent')?.slice(0, 400) ?? null,
    ip_hash: ipHash,
  });
}
