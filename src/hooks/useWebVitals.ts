import { useEffect, useState, useCallback } from 'react';

export interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface WebVitalsData {
  lcp: VitalMetric | null;
  cls: VitalMetric | null;
  inp: VitalMetric | null;
  score: number; // 0-100 estimated score
}

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
  };
  const [good, poor] = thresholds[name] || [0, 0];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function calculateScore(vitals: WebVitalsData): number {
  const scores: number[] = [];

  if (vitals.lcp) {
    const v = vitals.lcp.value;
    if (v <= 1200) scores.push(100);
    else if (v <= 2500) scores.push(90 - ((v - 1200) / 1300) * 20);
    else if (v <= 4000) scores.push(70 - ((v - 2500) / 1500) * 20);
    else scores.push(Math.max(10, 50 - ((v - 4000) / 4000) * 40));
  }

  if (vitals.cls) {
    const v = vitals.cls.value;
    if (v <= 0.05) scores.push(100);
    else if (v <= 0.1) scores.push(90);
    else if (v <= 0.25) scores.push(70);
    else scores.push(Math.max(10, 50 - v * 100));
  }

  if (vitals.inp) {
    const v = vitals.inp.value;
    if (v <= 100) scores.push(100);
    else if (v <= 200) scores.push(85);
    else if (v <= 500) scores.push(60);
    else scores.push(Math.max(10, 40));
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function useWebVitals() {
  const [vitals, setVitals] = useState<WebVitalsData>({
    lcp: null,
    cls: null,
    inp: null,
    score: 0,
  });

  const measure = useCallback(async () => {
    try {
      const { onLCP, onCLS, onINP } = await import('web-vitals');

      const update = (partial: Partial<WebVitalsData>) => {
        setVitals(prev => {
          const next = { ...prev, ...partial };
          next.score = calculateScore(next);
          return next;
        });
      };

      onLCP(metric => {
        update({ lcp: { name: 'LCP', value: metric.value, rating: getRating('LCP', metric.value) } });
      });

      onCLS(metric => {
        update({ cls: { name: 'CLS', value: metric.value, rating: getRating('CLS', metric.value) } });
      });

      onINP(metric => {
        update({ inp: { name: 'INP', value: metric.value, rating: getRating('INP', metric.value) } });
      });
    } catch (err) {
      console.warn('Web Vitals not available:', err);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [measure]);

  return vitals;
}
