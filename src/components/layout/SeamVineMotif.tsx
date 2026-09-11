/**
 * A gold branch that enters from off-screen at the page edge and arcs
 * diagonally across the maroon→white seam, leaves trailing along it — as if
 * a tree branch drifted in from outside the frame and settled across the
 * boundary, swaying gently. No visible "cut" base: the stem starts flush at
 * the viewport edge (and well inside the maroon band) so it reads as
 * continuing beyond the frame, not planted. Two distinct silhouettes
 * (variant "a" / "b") are used left vs right so the pair doesn't read as one
 * shape mirrored — each has its own curve and leaf rhythm.
 */
export default function SeamVineMotif({
  className,
  mirrored,
  animationClass,
  variant = 'a',
}: {
  className: string;
  mirrored?: boolean;
  animationClass?: string;
  variant?: 'a' | 'b';
}) {
  const leaf = (cx: number, cy: number, rot: number, scale: number) => (
    <g transform={`translate(${cx},${cy}) rotate(${rot}) scale(${scale})`}>
      <path
        d="M0,2 C 4,-3 6,-11 11,-20 C 16,-29 15,-41 8,-50 C 4,-55 0,-57 0,-57 C 0,-57 -5,-54 -9,-48 C -15,-39 -15,-28 -11,-19 C -7,-10 -4,-3 0,2 Z"
        fill="url(#seam-leaf-fill)"
        stroke="hsl(var(--accent))"
        strokeWidth="1"
      />
      <path d="M0,0 C 1,-15 1,-31 -1,-41 C -2,-47 0,-53 0,-56" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M-1,-13 C 3,-17 6,-19 9,-23" fill="none" stroke="hsl(var(--accent))" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
      <path d="M-1,-23 C 2,-27 5,-29 7,-32" fill="none" stroke="hsl(var(--accent))" strokeWidth="0.6" strokeLinecap="round" opacity="0.45" />
      <path d="M-1,-13 C -5,-16 -8,-17 -10,-20" fill="none" stroke="hsl(var(--accent))" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
      <path d="M-1,-31 C -4,-34 -6,-35 -8,-38" fill="none" stroke="hsl(var(--accent))" strokeWidth="0.55" strokeLinecap="round" opacity="0.4" />
    </g>
  );

  const bud = (cx: number, cy: number, scale: number) => (
    <circle cx={cx} cy={cy} r={4 * scale} fill="hsl(var(--primary))" stroke="hsl(var(--accent))" strokeWidth="0.8" />
  );

  const tendril = (cx: number, cy: number, rot: number, scale: number) => (
    <path
      d="M0,0 C 6,-3 9,-9 5,-14 C 1,-19 -5,-17 -5,-12 C -5,-8 -1,-7 1,-9"
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth="1.1"
      strokeLinecap="round"
      opacity="0.75"
      transform={`translate(${cx},${cy}) rotate(${rot}) scale(${scale})`}
    />
  );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 -40 220 260"
      className={className}
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    >
      <defs>
        <linearGradient id="seam-leaf-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.75)" />
        </linearGradient>
      </defs>
      {variant === 'a' ? (
        <g className={animationClass} style={{ transformOrigin: '0px 220px' }}>
          {/* meandering, zigzagging climb — bends back on itself a few times
              rather than one smooth diagonal sweep, like a vine reaching for
              light, curling into a small hook at the very tip */}
          <path
            d="M-6,228 C 12,198 48,188 38,158 C 28,128 -6,118 14,90 C 30,64 68,58 58,30 C 50,8 65,-8 92,-12 C 106,-14 110,-2 97,5"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {leaf(18, 208, -50, 0.7)}
          {leaf(40, 168, 42, 1.05)}
          {leaf(12, 140, -35, 0.85)}
          {leaf(18, 95, 48, 1.1)}
          {leaf(46, 65, -40, 0.95)}
          {leaf(63, 34, 36, 1.0)}
          {leaf(86, 6, -25, 0.75)}
          {leaf(96, -9, 30, 0.5)}
          {bud(26, 150, 0.7)}
          {bud(36, 80, 0.6)}
          {bud(71, 16, 0.55)}
          {tendril(10, 112, -20, 0.8)}
          {tendril(56, 46, 30, 0.7)}
          {tendril(91, 20, -15, 0.6)}
        </g>
      ) : (
        <g className={animationClass} style={{ transformOrigin: '220px 220px' }}>
          {/* one wide, easy S-sweep — a single full wave before the long
              exit, reads as a different plant, not a mirrored copy of
              variant "a". Authored directly in its final (already-mirrored)
              orientation — root at the right so it hugs that true edge —
              rather than relying on a CSS scaleX(-1) flip, which combined
              with the parent's overflow-hidden clip left the root visible
              well short of the edge instead of exiting behind it. */}
          <path
            d="M165,-5 C 190,5 210,25 205,50 C 200,72 162,80 160,110 C 156,150 210,190 226,228"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {leaf(160, -8, -30, 0.5)}
          {leaf(180, 15, 35, 0.85)}
          {leaf(210, 45, -40, 1.0)}
          {leaf(196, 68, 30, 0.85)}
          {leaf(162, 105, -42, 1.05)}
          {leaf(150, 132, 25, 0.8)}
          {leaf(184, 166, -35, 0.9)}
          {leaf(214, 202, 40, 0.65)}
          {bud(202, 30, 0.55)}
          {bud(170, 92, 0.6)}
          {bud(204, 178, 0.6)}
          {tendril(186, 0, 18, 0.6)}
          {tendril(154, 122, -26, 0.7)}
          {tendril(208, 212, 20, 0.8)}
        </g>
      )}
    </svg>
  );
}
