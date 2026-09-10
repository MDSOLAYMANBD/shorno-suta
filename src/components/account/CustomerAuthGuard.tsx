import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { ShoppingBag } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export default function CustomerAuthGuard({ children }: Props) {
  const { user, loading } = useCustomerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/account/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary/20 via-primary/40 to-primary/20 animate-spin" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-wide">স্বর্ণ সুতা</p>
          <p className="text-xs text-muted-foreground">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
