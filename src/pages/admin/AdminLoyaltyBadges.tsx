import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import LoyaltyTiersSettings from '@/components/admin/LoyaltyTiersSettings';

export default function AdminLoyaltyBadges() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">👑 কাস্টমার লয়্যালটি বাজ</h1>
      </div>
      <LoyaltyTiersSettings />
    </div>
  );
}
