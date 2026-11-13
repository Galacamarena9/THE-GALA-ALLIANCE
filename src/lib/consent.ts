/**
 * Gestión de consentimiento de cookies en el navegador.
 *
 * Regla: ningún script de terceros se inyecta sin consentimiento previo de su categoría.
 * - Usa `loadConsentedScript()` en lugar de crear <script> a mano.
 * - Como red de seguridad, `installScriptGuard()` intercepta appendChild/insertBefore y
 *   bloquea cualquier <script data-consent="analytics|third_party"> sin permiso.
 */
export type ConsentCategory = 'analytics' | 'functional' | 'third_party';
export interface ConsentState {
  essential: true;
  analytics: boolean;
  functional: boolean;
  third_party: boolean;
  version: string;
  at: string;
}

export const CONSENT_COOKIE = 'tga_consent';
export const CONSENT_VERSION = '2026-11';

export function readConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('='))) as ConsentState;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsent(state: Omit<ConsentState, 'essential' | 'version' | 'at'>): ConsentState {
  const full: ConsentState = { essential: true, version: CONSENT_VERSION, at: new Date().toISOString(), ...state };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  // 6 meses: después se vuelve a preguntar.
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(full))}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent('tga:consent', { detail: full }));
  return full;
}

export function hasConsent(category: ConsentCategory) {
  return Boolean(readConsent()?.[category]);
}

export function anonymousId() {
  const key = 'tga_anon';
  const existing = document.cookie.split('; ').find((c) => c.startsWith(`${key}=`));
  if (existing) return existing.split('=')[1];
  const id = crypto.randomUUID();
  document.cookie = `${key}=${id}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;
  return id;
}

/** Carga un script externo solo si la categoría está consentida. */
export function loadConsentedScript(src: string, category: Exclude<ConsentCategory, 'functional'>) {
  if (!hasConsent(category)) return false;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.dataset.consent = category;
  document.head.appendChild(s);
  return true;
}

let guardInstalled = false;
/** Bloquea en el DOM cualquier script etiquetado que no tenga consentimiento. */
export function installScriptGuard() {
  if (guardInstalled || typeof window === 'undefined') return;
  guardInstalled = true;
  const blocked = (node: Node) => {
    if (!(node instanceof HTMLScriptElement)) return false;
    const cat = node.dataset.consent as ConsentCategory | undefined;
    if (!cat || cat === 'functional') return false;
    return !hasConsent(cat);
  };
  const originalAppend = Node.prototype.appendChild;
  const originalInsert = Node.prototype.insertBefore;
  Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
    if (blocked(node)) return node;
    return originalAppend.call(this, node) as T;
  };
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (blocked(node)) return node;
    return originalInsert.call(this, node, ref) as T;
  };
}
