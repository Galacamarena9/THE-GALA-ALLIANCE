import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl text-paper">Bienvenido de nuevo</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Entra para seguir con tu proceso.</p>
      <LoginForm next={next} />
    </>
  );
}
