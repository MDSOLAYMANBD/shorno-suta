import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import ChatBubble from './ChatBubble';
import { cn } from '@/lib/utils';
import { optimizeImage } from '@/lib/imageOptimizer';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: string;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

const STORAGE_KEY = 'live_chat_session';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll on mobile while chat is open
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    const isMobileViewport = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobileViewport) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [open]);

  // Load session from localStorage - clear stale sessions without token
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessionId && data.sessionToken) {
          setSessionId(data.sessionId);
          setSessionToken(data.sessionToken);
          setName(data.name || '');
          setPhone(data.phone || '');
        } else {
          // Stale session without token - clear it
          localStorage.removeItem(STORAGE_KEY);
          setName(data.name || '');
          setPhone(data.phone || '');
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZqTjHhka2d3go+XnJiOgHFiZnN/jJablpGHdmlncH6KlpyamI2BdGtpcX+Kl5yZl46CdWxpc4CLl5yYl42Bdmtqc4CLl5yYl42BdmtqcoGMmJyYl42Bd2trc4GMmJyXlo2Bd2xrc4GMmJ2Xl42Bd2xrc4GMmJyXlo2Cd2xrc4KNmZyXlo2Cd2xrc4KNmZyXlo6Cd2xrc4KNmZyYl46CeGxsdIKNmZuXl46CeG1sdIKOmpuYl46CeG1sdYOOmpuYmI+DeW1tdYOOmpuYmI+DeW1tdYOPm5uYmI+DeW5tdYSPm5uYmI+EeW5udYSPm5uZmZCEeW5udoSPnJuZmZCEem5udoSQnJuZmZCEem9udoSQnJuZmZCFem9vd4WQnJuZmpCFem9vd4WRnZuZmpGFe29vd4WRnZuampGFe3Bvd4aRnZuampGFe3Bwd4aRnZyampGGe3Bwd4aSnZyampKGfHBwd4aSnZyampKGfHBxeIeSnZybm5KGfHBxeIeSnp2bm5KHfHFxeIeTnp2bm5OHfXFxeIeTnp2bm5OHfXFyeYeTnp2cnJOHfXFyeYiUnp2cnJOHfXJyeYiUnp6cnJSIfXJyeYiUnp6cnJSIfnJyeYiVn56cnJSIfnJzeYiVn56cnZSJfnNzeYmVn56dnZWJf3NzeoqWn56dnZWJf3N0eoqWn5+dnZWJf3R0eoqWoJ+dnZWKf3R0e4uXoJ+dnpWKf3R0e4uXoJ+enpWKgHR0e4uXoJ+enpWKgHR1e4uXoZ+enpWLgHV1e4yYoZ+enpWLgXV1fIyYoZ+enpWLgXV1fIyYoZ+fn5aLgXV2fIyYoaCfn5aLgXZ2fI2Zop+fn5aMgnZ2fI2ZoqCfn5aMgnZ2fI2ZoqCfn5aMgnZ3fY2ZoqCgn5aMg3d3fY6aoqCgoJeNg3d3fY6aoqCgoJeNg3d3fY6aoqCgoJeNg3d4fY6aoqCgoJeNg3h4fo+bo6GgoJeNhHh4fo+bo6GgoJeOhHh4fo+bo6GhoZiOhHh5fo+bo6GhoZiOhHl5fo+co6GhoZiOhXl5f5CcpKGhoZiPhXl5f5CcpKGhoZiPhXl5f5CcpKGioZmPhXp6f5CcpKGioZmPhXp6f5CcpKKioZmQhnp6f5GdpKKioZmQhnp6gJGdpKKioZqQhnp7gJGdpKKioZqQhnt7gJGdpKKioZqQhnt7gJGdpaKioZqQh3t7gJKdpaKjoZqRh3t7gJKepqKjoZqRh3t8gJKepaOjoZqRh3x8gZKepaOjopuRh3x8gZKepaOjopuSiHx8gZOfpaOjopuSiHx9gZOfpaOjopuSiH19gZOfpqOjopuSiH19gpOfpqOkopySiX19gpOfpqOkopySiX19gpSgpqOko5ySiX19gpSgpqSkopySiX5+gpSgpqSkopySin5+gpSgpqSkopySin5+g5SgpqSkopySin5+g5ShpqSkop2Tin5+g5ShpqSkop2Ti35/g5ShpqWko52Ti39/g5ShpqWko52Ti39/hJWhp6Wko52UjH9/hJWhp6Wko52UjH9/hJWhp6Wlop2UjIB/hJWhp6WlpJ6UjICAhJWhp6WlpJ6UjICAhJWip6WlpJ6VjYCAhZaip6WlpJ6VjYCAhZaip6WlpJ6VjYGBhZaip6alpJ+VjYGBhZaip6alpJ+VjoGBhZajp6alpJ+VjoGBhpajqKalpJ+WjoGBhpajqKalpZ+WjoGChpajqKalpZ+WjoKChpajqKalpZ+Wj4KChpajqKalpZ+Wj4KChpejqKalpZ+Wj4KChpejqKalpZ+Xj4KCh5ejqKampp+Xj4KDh5ejqKampp+Xj4ODh5ejqKampp+XkIODh5ejqKampqCXkIODh5ejqaampqCXkIODh5ikqaampqCYkIODiJikqaampqCYkIOEiJikqaampqCYkYSEiJikqaampqCYkYSEiJikqaenpqCYkYSEiJikqqenp6GZkYSEiJmkqqenp6GZkoSEiZmlqqenp6GZkoWFiZmlqqenp6GZkoWFiZmlqqenp6GZkoWFiZmlqqinp6GZkoWFipqlqqinp6GakoWFipqlqqinp6GakoWGipqlqqinp6GakoaGipqlq6inp6GakoaGipqlq6inp6GakoaGipqlq6inp6Gak4aGipqlq6inp6Kak4aGipulq6moqKKak4aGi5ulq6moqKKbk4aHi5ulq6moqKKbk4eHi5ulq6moqKKbk4eHi5ulrKmoqKKbk4eHi5ulrKmoqKKblIeHi5ylrKmoqKKblIeHi5ylrKmoqKOblIeHi5ylrKmoqKOblIeHjJylrKmpqKOblIeIjJylrKmpqaOblIeIjJylrKmpqaOblYeIjJylrKmpqaOclYeIjJ2mrKmpqaOclYeIjJ2mrKmpqaOclYeIjJ2mrampqaOclYiIjJ2mrampqaOclYiIjZ2mrampqaOclYiIjZ2mrampqaSclYiJjZ2mrampqaSdlYiJjZ2nraqpqaSdloiJjZ2nraqpqqSdloiJjZ6nraqpqqSdloiJjZ6nraqpqqSdloiJjp6nraqpqqSdloiJjp6nraqqqaSdloiJjp6nraqqqaSel4mJjp6nraqqqqSel4mKjp6nraqqqqSel4mKjp6oraqqqqWel4mKjp+oraqqqqWel4mKj5+oraqqqqWel4mKj5+oraqqqqWfl4mKj5+oraqqqqWfl4qKj5+oraqqqqWfl4qKj5+oraqqqqWfl4qLj5+orauqqqWfl4qLkJ+oraurq6afl4qLkJ+oraurq6agl4qLkKCpraurq6agl4qLkKCpraurq6agl4qLkKCpraurq6agl4qLkKCprrurq6egl4uLkKCprrurq6egl4uLkKCprrurq6egl4uLkKCprrurq6ehlouMkaCprrurq6ehlouMkaCprrurq6ehlouMkaCprrurq6ehmIuMkaCprrurq6ehmIuMkaCqrrurq6ehmIuMkaCqrrurq6ehmIuMkaGqrrurq6ehmIuMkaGqrryrq6ehmIuMkaGqrryrrKehmIyMkaGqrryrrKehmIyNkaGqrryrrKehmIyNkaGqrryrrKehmYyNkqGqrryrrKehmYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGrrryrrKeimYyNkqGrrryrrKeimYyOkqGrrryrrKeimYyOkqGrrryrrKeimYyOkqKrrryrraeimYyOkqKrrryrraeimY2OkqKrrrysraeimY2OkqKrrrysraeimY2OkqKrrrysraeimY2Ok6KrrrysraeimY2Ok6KsrrysraeimY2Ok6KsrrysraeimY2Ok6Ksrrysraejmg==');
  }, []);

  // Load messages when session exists
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_visitor_chat_messages', {
        p_session_id: sessionId,
        p_visitor_phone: phone || undefined,
        p_session_token: sessionToken || undefined,
      });
      if (error) {
        console.error('Load messages error:', error);
        // Invalid session - clear and restart
        localStorage.removeItem(STORAGE_KEY);
        setSessionId(null);
        setSessionToken(null);
        toast.error('সেশন মেয়াদ শেষ, আবার চ্যাট শুরু করুন');
        return;
      }
      if (data) setMessages(data as unknown as ChatMessage[]);
    };
    load();
  }, [sessionId, sessionToken]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.sender_type === 'staff' && !open) {
          setHasNewMsg(true);
          audioRef.current?.play().catch(() => {});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, open]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startChat = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('নাম ও মোবাইল নম্বর দিন');
      return;
    }
    // Validate BD phone format before hitting backend
    const cleanPhone = phone.trim();
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      toast.error('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)');
      return;
    }
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc('create_visitor_chat_session', {
        p_name: name.trim(),
        p_phone: phone.trim(),
      });
      if (error) {
        console.error('Chat session error:', error);
        toast.error('চ্যাট শুরু করতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
        return;
      }
      if (data) {
        const parts = (data as string).split('::');
        if (parts.length === 2 && parts[0] && parts[1]) {
          const newSessionId = parts[0];
          const newToken = parts[1];
          setSessionId(newSessionId);
          setSessionToken(newToken);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: newSessionId, sessionToken: newToken, name: name.trim(), phone: cleanPhone }));
        } else {
          console.error('Invalid session response format:', data);
          toast.error('চ্যাট শুরু করতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
        }
      } else {
        toast.error('চ্যাট শুরু করতে সমস্যা হয়েছে');
      }
    } catch (e: any) {
      console.error('Chat start failed:', e);
      toast.error('চ্যাট শুরু করতে সমস্যা হয়েছে');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (imageUrl?: string) => {
    if (!sessionId) return;
    if (!imageUrl && !input.trim()) return;
    const msg = input.trim();
    if (!imageUrl) setInput('');
    setSending(true);
    try {
      const { error: sendError } = await supabase.rpc('send_visitor_chat_message', {
        p_session_id: sessionId,
        p_sender_name: name,
        p_message: msg || '',
        p_visitor_phone: phone || undefined,
        p_image_url: imageUrl || undefined,
        p_session_token: sessionToken || undefined,
      } as any);
      if (sendError) {
        console.error('Send message error:', sendError);
        toast.error('বার্তা পাঠাতে সমস্যা হয়েছে');
        return;
      }
      await supabase.rpc('update_visitor_chat_activity', {
        p_session_id: sessionId,
        p_unread_count: messages.filter(m => m.sender_type === 'visitor').length + 1,
        p_visitor_phone: phone || undefined,
        p_session_token: sessionToken || undefined,
      } as any);
    } catch (e: any) {
      console.error('Message send failed:', e);
      toast.error('বার্তা পাঠাতে সমস্যা হয়েছে');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId || !sessionToken) return;
    // Reset input
    e.target.value = '';

    if (file.size > MAX_FILE_SIZE) {
      toast.error('ফাইল সাইজ ৫MB এর বেশি হতে পারবে না');
      return;
    }

    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const filePath = `${sessionId}/${sessionToken}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, optimized, { contentType: optimized.type, cacheControl: '31536000' });

      if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-images')
        .createSignedUrl(filePath, 315360000);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('signed url failed');
      await sendMessage(signed.signedUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Chat Button */}
      <button
        onClick={() => { setOpen(!open); setHasNewMsg(false); }}
        className={cn(
          'fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110',
          'bg-primary text-primary-foreground'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {hasNewMsg && !open && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full animate-pulse" />
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-50 w-[340px] sm:w-[380px] h-[480px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">লাইভ চ্যাট</h3>
              <p className="text-[10px] opacity-80">আমরা অনলাইনে আছি</p>
            </div>
          </div>

          {!sessionId ? (
            /* Registration Form */
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <MessageCircle className="h-12 w-12 text-primary opacity-50" />
              <p className="text-sm text-muted-foreground text-center">চ্যাট শুরু করতে আপনার তথ্য দিন</p>
              <div className="w-full space-y-3">
                <div>
                  <Label className="text-xs">আপনার নাম</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="নাম লিখুন" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">মোবাইল নম্বর</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="mt-1" />
                </div>
                <Button onClick={startChat} disabled={starting || !name.trim() || !phone.trim()} className="w-full">
                  {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  চ্যাট শুরু করুন
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground mt-8">আপনার মেসেজ লিখুন, আমরা শীঘ্রই রিপ্লাই দেবো!</p>
                )}
                {messages.map(m => (
                  <ChatBubble
                    key={m.id}
                    message={m.message}
                    senderType={m.sender_type as 'visitor' | 'staff'}
                    senderName={m.sender_name}
                    senderAvatar={m.sender_avatar}
                    createdAt={m.created_at}
                    isWelcome={m.sender_name === '🤝 Welcome'}
                    imageUrl={m.image_url}
                  />
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="ছবি পাঠান"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </Button>
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="মেসেজ লিখুন..."
                  className="flex-1"
                />
                <Button size="icon" onClick={() => sendMessage()} disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
