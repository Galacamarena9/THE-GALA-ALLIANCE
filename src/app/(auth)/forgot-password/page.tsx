import type { Metadata } from 'next';
import { ForgotForm } from './ForgotForm';
import { publicMeta } from '@/lib/seo/page-meta';

export const metadata: Metadata = publicMeta({ title: 'Recuperar contraseña', description: 'Recupera el acceso a tu cuenta de The Gala Alliance con tu email.', path: '/forgot-password', robots: { index: false, follow: true } });

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl text-paper">¿Olvidaste tu contraseña?</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Escribe tu email y te enviamos un enlace para crear una nueva.</p>
      <ForgotForm />
    </>
  );
}
