'use client';

import { Button } from '@/components/ui';

export function CookiePrefsButton() {
  return (
    <Button variant="secondary" onClick={() => window.dispatchEvent(new Event('tga:open-cookies'))}>
      Cambiar preferencias
    </Button>
  );
}
