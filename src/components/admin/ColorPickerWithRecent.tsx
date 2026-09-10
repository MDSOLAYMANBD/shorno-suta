import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

const STORAGE_KEY = 'lp_recent_colors';
const MAX_RECENT = 10;

function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentColor(color: string) {
  const colors = getRecentColors().filter(c => c.toLowerCase() !== color.toLowerCase());
  colors.unshift(color);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.slice(0, MAX_RECENT)));
}

interface Props {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export default function ColorPickerWithRecent({ value, onChange }: Props) {
  const [recentColors, setRecentColors] = useState<string[]>(getRecentColors);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setRecentColors(getRecentColors());
  }, []);

  const handleChange = (color: string) => {
    onChange(color);
  };

  const handleBlur = () => {
    if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
      saveRecentColor(value);
      setRecentColors(getRecentColors());
    }
  };

  const handleSelect = (color: string) => {
    handleChange(color);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors w-full text-left"
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-border shrink-0"
            style={{ backgroundColor: value || '#000000' }}
          />
          <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate font-mono">
            {value || 'কালার বাছাই করুন'}
          </span>
          <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start">
        <div className="flex gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="h-10 w-12 rounded border border-input cursor-pointer"
          />
          <Input
            value={value || ''}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="flex-1 text-xs font-mono"
            placeholder="#000000"
          />
        </div>
        {recentColors.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">রিসেন্ট:</span>
            <div className="flex flex-wrap gap-1.5">
              {recentColors.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-6 h-6 rounded-full border-2 border-border hover:border-primary transition-colors hover:scale-110"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
