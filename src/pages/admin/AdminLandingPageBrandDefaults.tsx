import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import LandingPageBrandDefaults from '@/components/admin/LandingPageBrandDefaults';

export default function AdminLandingPageBrandDefaults() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/landing-pages"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">ব্র্যান্ড ডিফল্ট সেটিংস</h1>
      </div>
      <LandingPageBrandDefaults />
    </div>
  );
}
