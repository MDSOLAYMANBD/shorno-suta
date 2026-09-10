import { Card, CardContent } from '@/components/ui/card';
import type { VitalMetric } from '@/hooks/useWebVitals';

interface WebVitalsCardProps {
  metric: VitalMetric | null;
  label: string;
  unit: string;
  description: string;
}

const ratingColors = {
  good: 'text-green-600 bg-green-50 border-green-200',
  'needs-improvement': 'text-amber-600 bg-amber-50 border-amber-200',
  poor: 'text-red-600 bg-red-50 border-red-200',
};

export default function WebVitalsCard({ metric, label, unit, description }: WebVitalsCardProps) {
  const rating = metric?.rating || 'good';
  const colors = ratingColors[rating];

  return (
    <Card className={`border ${metric ? colors.split(' ')[2] : 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {metric && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors}`}>
              {rating === 'good' ? 'Good' : rating === 'needs-improvement' ? 'Improve' : 'Poor'}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold">
          {metric ? (
            <>
              {metric.name === 'CLS' ? metric.value.toFixed(3) : Math.round(metric.value)}
              <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-base">পরিমাপ হচ্ছে...</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
