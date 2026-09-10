import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Tag, X, Loader2 } from 'lucide-react';

interface CouponResult {
  code: string;
  discount: number;
  discount_type: string;
  discount_value: number;
}

interface CouponApplyProps {
  subtotal: number;
  onApply: (result: CouponResult | null) => void;
  applied: CouponResult | null;
  /** Optional accent color for landing pages */
  accentColor?: string;
}

export default function CouponApply({ subtotal, onApply, applied, accentColor }: CouponApplyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoApplied, setAutoApplied] = useState(false);

  // Auto-apply coupon from localStorage (activated from profile)
  useEffect(() => {
    if (applied || autoApplied) return;
    const savedCode = localStorage.getItem('active_coupon');
    if (savedCode) {
      setAutoApplied(true);
      setCode(savedCode);
      // Trigger apply after a small delay so component is mounted
      setTimeout(() => {
        applyCode(savedCode);
      }, 500);
    }
  }, [applied, autoApplied]);

  const applyCode = async (codeToApply: string) => {
    const trimmed = codeToApply.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_coupon_code', {
        _code: trimmed,
        _subtotal: subtotal,
      });

      if (rpcError) throw rpcError;

      const result = data as { valid: boolean; error?: string; code?: string; discount?: number; discount_type?: string; discount_value?: number };

      if (!result?.valid) {
        setError(result?.error || 'কুপন কোডটি সঠিক নয়');
        localStorage.removeItem('active_coupon');
        setLoading(false);
        return;
      }

      onApply({
        code: result.code!,
        discount: result.discount!,
        discount_type: result.discount_type!,
        discount_value: result.discount_value!,
      });
      setCode('');
      localStorage.removeItem('active_coupon');
    } catch {
      setError('কুপন চেক করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">
            <Badge variant="secondary" className="text-[10px] mr-1.5">{applied.code}</Badge>
            {applied.discount_type === 'percentage'
              ? `${applied.discount_value}% ছাড়`
              : `৳${applied.discount_value} ছাড়`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">-৳{applied.discount}</span>
          <button
            type="button"
            onClick={() => onApply(null)}
            className="p-0.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            placeholder="কুপন কোড"
            className="h-9 pl-8 text-xs rounded-lg uppercase"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCode(code))}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => applyCode(code)}
          disabled={loading || !code.trim()}
          className="h-9 text-xs rounded-lg px-3"
          style={accentColor ? { borderColor: accentColor, color: accentColor } : {}}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'প্রয়োগ'}
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
