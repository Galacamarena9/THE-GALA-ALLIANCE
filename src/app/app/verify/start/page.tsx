import type { Metadata } from 'next';
import { requireSession } from '@/lib/session';
import { VerifyWizard } from '@/components/verify/VerifyWizard';

export const metadata: Metadata = { title: 'Verificar mi cuenta de coach' };

export default async function VerifyStartPage() {
  const session = await requireSession();
  const [first, ...rest] = session.displayName.split(' ');
  return (
    <div className="mx-auto max-w-lg">
      <VerifyWizard firstName={first ?? ''} lastName={rest.join(' ')} />
    </div>
  );
}
