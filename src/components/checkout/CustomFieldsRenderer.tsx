import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CustomFieldConfig } from '@/hooks/useCheckoutConfig';

interface Props {
  fields: CustomFieldConfig[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  compact?: boolean;
}

/** Renders dynamic custom checkout fields configured in admin → Checkout Fields. */
export default function CustomFieldsRenderer({ fields, values, onChange, className, inputClassName, labelClassName, compact }: Props) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className={className || 'space-y-3'}>
      {fields.map(f => (
        <div key={f.id}>
          <Label className={labelClassName || (compact ? 'text-xs font-medium mb-1 block' : 'text-sm font-medium mb-1.5 block')}>
            {f.label}{f.required ? ' *' : ''}
          </Label>
          {f.type === 'textarea' ? (
            <Textarea
              value={values[f.id] || ''}
              onChange={e => onChange(f.id, e.target.value)}
              placeholder={f.placeholder || ''}
              required={f.required}
              rows={2}
              className={inputClassName || 'rounded-lg border-primary/20'}
            />
          ) : (
            <Input
              type={f.type === 'number' ? 'number' : 'text'}
              value={values[f.id] || ''}
              onChange={e => onChange(f.id, e.target.value)}
              placeholder={f.placeholder || ''}
              required={f.required}
              className={inputClassName || (compact ? 'rounded-lg h-9 text-sm' : 'rounded-lg border-primary/20')}
            />
          )}
        </div>
      ))}
    </div>
  );
}
