import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, ShoppingBag, DollarSign, MessageCircle, Tag } from 'lucide-react';

interface CustomerInfo {
  customer_name: string;
  customer_phone: string;
  platform: string;
  tags: string[];
  total_orders?: number;
  total_spent?: number;
}

interface CustomerProfilePanelProps {
  customer: CustomerInfo | null;
}

export default function CustomerProfilePanel({ customer }: CustomerProfilePanelProps) {
  if (!customer) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4">
        কথোপকথন নির্বাচন করুন
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 border-l h-full overflow-y-auto">
      {/* Avatar & Name */}
      <div className="text-center">
        <Avatar className="h-16 w-16 mx-auto mb-2">
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {customer.customer_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-sm">{customer.customer_name || 'অজানা'}</h3>
        {customer.customer_phone && (
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <Phone className="h-3 w-3" /> {customer.customer_phone}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="shadow-none">
          <CardContent className="p-3 text-center">
            <ShoppingBag className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{customer.total_orders ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">অর্ডার</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">৳{(customer.total_spent ?? 0).toLocaleString('bn-BD')}</p>
            <p className="text-[10px] text-muted-foreground">মোট খরচ</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <MessageCircle className="h-3 w-3" /> প্ল্যাটফর্ম
        </p>
        <Badge variant="secondary" className="capitalize">{customer.platform}</Badge>
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Tag className="h-3 w-3" /> ট্যাগ
        </p>
        <div className="flex flex-wrap gap-1">
          {(customer.tags || []).length === 0 ? (
            <span className="text-xs text-muted-foreground">কোনো ট্যাগ নেই</span>
          ) : (
            customer.tags.map(t => (
              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
