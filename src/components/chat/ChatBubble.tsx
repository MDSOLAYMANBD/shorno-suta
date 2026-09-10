import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessage from './VoiceMessage';
import { Mic } from 'lucide-react';

interface ChatBubbleProps {
  message: string;
  senderType: 'visitor' | 'staff';
  senderName: string;
  senderAvatar?: string | null;
  createdAt: string;
  isWelcome?: boolean;
  imageUrl?: string | null;
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
}

export default function ChatBubble({ message, senderType, senderName, senderAvatar, createdAt, isWelcome, imageUrl, voiceUrl, voiceDurationMs }: ChatBubbleProps) {
  const isVisitor = senderType === 'visitor';

  if (isWelcome) {
    return (
      <div className="flex justify-center mb-3">
        <div className="bg-accent/80 border border-border text-foreground px-4 py-2.5 rounded-xl text-xs text-center max-w-[85%] shadow-sm">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 mb-3', isVisitor ? 'flex-row-reverse' : 'flex-row')}>
      {!isVisitor && (
        <Avatar className="h-7 w-7 shrink-0 mt-1">
          <AvatarImage src={senderAvatar || undefined} />
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{senderName?.charAt(0) || 'S'}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn('max-w-[75%]')}>
        {!isVisitor && (
          <p className="text-[11px] font-medium text-foreground/70 mb-0.5 ml-1">{senderName}</p>
        )}
        <div className={cn(
          'px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words',
          isVisitor
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
              <img
                src={imageUrl}
                alt="Shared image"
                className="rounded-lg max-w-[200px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          )}
          {voiceUrl && (
            <div className="flex flex-col gap-1">
              <div className={cn('flex items-center gap-1 text-[10px] opacity-80', isVisitor ? 'text-primary-foreground' : 'text-muted-foreground')}>
                <Mic className="h-3 w-3" /> ভয়েস মেসেজ
              </div>
              <VoiceMessage url={voiceUrl} durationMs={voiceDurationMs ?? undefined} variant={isVisitor ? 'visitor' : 'staff'} />
            </div>
          )}
          {message && message.trim() !== '' && <span>{message}</span>}
        </div>
        <p className={cn('text-[11px] font-medium text-foreground/50 mt-0.5', isVisitor ? 'text-right mr-1' : 'ml-1')}>
          {format(new Date(createdAt), 'hh:mm a')}
        </p>
      </div>
    </div>
  );
}
