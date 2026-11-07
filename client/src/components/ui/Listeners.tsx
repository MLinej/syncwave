// Three little friends sharing a song: the landing-page illustration.
const OUTLINE = "#1d1d1b";

/** One little listener: a round body, headphones, closed happy eyes, rosy cheeks. */
function Listener({ cx, cy, r, color, delay }: { cx: number; cy: number; r: number; color: string; delay: number }) {
  const eye = r * 0.32;
  return (
    <g className="bob" style={{ animationDelay: `${delay}s` }}>
      {/* body — a soft bean: round head, gently rounded feet */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy + r * 1.05} Q ${cx + r} ${cy + r * 1.45} ${cx + r * 0.55} ${cy + r * 1.45} L ${cx - r * 0.55} ${cy + r * 1.45} Q ${cx - r} ${cy + r * 1.45} ${cx - r} ${cy + r * 1.05} Z`}
        fill={color}
        stroke={OUTLINE}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* headphone band + cups */}
      <path d={`M ${cx - r - 0.6} ${cy + 0.5} A ${r + 1.4} ${r + 1.4} 0 0 1 ${cx + r + 0.6} ${cy + 0.5}`} fill="none" stroke={OUTLINE} strokeWidth="2.6" strokeLinecap="round" />
      <path d={`M ${cx - r - 0.6} ${cy + 0.5} A ${r + 1.4} ${r + 1.4} 0 0 1 ${cx + r + 0.6} ${cy + 0.5}`} fill="none" stroke="#b9b9b9" strokeWidth="1.1" strokeLinecap="round" />
      <rect x={cx - r - 3.2} y={cy - 2.6} width="4.6" height="8" rx="2.2" fill="#3a3a3d" stroke={OUTLINE} strokeWidth="1.1" />
      <rect x={cx + r - 1.4} y={cy - 2.6} width="4.6" height="8" rx="2.2" fill="#3a3a3d" stroke={OUTLINE} strokeWidth="1.1" />
      {/* closed happy eyes */}
      <path d={`M ${cx - eye - 1.6} ${cy + 1} q 1.6 -1.9 3.2 0`} fill="none" stroke={OUTLINE} strokeWidth="1.1" strokeLinecap="round" />
      <path d={`M ${cx + eye - 1.6} ${cy + 1} q 1.6 -1.9 3.2 0`} fill="none" stroke={OUTLINE} strokeWidth="1.1" strokeLinecap="round" />
      {/* cheeks + smile */}
      <ellipse cx={cx - eye - 1.4} cy={cy + 4} rx="1.7" ry="1" fill="#ff8f8f" opacity="0.55" />
      <ellipse cx={cx + eye + 1.4} cy={cy + 4} rx="1.7" ry="1" fill="#ff8f8f" opacity="0.55" />
      <path d={`M ${cx - 1.6} ${cy + 3.6} q 1.6 1.8 3.2 0`} fill="none" stroke={OUTLINE} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

/** Music note glyph that drifts up and fades. */
function Note({ x, y, delay, double = false }: { x: number; y: number; delay: number; double?: boolean }) {
  return (
    <g className="note-float" style={{ animationDelay: `${delay}s` }} fill="var(--accent)">
      {double ? (
        <path d={`M ${x} ${y} v -6 l 5 -1.4 v 6 M ${x} ${y - 6} l 5 -1.4`} stroke="var(--accent)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M ${x} ${y} v -6 q 2 0.4 3 2.2`} stroke="var(--accent)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      )}
      <ellipse cx={x - 1.1} cy={y} rx="1.5" ry="1.1" transform={`rotate(-20 ${x - 1.1} ${y})`} />
      {double && <ellipse cx={x + 3.9} cy={y - 1.4} rx="1.5" ry="1.1" transform={`rotate(-20 ${x + 3.9} ${y - 1.4})`} />}
    </g>
  );
}

/** The group on its own, nodding along with notes drifting up. `width` in px. */
export default function ListeningFriends({ width }: { width: number }) {
  return (
    <svg viewBox="6 4 88 62" width={width} height={(width * 62) / 88} className="mx-auto block overflow-visible" aria-hidden="true">
      {/* soft spotlight behind the group */}
      <ellipse cx="50" cy="46" rx="44" ry="22" fill="var(--accent)" opacity="0.1" />
      <Note x={22} y={20} delay={0} />
      <Note x={50} y={14} delay={1.1} double />
      <Note x={76} y={22} delay={2.2} />
      <Listener cx={27} cy={44} r={11} color="#e9967a" delay={0.2} />
      <Listener cx={73} cy={44} r={11} color="#7fb8a4" delay={0.5} />
      <Listener cx={50} cy={38} r={13} color="#f2c35b" delay={0} />
      {/* a soft shadow so they stand on something */}
      <ellipse cx="50" cy="61" rx="34" ry="1.6" fill="#000" opacity="0.35" />
    </svg>
  );
}
