
interface PerformanceGaugeProps {
  score: number; // 0-100
  size?: number;
}

export default function PerformanceGauge({ score, size = 160 }: PerformanceGaugeProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;

  // Status colours (good / warning / bad) ride the ring; the number stays in text ink
  // and the word under it says the state, so colour never carries it alone.
  const color =
    score >= 90 ? 'var(--status-good)' :
    score >= 50 ? 'var(--status-warning)' :
    'var(--status-critical)';

  const label =
    score >= 90 ? 'চমৎকার' :
    score >= 50 ? 'উন্নতি দরকার' :
    'দুর্বল';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeOpacity={0.18}
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-4xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
