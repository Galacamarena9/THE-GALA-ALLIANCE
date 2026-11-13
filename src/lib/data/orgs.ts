import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrgType, VerificationStatus } from '@/lib/types';

export interface MyOrg {
  id: string;
  name: string;
  type: OrgType;
  verification_status: VerificationStatus;
  member_role: 'admin' | 'recruiter' | 'coach';
}

/** Organizaciones de las que el usuario es miembro. */
export async function myOrganizations(userId: string): Promise<MyOrg[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_members')
    .select('member_role, organizations(id, name, type, verification_status)')
    .eq('user_id', userId);
  return (data ?? [])
    .map((m) => {
      const o = m.organizations as unknown as Omit<MyOrg, 'member_role'> | null;
      return o ? { ...o, member_role: m.member_role as MyOrg['member_role'] } : null;
    })
    .filter((o): o is MyOrg => Boolean(o));
}
