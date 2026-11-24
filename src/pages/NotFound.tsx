import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { trNow } from '@/lib/i18n';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{trNow('৪০৪', '404')}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{trNow('পেজ পাওয়া যায়নি', 'Page not found')}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {trNow('হোম পেজে যান', 'Go to the home page')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
