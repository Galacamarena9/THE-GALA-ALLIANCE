'use client';

import { passwordStrength } from '@/lib/domain/password';
import { cx } from '@/components/ui';

const LABEL = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'] as const;
const TONE = ['bg-danger', 'bg-danger', 'bg-warn', 'bg-ok', 'bg-ok'] as const;

/** Medidor de fortaleza en vivo. Consejo: una frase larga es más segura y fácil de recordar que símbolos raros. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return <p className="mt-1.5 text-xs text-muted">Mínimo 10 caracteres. Una frase larga es lo más seguro y fácil de recordar.</p>;
  const s = passwordStrength(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i < Math.max(1, s) ? TONE[s] : 'bg-line-strong')} />)}
      </div>
      <p className="mt-1 text-xs text-muted">Fortaleza: <span className="font-semibold text-paper">{LABEL[s]}</span></p>
    </div>
  );
}
