'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { addCustomDocument, addExternalOffer, createRosterInvite, deleteMyAccount, recordDocumentUpload } from '@/app/actions/autonomy';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { DOC_KIND_LABEL, DOC_KINDS } from '@/content/documents';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

/** Sube el archivo directamente al almacenamiento privado (la RLS de Storage comprueba el permiso) y lo registra. */
export function DocumentUpload({ docId, athleteId, hasFile }: { docId: string; athleteId: string; hasFile: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setError('Solo PDF, JPG o PNG.');
    if (file.size > MAX_BYTES) return setError('Máximo 10 MB.');
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${athleteId}/${docId}-${Date.now()}.${ext}`;
    start(async () => {
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return setError('No se ha podido subir. Inténtalo de nuevo.');
      const res = await recordDocumentUpload({ id: docId, athleteId, path, mime: file.type, size: file.size });
      if (!res.ok) {
        await supabase.storage.from('athlete-documents').remove([path]);
        return setError('No se ha podido guardar.');
      }
      router.refresh();
    });
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center rounded-lg border border-line px-3 py-1.5 text-sm text-paper hover:border-brass/60">
        {pending ? 'Subiendo…' : hasFile ? 'Sustituir archivo' : 'Subir archivo'}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function CustomDocumentForm({ athleteId }: { athleteId: string }) {
  return (
    <ActionForm action={addCustomDocument} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
      {() => (
        <>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <select name="kind" aria-label="Tipo" className={inputClass} defaultValue="other">
            {DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}
          </select>
          <input name="title" required minLength={2} maxLength={120} placeholder="Nombre del documento" aria-label="Nombre del documento" className={inputClass} />
          <input name="due_date" type="date" aria-label="Fecha objetivo" className={inputClass} />
          <SubmitButton pendingText="Añadiendo…">Añadir</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RosterInviteForm({ organizationId, defaultSeason }: { organizationId: string; defaultSeason: string }) {
  return (
    <ActionForm action={createRosterInvite} className="flex flex-wrap items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="organization_id" value={organizationId} />
          <label className="grid gap-1 text-xs text-faint">
            Temporada
            <input name="season" required defaultValue={defaultSeason} pattern="\d{4}-\d{2,4}" className={`${inputClass} w-32`} />
          </label>
          <SubmitButton pendingText="Creando…">Crear enlace de roster</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DeleteAccountForm() {
  return (
    <ActionForm action={deleteMyAccount} className="grid gap-3">
      {() => (
        <>
          <p className="text-sm text-muted">
            Se borran tu perfil, tu Passport, tus documentos y tu historial. Lo que la ley obliga a conservar (registros de consentimiento y auditoría) queda desvinculado de tu identidad.
            Esta acción no se puede deshacer.
          </p>
          <label className="grid gap-1 text-xs text-faint">
            Escribe ELIMINAR para confirmar
            <input name="confirm" required autoComplete="off" className={`${inputClass} max-w-xs`} />
          </label>
          <SubmitButton variant="danger" pendingText="Eliminando…">Eliminar mi cuenta definitivamente</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PrintButton({ label = 'Imprimir o guardar en PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print rounded-lg bg-brass px-4 py-2 text-sm font-medium text-ink hover:brightness-110">
      {label}
    </button>
  );
}

export function ExternalOfferForm({ athleteId }: { athleteId: string }) {
  return (
    <ActionForm action={addExternalOffer} className="grid gap-3">
      {() => (
        <>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <input name="university_name" required minLength={2} maxLength={200} placeholder="Universidad" aria-label="Universidad" className={inputClass} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-faint">Coste anual (USD)<input name="annual_cost_usd" type="number" min={0} max={200000} className={inputClass} /></label>
            <label className="grid gap-1 text-xs text-faint">Ayuda anual (USD)<input name="aid_amount_usd" type="number" min={0} max={200000} className={inputClass} /></label>
            <label className="grid gap-1 text-xs text-faint">Plazo para responder<input name="deadline" type="date" className={inputClass} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <label className="flex items-center gap-2">¿Se renueva cada año?
              <select name="renewable" defaultValue="unknown" className={`${inputClass} w-auto`}>
                <option value="unknown">No lo sé</option><option value="yes">Sí</option><option value="no">No</option>
              </select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" name="in_writing" className="accent-[var(--color-brass)]" /> La tengo por escrito</label>
          </div>
          <textarea name="source_text" rows={4} maxLength={5000} placeholder="Pega aquí el email o la carta de la oferta (opcional): la revisamos en busca de señales de alarma." aria-label="Texto de la oferta" className={inputClass} />
          <SubmitButton pendingText="Guardando…">Añadir oferta</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
