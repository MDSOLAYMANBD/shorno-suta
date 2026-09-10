import { useCallback, useRef, useState } from 'react';
import { checkMicCapability, micErrorMessage } from '@/lib/browserCapability';

export interface VoiceRecording {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

const MAX_DURATION_MS = 60_000; // 60 sec cap

function pickMimeType(): string {
  // iOS Safari prefers mp4; modern browsers use webm/opus
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class MicError extends Error {
  constructor(message: string, public reason?: string) {
    super(message);
    this.name = 'MicError';
  }
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef = useRef<((r: VoiceRecording | null) => void) | null>(null);

  const cleanup = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setElapsedMs(0);
  };

  const start = useCallback(async (): Promise<void> => {
    if (recording) return;
    const cap = await checkMicCapability();
    if (!cap.ok) {
      throw new MicError(cap.message || 'মাইক্রোফোন উপলব্ধ নেই', cap.reason);
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        } as MediaTrackConstraints,
      });
    } catch (err: any) {
      console.error('[voice] getUserMedia failed:', err?.name, err?.message, err);
      throw new MicError(micErrorMessage(err), err?.name);
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
      : new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const dur = Date.now() - startTsRef.current;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || 'audio/webm' });
      const result: VoiceRecording | null = blob.size > 200 ? { blob, durationMs: dur, mimeType: blob.type } : null;
      cleanup();
      resolveRef.current?.(result);
      resolveRef.current = null;
    };
    recorderRef.current = rec;
    startTsRef.current = Date.now();
    rec.start(100);
    setRecording(true);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startTsRef.current), 100);
    stopTimeoutRef.current = setTimeout(() => { stop(); }, MAX_DURATION_MS);
  }, [recording]);

  const stop = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') { resolve(null); cleanup(); return; }
      resolveRef.current = resolve;
      try { rec.stop(); } catch { resolve(null); cleanup(); }
    });
  }, []);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } }
    chunksRef.current = [];
    resolveRef.current?.(null);
    resolveRef.current = null;
    cleanup();
  }, []);

  return { recording, elapsedMs, start, stop, cancel };
}
