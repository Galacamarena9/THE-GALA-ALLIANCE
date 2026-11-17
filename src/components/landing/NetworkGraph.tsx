'use client';

import { useState } from 'react';
import { Building2, GraduationCap, Handshake, Megaphone, Trophy, Users } from 'lucide-react';

/**
 * "Una red, no seis productos": cada conexión describe algo que la plataforma YA hace
 * (confirmación de estadísticas por el club, aprobación familiar, Passport compartido, representación con
 * consentimiento, campañas solo para mayores de edad, coste real visible para la familia).
 */
const ACTORS = [
  { id: 'athlete', label: 'Atleta', Icon: Trophy, x: 50, y: 50, gives: 'Un solo Passport con todo su recorrido, del que controla quién ve qué.' },
  { id: 'parent', label: 'Familia', Icon: Users, x: 50, y: 12, gives: 'Ve plazos y coste real, y aprueba cada contacto si el atleta es menor.' },
  { id: 'university', label: 'Universidad', Icon: GraduationCap, x: 87, y: 31, gives: 'Publica becas verificadas y gestiona candidatos en su pipeline.' },
  { id: 'coach', label: 'Club y coach', Icon: Building2, x: 87, y: 72, gives: 'Confirma estadísticas y recomienda a sus jugadores.' },
  { id: 'agent', label: 'Agente', Icon: Handshake, x: 13, y: 72, gives: 'Acompaña el proceso solo con el consentimiento del atleta.' },
  { id: 'brand', label: 'Marca', Icon: Megaphone, x: 13, y: 31, gives: 'Lanza campañas con atletas mayores de edad, con aviso NIL.' },
] as const;
type Id = (typeof ACTORS)[number]['id'];

const LINKS: { a: Id; b: Id; label: string }[] = [
  { a: 'coach', b: 'university', label: 'El club confirma las estadísticas → la universidad confía en el dato' },
  { a: 'coach', b: 'athlete', label: 'El club valida el nivel → el Passport gana credibilidad' },
  { a: 'parent', b: 'athlete', label: 'La familia aprueba los contactos → el menor está protegido' },
  { a: 'parent', b: 'university', label: 'La familia ve el coste neto → decide con números reales' },
  { a: 'athlete', b: 'university', label: 'El atleta candidata con su Passport → la universidad evalúa en minutos' },
  { a: 'agent', b: 'athlete', label: 'El agente representa con permiso → el atleta puede retirarlo' },
  { a: 'agent', b: 'university', label: 'El agente gestiona procesos → la universidad tiene un interlocutor' },
  { a: 'brand', b: 'athlete', label: 'La marca encuentra talento adulto → patrocinio transparente' },
];

export function NetworkGraph() {
  const [active, setActive] = useState<Id>('coach');
  const pos = Object.fromEntries(ACTORS.map((a) => [a.id, a])) as Record<Id, (typeof ACTORS)[number]>;
  const activeLinks = LINKS.filter((l) => l.a === active || l.b === active);
  const connected = new Set(activeLinks.flatMap((l) => [l.a, l.b]));

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Actores de la red">
          {ACTORS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={active === a.id}
              onClick={() => setActive(a.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${active === a.id ? 'border-brass bg-brass text-white' : 'border-line bg-surface text-paper hover:border-brass/50'}`}
            >
              <a.Icon className="h-4 w-4" aria-hidden />{a.label}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-5" aria-live="polite">
          <p className="font-semibold text-paper">{pos[active].gives}</p>
          <ul className="mt-3 space-y-2">
            {activeLinks.map((l) => (
              <li key={l.label} className="animate-fade-in-up flex gap-2 text-sm text-muted"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass" aria-hidden />{l.label}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] bg-night" aria-hidden>
        <div className="court-lines absolute inset-0 opacity-30" />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="0.3" />
          {LINKS.map((l) => {
            const on = l.a === active || l.b === active;
            return (
              <line
                key={l.label}
                x1={pos[l.a].x} y1={pos[l.a].y} x2={pos[l.b].x} y2={pos[l.b].y}
                strokeWidth={on ? 0.9 : 0.35}
                strokeDasharray={on ? undefined : '1 1'}
                className={`transition-all duration-500 ${on ? 'stroke-lime' : 'stroke-lavender/30'}`}
              />
            );
          })}
        </svg>
        {ACTORS.map((a) => {
          const on = a.id === active;
          const near = connected.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              tabIndex={-1}
              onClick={() => setActive(a.id)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 sm:h-14 sm:w-14 ${on ? 'scale-110 bg-lime text-night' : near ? 'bg-brass text-white' : 'bg-white/10 text-lavender ring-1 ring-white/15'}`}>
                <a.Icon className="h-5 w-5" />
              </span>
              <span className={`text-center text-[11px] font-semibold leading-tight ${on || near ? 'text-white' : 'text-lavender/70'}`}>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
