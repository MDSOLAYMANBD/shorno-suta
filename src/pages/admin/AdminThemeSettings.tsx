import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import ThemeColorManager from '@/components/admin/ThemeColorManager';

export default function AdminThemeSettings() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/site-editor')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">🎨 থিম কালার</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ThemeColorManager />
        </CardContent>
      </Card>
    </div>
  );
}
