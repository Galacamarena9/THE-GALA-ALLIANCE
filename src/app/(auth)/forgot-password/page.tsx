import type { Metadata } from 'next';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl text-paper">¿Olvidaste tu contraseña?</h1>
      <p className="mb-8 mt-3 text-sm text-muted">Escribe tu email y te enviamos un enlace para crear una nueva.</p>
      <ForgotForm />
    </>
  );
}
