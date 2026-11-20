'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { dragMove } from '@/app/actions/pipeline';

/**
 * Arrastrar y soltar en el tablero del pipeline.
 * Es un atajo: guarda de verdad en base de datos (dragMove) y, si falla, lo dice. El selector «Mover» de cada tarjeta
 * sigue disponible para teclado, lectores de pantalla y móvil (donde arrastrar es incómodo).
 */
type Ctx = { athlete: string; status: string | null; setStatus: (s: string | null) => void; pendingId: string | null; move: (id: string, stage: string) => void };
const BoardCtx = createContext<Ctx | null>(null);
const MIME = 'application/x-gala-process';

export function BoardDnD({ athlete, children }: { athlete: string; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const move = (id: string, stage: string) => {
    setPendingId(id);
    start(async () => {
      const r = await dragMove({ id, status: stage, athlete });
      setStatus(r.message);
      setPendingId(null);
      if (r.ok) router.refresh();
    });
  };
  return (
    <BoardCtx.Provider value={{ athlete, status, setStatus, pendingId, move }}>
      {children}
      <p role="status" aria-live="polite" className="sr-only">{status}</p>
    </BoardCtx.Provider>
  );
}

export function DraggableCard({ id, stage, disabled, children }: { id: string; stage: string; disabled?: boolean; children: ReactNode }) {
  const ctx = useContext(BoardCtx);
  if (!ctx || disabled) return <>{children}</>;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify({ id, from: stage })); e.dataTransfer.effectAllowed = 'move'; }}
      className={`cursor-grab active:cursor-grabbing ${ctx.pendingId === id ? 'opacity-50' : ''}`}
      aria-busy={ctx.pendingId === id}
    >
      {children}
    </div>
  );
}

export function DropColumn({ stage, children }: { stage: string; children: ReactNode }) {
  const ctx = useContext(BoardCtx);
  const [over, setOver] = useState(false);
  if (!ctx) return <>{children}</>;
  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes(MIME)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const raw = e.dataTransfer.getData(MIME);
        if (!raw) return;
        e.preventDefault();
        const { id, from } = JSON.parse(raw) as { id: string; from: string };
        if (from !== stage) ctx.move(id, stage);
      }}
      className={`min-h-16 rounded-xl transition-colors ${over ? 'bg-brass/10 outline-dashed outline-1 outline-brass/60' : ''}`}
    >
      {children}
    </div>
  );
}

/** Mensaje visible del último movimiento (además del aviso para lectores de pantalla). */
export function BoardStatus() {
  const ctx = useContext(BoardCtx);
  if (!ctx?.status) return null;
  return <p className="mb-2 text-xs text-muted">{ctx.status} <button type="button" onClick={() => ctx.setStatus(null)} className="ml-1 text-faint hover:text-paper" aria-label="Cerrar aviso">✕</button></p>;
}
