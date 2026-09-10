import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export interface AudienceFilter {
  scope: 'all' | 'lead_score' | 'platform';
  lead_score?: 'hot' | 'medium' | 'cold';
  platform?: 'whatsapp' | 'messenger' | 'instagram' | 'website';
}

interface Props {
  value: AudienceFilter;
  onChange: (v: AudienceFilter) => void;
  estimatedSize: number;
}

export default function AudienceSelector({ value, onChange, estimatedSize }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">অডিয়েন্স</Label>
      <Select value={value.scope} onValueChange={(v: any) => onChange({ scope: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল কাস্টমার</SelectItem>
          <SelectItem value="lead_score">লিড স্কোর অনুযায়ী</SelectItem>
          <SelectItem value="platform">প্ল্যাটফর্ম অনুযায়ী</SelectItem>
        </SelectContent>
      </Select>

      {value.scope === 'lead_score' && (
        <Select value={value.lead_score || 'hot'} onValueChange={(v: any) => onChange({ ...value, lead_score: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="cold">⚪ Cold</SelectItem>
          </SelectContent>
        </Select>
      )}

      {value.scope === 'platform' && (
        <Select value={value.platform || 'whatsapp'} onValueChange={(v: any) => onChange({ ...value, platform: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="website">Website</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Badge variant="outline" className="text-xs">
        আনুমানিক: {estimatedSize} জন
      </Badge>
    </div>
  );
}
