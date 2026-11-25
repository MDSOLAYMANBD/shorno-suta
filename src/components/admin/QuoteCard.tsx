// The day's motivational quote at the top of the dashboard (it was on the staff profile's header):
// a tap brings the next one, the heart keeps it in the signed-in person's saved quotes (their
// profile → সেটিংস → সেভ করা উক্তি).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Quote, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getRandomQuote, type Quote as QuoteType } from '@/lib/motivationalQuotes';

export default function QuoteCard({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>();
  const [current, setCurrent] = useState(() => getRandomQuote());
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user.id));
  }, []);

  // the same list the profile's settings show
  const { data: saved = [] } = useQuery({
    queryKey: ['saved-quotes', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles' as never)
        .select('saved_quotes')
        .eq('user_id', userId!)
        .maybeSingle();
      return ((data as { saved_quotes?: QuoteType[] } | null)?.saved_quotes || []) as QuoteType[];
    },
    enabled: !!userId,
  });
  const isSaved = saved.some((q) => q.quote === current.quote.quote);

  const next = () => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrent(getRandomQuote());
      setFadeIn(true);
    }, 300);
  };

  const save = async () => {
    if (isSaved) {
      toast.info('এই উক্তি আগেই সেভ করা আছে');
      return;
    }
    if (!userId) return;
    const { error } = await supabase
      .from('employee_profiles' as never)
      .update({ saved_quotes: [...saved, current.quote] } as never)
      .eq('user_id', userId);
    if (error) {
      toast.error('আপডেট ব্যর্থ');
      return;
    }
    toast.success('উক্তি সেভ হয়েছে ❤️');
    queryClient.invalidateQueries({ queryKey: ['saved-quotes', userId] });
  };

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={next}
        onKeyDown={(e) => e.key === 'Enter' && next()}
        title={'ক্লিক করলে নতুন উক্তি আসবে'}
        className={cn(
          'relative min-w-0 flex-1 cursor-pointer select-none rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.07] via-card to-card py-3.5 pl-11 pr-4 shadow-sm',
          fadeIn ? 'animate-quote-in' : 'animate-quote-out',
        )}
      >
        <Quote className="absolute left-4 top-4 h-5 w-5 text-primary/30" />
        <p className="font-serif text-base italic leading-relaxed text-foreground/85 md:text-lg">{current.quote.quote}</p>
        <p className="mt-1 text-sm font-semibold text-primary">— {current.quote.author}</p>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-1.5">
        <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={next} title={'নতুন উক্তি'}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className={cn('h-9 w-9 rounded-xl', isSaved && 'text-red-500')}
          onClick={save}
          title={isSaved ? 'সেভ করা আছে' : 'সেভ করুন'}
        >
          <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} />
        </Button>
      </div>
    </div>
  );
}
