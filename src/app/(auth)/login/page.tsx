import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getT } from '@/lib/i18n/server-t';
import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Entrar') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const tx = await getT();
  const { next } = await searchParams;
  return (
    <>
      <div className="mb-4 flex justify-end"><LanguageSwitcher current={tx.locale} /></div>
      <h1 className="text-3xl text-paper">{tx('Bienvenido de nuevo')}</h1>
      <p className="mb-8 mt-3 text-sm text-muted">{tx('Entra para seguir con tu proceso.')}</p>
      <LoginForm next={next} />
    </>
  );
}
