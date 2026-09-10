import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Mic, Sparkles, User as UserIcon, Phone } from 'lucide-react';
import VoiceMessage from './VoiceMessage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RichChatBubbleProps {
  message: string;
  senderType: 'visitor' | 'staff' | 'ai';
  senderName: string;
  senderAvatar?: string | null;
  createdAt: string;
  isWelcome?: boolean;
  imageUrl?: string | null;
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
  metadata?: any;
}

/**
 * Admin-side rich chat bubble: renders the same metadata-aware UI the
 * customer widget uses (product cards with sale prices, order card, address
 * card, call event log, quick replies). Used in AdminLiveChat so admins see
 * exactly what the customer sees.
 */
export default function RichChatBubble({
  message,
  senderType,
  senderName,
  senderAvatar,
  createdAt,
  isWelcome,
  imageUrl,
  voiceUrl,
  voiceDurationMs,
  metadata,
}: RichChatBubbleProps) {
  const isVisitor = senderType === 'visitor';
  const isAI = senderType === 'ai';
  const isStaff = senderType === 'staff';
  const meta = metadata || {};
  const isCallEvent = meta?.type === 'call_event';

  if (isWelcome) {
    return (
      <div className="flex justify-center mb-3">
        <div className="bg-accent/80 border border-border text-foreground px-4 py-2.5 rounded-xl text-xs text-center max-w-[85%] shadow-sm">
          {message}
        </div>
      </div>
    );
  }

  // Call log → centered subtle pill
  if (isCallEvent) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/70 border border-border text-foreground/80 px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1.5">
          <Phone className="h-3 w-3" /> {message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5 mb-3', isVisitor && 'items-end')}>
      <div className={cn('flex items-end gap-2 max-w-[85%]', isVisitor ? 'self-end flex-row-reverse' : 'self-start')}>
        {!isVisitor && (
          <Avatar className="h-7 w-7 shrink-0 mt-1">
            <AvatarImage src={senderAvatar || undefined} />
            <AvatarFallback className={cn('text-[10px] font-semibold', isAI ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground')}>
              {isAI ? <Sparkles className="h-3.5 w-3.5" /> : (senderName?.charAt(0) || <UserIcon className="h-3.5 w-3.5" />)}
            </AvatarFallback>
          </Avatar>
        )}
        <div>
          {!isVisitor && (
            <p className="text-[11px] font-medium text-foreground/70 mb-0.5 ml-1">{isAI ? '✨ ' + (senderName || 'স্বর্ণ সুতা AI') : senderName}</p>
          )}
          <div className={cn(
            'px-3 py-2 rounded-2xl text-sm break-words',
            isVisitor
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : isAI
                ? 'bg-card border border-border rounded-bl-md shadow-sm'
                : 'bg-muted text-foreground rounded-bl-md',
          )}>
            {imageUrl && (
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                <img src={imageUrl} alt="" className="rounded-lg max-w-[220px] max-h-[220px] object-cover cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" />
              </a>
            )}
            {voiceUrl && (
              <div className="flex flex-col gap-1">
                <div className={cn('flex items-center gap-1 text-[10px] opacity-80', isVisitor ? 'text-primary-foreground' : 'text-muted-foreground')}>
                  <Mic className="h-3 w-3" /> ভয়েস মেসেজ
                </div>
                <VoiceMessage url={voiceUrl} durationMs={voiceDurationMs ?? undefined} variant={isVisitor ? 'visitor' : isStaff ? 'staff' : 'ai'} />
              </div>
            )}
            {message && message.trim() !== '' && (
              isAI ? (
                <div className="prose prose-sm max-w-none [&_p]:my-1 [&_a]:text-primary [&_a]:underline [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{message}</span>
              )
            )}
          </div>
          <p className={cn('text-[11px] font-medium text-foreground/50 mt-0.5', isVisitor ? 'text-right mr-1' : 'ml-1')}>
            {format(new Date(createdAt), 'hh:mm a')}
          </p>
        </div>
      </div>

      {/* Suggested products (AI) — same look the customer sees */}
      {isAI && Array.isArray(meta.suggested_products) && meta.suggested_products.length > 0 && (
        <div className="ml-9 max-w-[88%] space-y-1.5">
          {meta.category_label && (
            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
              🏷️ {meta.category_label}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {meta.suggested_products.slice(0, 6).map((p: any) => {
              // Pricing — handle both new metadata (sale_price/regular_price) and legacy (price/original_price)
              const isSale = p.is_sale ?? (p.original_price && p.original_price > 0 && p.original_price < p.price);
              const showPrice = p.is_sale !== undefined
                ? p.price
                : (isSale ? p.original_price : p.price);
              const strikePrice = p.is_sale !== undefined
                ? p.regular_price
                : (isSale ? p.price : null);
              const discount = p.discount_percent ?? (isSale && strikePrice ? Math.round(((strikePrice - showPrice) / strikePrice) * 100) : 0);
              return (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 bg-background border border-border rounded-xl p-2 hover:border-primary hover:shadow-sm transition-all"
                >
                  {p.image ? (
                    <img src={p.image} alt={p.name} loading="lazy" className="h-14 w-14 rounded-lg object-cover shrink-0 bg-muted" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs line-clamp-2 leading-tight">{p.name}</div>
                    <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                      <span className="font-bold text-primary text-sm">৳{Number(showPrice).toLocaleString('bn-BD')}</span>
                      {strikePrice && strikePrice > showPrice && (
                        <span className="text-[10px] line-through text-muted-foreground">৳{Number(strikePrice).toLocaleString('bn-BD')}</span>
                      )}
                      {discount > 0 && (
                        <span className="text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-px">-{discount}%</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-primary border border-primary/40 rounded-full px-2 py-0.5 shrink-0">
                    দেখুন →
                  </span>
                </Link>
              );
            })}
          </div>
          {meta.category_link && (
            <Link to={meta.category_link} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] text-primary font-semibold py-1 hover:underline">
              আরও দেখুন →
            </Link>
          )}
        </div>
      )}

      {/* Order card */}
      {isAI && meta.order_card && (
        <div className="ml-9 bg-card border border-border rounded-xl p-3 max-w-[88%] text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold">{meta.order_card.order_number}</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium uppercase">{meta.order_card.status}</span>
          </div>
          <div className="text-muted-foreground">৳{meta.order_card.total} · {new Date(meta.order_card.created_at).toLocaleDateString('bn-BD')}</div>
        </div>
      )}

      {/* Address card */}
      {isAI && meta.address_card && (
        <div className="ml-9 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 max-w-[88%] text-xs space-y-1.5">
          <div className="flex items-start gap-1.5">
            <span>📍</span>
            <div className="flex-1">
              <div className="font-semibold text-emerald-900 dark:text-emerald-100 mb-0.5">অফিস ঠিকানা</div>
              <div className="text-emerald-800 dark:text-emerald-200 leading-relaxed">{meta.address_card.address}</div>
            </div>
          </div>
          {meta.address_card.hours && (
            <div className="flex items-start gap-1.5">
              <span>🕙</span>
              <div className="text-emerald-800 dark:text-emerald-200">{meta.address_card.hours}</div>
            </div>
          )}
          {meta.address_card.pickup && (
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 italic">✓ অফিস থেকে সরাসরি পিকআপ সুবিধা আছে</div>
          )}
        </div>
      )}
    </div>
  );
}
