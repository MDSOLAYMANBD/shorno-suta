import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  url: string;
  durationMs?: number | null;
  variant?: 'visitor' | 'staff' | 'ai';
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function VoiceMessage({ url, durationMs, variant = 'visitor' }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('loadedmetadata', onMeta);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const isVisitor = variant === 'visitor';

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        onClick={toggle}
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95',
          isVisitor ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn('h-1.5 rounded-full overflow-hidden', isVisitor ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20')}>
          <div
            className={cn('h-full rounded-full transition-[width] duration-100', isVisitor ? 'bg-primary-foreground' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={cn('text-[10px] mt-0.5 tabular-nums', isVisitor ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {fmt((playing ? progress : duration) * 1000)}
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
