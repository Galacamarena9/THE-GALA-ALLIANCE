/**
 * La alianza: el atleta en el centro y cada actor conectado a él. El agente es el nodo que mueve la red.
 * Cada conexión dice qué viaja por ella. Ilustrativo y accesible: la misma información va en la lista de abajo.
 */
const NODES = [
  { key: 'agente', label: 'Agente', x: 500, y: 92, flow: 'Lleva el proceso', lead: true },
  { key: 'universidad', label: 'Universidad NCAA', x: 860, y: 230, flow: 'Becas y ofertas' },
  { key: 'club', label: 'Club europeo', x: 790, y: 470, flow: 'Datos confirmados' },
  { key: 'familia', label: 'Familia', x: 210, y: 470, flow: 'Consentimiento y coste real' },
  { key: 'academia', label: 'Academia', x: 140, y: 230, flow: 'Pruebas y formación' },
] as const;

export function AllianceNetwork() {
  const c = { x: 500, y: 300 };
  return (
    <div>
      <svg viewBox="0 0 1000 560" className="h-auto w-full" aria-hidden>
        <circle cx={c.x} cy={c.y} r="210" fill="none" stroke="#f4efe4" strokeOpacity="0.06" />
        <circle cx={c.x} cy={c.y} r="130" fill="none" stroke="#f4efe4" strokeOpacity="0.08" strokeDasharray="2 6" />
        {NODES.map((n, i) => (
          <g key={n.key}>
            <line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke={'lead' in n ? '#e6cf8f' : '#f4efe4'} strokeOpacity={'lead' in n ? 0.8 : 0.22} strokeWidth={'lead' in n ? 2 : 1} />
            <line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke="#e6cf8f" strokeWidth="2.4" strokeLinecap="round" className="route-flow" style={{ animationDelay: `${i * 0.7}s` }} />
            <text x={(c.x + n.x) / 2} y={(c.y + n.y) / 2 - 10} textAnchor="middle" className="fill-paper/70 text-[19px] italic" style={{ fontFamily: 'var(--font-serif)' }}>{n.flow}</text>
          </g>
        ))}
        {/* Nodos */}
        {NODES.map((n) => (
          <g key={`${n.key}-n`}>
            <circle cx={n.x} cy={n.y} r={'lead' in n ? 46 : 34} fill="#0b0d12" stroke={'lead' in n ? '#e6cf8f' : '#3a4050'} strokeWidth={'lead' in n ? 2 : 1} />
            {'lead' in n && <circle cx={n.x} cy={n.y} r="58" fill="none" stroke="#e6cf8f" strokeOpacity="0.35" className="node-ring" />}
            <text x={n.x} y={n.y + ('lead' in n ? 76 : 60)} textAnchor="middle" className={'lead' in n ? 'fill-brass text-[28px] uppercase' : 'fill-paper text-[24px] uppercase'} style={{ fontFamily: 'var(--font-display)' }}>{n.label}</text>
          </g>
        ))}
        <circle cx={c.x} cy={c.y} r="64" fill="#e6cf8f" />
        <text x={c.x} y={c.y + 10} textAnchor="middle" className="fill-night text-[30px] uppercase" style={{ fontFamily: 'var(--font-display)' }}>Atleta</text>
      </svg>
      <ul className="sr-only">
        {NODES.map((n) => <li key={n.key}>{n.label}: {n.flow}</li>)}
      </ul>
    </div>
  );
}
