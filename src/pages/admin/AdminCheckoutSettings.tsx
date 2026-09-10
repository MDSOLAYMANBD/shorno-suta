import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import CheckoutFieldsSettings from '@/components/admin/CheckoutFieldsSettings';

export default function AdminCheckoutSettings() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/site-editor')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">🛒 চেকআউট ফিল্ড ও শিপিং</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CheckoutFieldsSettings />
        </CardContent>
      </Card>
    </div>
  );
}
