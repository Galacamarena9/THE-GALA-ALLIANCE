'use client';

import { useEffect } from 'react';

/** 20 · Si la persona llega con ?ref=codigo, se recuerda 30 días para atribuir la invitación al completar el alta. */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[a-z0-9]{8}$/.test(ref)) document.cookie = `tga_ref=${ref}; Max-Age=2592000; Path=/; SameSite=Lax; Secure`;
  }, []);
  return null;
}
