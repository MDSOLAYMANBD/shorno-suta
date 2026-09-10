import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Phone, StickyNote, Plus } from 'lucide-react';

interface CustomerCardProps {
  customer: any;
  tags: any[];
  onAddTag: (customerId: string) => void;
  onViewNotes: (customerId: string) => void;
}

export default function CustomerCard({ customer, tags, onAddTag, onViewNotes }: CustomerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {customer.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm truncate">{customer.name}</h4>
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <ShoppingBag className="h-3 w-3" /> {customer.total_orders}
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> {customer.phone}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              মোট: ৳{Number(customer.total_spent || 0).toLocaleString('bn-BD')}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((t: any) => (
                <Badge
                  key={t.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{ borderColor: t.tag_color, color: t.tag_color }}
                >
                  {t.tag_name}
                </Badge>
              ))}
              <button
                onClick={() => onAddTag(customer.id)}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                <Plus className="h-2.5 w-2.5" /> ট্যাগ
              </button>
            </div>

            {/* Actions */}
            <div className="mt-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onViewNotes(customer.id)}>
                <StickyNote className="h-3 w-3 mr-1" /> নোট
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
