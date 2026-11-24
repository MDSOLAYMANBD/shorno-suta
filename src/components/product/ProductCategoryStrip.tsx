import { useNavigate } from 'react-router-dom';
import { Check, LayoutGrid } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { trNow, nameNow } from '@/lib/i18n';

interface Props {
  currentCategoryId?: string | null;
}

export default function ProductCategoryStrip({ currentCategoryId }: Props) {
  const { data: categories } = useCategories();
  const navigate = useNavigate();
  const list = (categories || []).filter((c: any) => !c.parent_id);
  if (list.length === 0) return null;

  // Put current category first
  const sorted = [...list].sort((a: any, b: any) => {
    if (a.id === currentCategoryId) return -1;
    if (b.id === currentCategoryId) return 1;
    return 0;
  });

  return (
    <section className="mt-8 sm:mt-12">
      <div className="flex items-center gap-2 mb-3">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <h2 className="text-base sm:text-lg font-bold">{trNow('আরও ক্যাটাগরি ঘুরে দেখুন', 'More categories')}</h2>
      </div>
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap sm:overflow-visible">
          {sorted.map((cat: any) => {
            const isCurrent = cat.id === currentCategoryId;
            const label = nameNow(cat.name_bn, cat.name);
            return (
              <button
                key={cat.id}
                onClick={() => navigate(`/shop/${cat.slug}`)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                  isCurrent
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary shadow-md hover:shadow-lg'
                    : 'bg-background text-foreground border-border hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-sm'
                }`}
                aria-label={trNow(`${label} ক্যাটাগরি দেখুন`, `See ${label}`)}
              >
                {isCurrent && <Check className="h-3.5 w-3.5" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
