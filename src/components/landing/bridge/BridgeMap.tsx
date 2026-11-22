/**
 * El puente Europa → NCAA: mapa abstracto de puntos con rutas que fluyen del talento europeo a los programas
 * universitarios de EE. UU. Es ilustrativo (no es un mapa a escala) y todo el movimiento es CSS que se apaga con
 * «reducir movimiento». Encima flota un Gala Passport de una atleta FICTICIA.
 */
const EU = [
  { x: 640, y: 168, name: 'Kaunas' },
  { x: 596, y: 214, name: 'París' },
  { x: 666, y: 246, name: 'Belgrado' },
  { x: 560, y: 268, name: 'Madrid' },
  { x: 590, y: 286, name: 'Valencia' },
  { x: 528, y: 300, name: 'Lisboa' },
  { x: 700, y: 300, name: 'Atenas' },
];
const US = [
  { x: 150, y: 196, name: 'NCAA D-I' },
  { x: 214, y: 258, name: 'D-II' },
  { x: 120, y: 300, name: 'NAIA' },
  { x: 236, y: 330, name: 'JUCO' },
];
const ROUTES: [number, number][] = [[4, 0], [3, 1], [1, 0], [0, 0], [2, 3], [5, 2], [6, 1]];

/** Rejilla de puntos con dos «continentes» sugeridos por elipses (estilizado, no geográfico). */
function dots() {
  const out: { x: number; y: number; o: number }[] = [];
  for (let y = 100; y <= 420; y += 14) {
    for (let x = 40; x <= 780; x += 14) {
      const us = ((x - 180) / 150) ** 2 + ((y - 260) / 120) ** 2 < 1;
      const eu = ((x - 620) / 120) ** 2 + ((y - 240) / 110) ** 2 < 1;
      if (us || eu) out.push({ x, y, o: us ? 0.3 : 0.4 });
    }
  }
  return out;
}

export function BridgeMap() {
  const grid = dots();
  return (
    <figure className="relative" aria-label="Ilustración: rutas de atletas desde Europa hacia universidades de la NCAA">
      <svg viewBox="0 0 800 460" className="h-auto w-full" role="img" aria-labelledby="bridge-title">
        <title id="bridge-title">Rutas ilustrativas de atletas europeos hacia la NCAA</title>
        <defs>
          <linearGradient id="route" x1="1" x2="0">
            <stop offset="0" stopColor="#e6cf8f" stopOpacity="0.95" />
            <stop offset="1" stopColor="#e6cf8f" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="glow"><stop offset="0" stopColor="#e6cf8f" stopOpacity="0.55" /><stop offset="1" stopColor="#e6cf8f" stopOpacity="0" /></radialGradient>
        </defs>
        {grid.map((d) => <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="1.6" fill="#f4efe4" opacity={d.o} />)}
        <text x="400" y="404" textAnchor="middle" className="fill-paper/30 text-[11px] uppercase tracking-[0.4em]">Atlántico</text>
        {ROUTES.map(([e, u], i) => {
          const a = EU[e]; const b = US[u];
          const mx = (a.x + b.x) / 2; const my = Math.min(a.y, b.y) - 120 - (i % 3) * 18;
          const d = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="url(#route)" strokeWidth="1.2" opacity="0.5" />
              <path d={d} fill="none" stroke="#e6cf8f" strokeWidth="2" strokeLinecap="round" className="route-flow" style={{ animationDelay: `${i * 0.55}s` }} />
            </g>
          );
        })}
        {US.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="18" fill="url(#glow)" />
            <circle cx={p.x} cy={p.y} r="4" fill="#e6cf8f" />
            <text x={p.x - 10} y={p.y + 4} textAnchor="end" className="fill-paper text-[14px] font-semibold">{p.name}</text>
          </g>
        ))}
        {EU.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="3.2" fill="#f4efe4" className="city-pulse" />
            <text x={p.x + 8} y={p.y + 4} className="fill-paper/80 text-[13px]">{p.name}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Tarjeta compacta del Passport que flota sobre el mapa (atleta ficticia). */
export function BridgePassport({ className = '' }: { className?: string }) {
  return (
    <div className={`bridge-card w-[290px] rounded-2xl border border-brass/40 bg-night/85 p-5 shadow-[var(--shadow-premium)] backdrop-blur-md ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brass">Gala Passport</span>
        <span className="rounded-full border border-ok/40 px-2 py-0.5 text-[10px] font-semibold text-ok">Verificado</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brass font-display text-lg text-night" aria-hidden>LM</span>
        <div>
          <p className="font-display text-2xl leading-none text-paper">Lucía M.</p>
          <p className="mt-1 text-xs text-muted">Base · Valencia → NCAA D-I</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 border-y border-line py-3 text-center">
        <div><dt className="text-[10px] uppercase tracking-wider text-faint">Puntos</dt><dd className="font-display text-xl text-paper">14,2</dd></div>
        <div className="border-x border-line"><dt className="text-[10px] uppercase tracking-wider text-faint">Nota</dt><dd className="font-display text-xl text-paper">8,7</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wider text-faint">Inglés</dt><dd className="font-display text-xl text-paper">C1</dd></div>
      </dl>
      <p className="mt-3 flex items-center justify-between text-xs"><span className="text-muted">Encaje con 3 programas</span><span className="font-semibold text-brass">Alto</span></p>
      <p className="mt-1 flex items-center justify-between text-xs"><span className="text-muted">Agente</span><span className="text-paper">Norte Sports</span></p>
      <p className="mt-3 text-[10px] text-faint">Ejemplo ilustrativo · atleta ficticia</p>
    </div>
  );
}
