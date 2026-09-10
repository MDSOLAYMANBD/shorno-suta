import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, MessageCircle, Phone, User, Search, Trash2, RefreshCw, Zap, ImagePlus, Loader2 } from 'lucide-react';
import { optimizeImage } from '@/lib/imageOptimizer';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import RichChatBubble from '@/components/chat/RichChatBubble';
import IncomingCallNotification from '@/components/admin/inbox/IncomingCallNotification';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ChatSession {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  status: string;
  last_message_at: string;
  unread_count: number;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

const STATIC_QUICK_REPLIES = [
  'ধন্যবাদ! 🙏',
  'অর্ডার কনফার্ম হয়েছে ✅',
  'আমাদের নম্বরে কল করুন 📞',
  'প্রোডাক্ট স্টকে আছে',
  'ডেলিভারি ২-৩ দিনে হবে',
  'অর্ডার করতে নাম, ঠিকানা ও মোবাইল নম্বর দিন',
];

export default function AdminLiveChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSession, setSelectedSession] = useState<string | null>(searchParams.get('session'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ name: string; avatar: string | null }>({ name: '', avatar: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quickReplies = useMemo(() => [
    `আসসালামু আলাইকুম, আমি ${staffInfo.name || 'আমাদের প্রতিনিধি'}। আপনাকে স্বাগতম! আমি কীভাবে আপনাকে সহযোগিতা করতে পারি? 😊`,
    ...STATIC_QUICK_REPLIES,
  ], [staffInfo.name]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canReply = can('live_chat', 'edit');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load staff info
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('employee_profiles').select('full_name, avatar_url').eq('user_id', session.user.id).single();
      if (data) setStaffInfo({ name: data.full_name, avatar: data.avatar_url });
      else setStaffInfo({ name: session.user.email || 'Staff', avatar: null });
    };
    load();
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZqTjHhka2d3go+XnJiOgHFiZnN/jJablpGHdmlncH6KlpyamI2BdGtpcX+Kl5yZl46CdWxpc4CLl5yYl42Bdmtqc4CLl5yYl42BdmtqcoGMmJyYl42Bd2trc4GMmJyXlo2Bd2xrc4GMmJ2Xl42Bd2xrc4GMmJyXlo2Cd2xrc4KNmZyXlo2Cd2xrc4KNmZyXlo6Cd2xrc4KNmZyYl46CeGxsdIKNmZuXl46CeG1sdIKOmpuYl46CeG1sdYOOmpuYmI+DeW1tdYOOmpuYmI+DeW1tdYOPm5uYmI+DeW5tdYSPm5uYmI+EeW5udYSPm5uZmZCEeW5udoSPnJuZmZCEem5udoSQnJuZmZCEem9udoSQnJuZmZCFem9vd4WQnJuZmpCFem9vd4WRnZuZmpGFe29vd4WRnZuampGFe3Bvd4aRnZuampGFe3Bwd4aRnZyampGGe3Bwd4aSnZyampKGfHBwd4aSnZyampKGfHBxeIeSnZybm5KGfHBxeIeSnp2bm5KHfHFxeIeTnp2bm5OHfXFxeIeTnp2bm5OHfXFyeYeTnp2cnJOHfXFyeYiUnp2cnJOHfXJyeYiUnp6cnJSIfXJyeYiUnp6cnJSIfnJyeYiVn56cnJSIfnJzeYiVn56cnZSJfnNzeYmVn56dnZWJf3NzeoqWn56dnZWJf3N0eoqWn5+dnZWJf3R0eoqWoJ+dnZWKf3R0e4uXoJ+dnpWKf3R0e4uXoJ+enpWKgHR0e4uXoJ+enpWKgHR1e4uXoZ+enpWLgHV1e4yYoZ+enpWLgXV1fIyYoZ+enpWLgXV1fIyYoZ+fn5aLgXV2fIyYoaCfn5aLgXZ2fI2Zop+fn5aMgnZ2fI2ZoqCfn5aMgnZ2fI2ZoqCfn5aMgnZ3fY2ZoqCgn5aMg3d3fY6aoqCgoJeNg3d3fY6aoqCgoJeNg3d3fY6aoqCgoJeNg3d4fY6aoqCgoJeNg3h4fo+bo6GgoJeNhHh4fo+bo6GgoJeOhHh4fo+bo6GhoZiOhHh5fo+bo6GhoZiOhHl5fo+co6GhoZiOhXl5f5CcpKGhoZiPhXl5f5CcpKGhoZiPhXl5f5CcpKGioZmPhXp6f5CcpKGioZmPhXp6f5CcpKKioZmQhnp6f5GdpKKioZmQhnp6gJGdpKKioZqQhnp7gJGdpKKioZqQhnt7gJGdpKKioZqQhnt7gJGdpaKioZqQh3t7gJKdpaKjoZqRh3t7gJKepqKjoZqRh3t8gJKepaOjoZqRh3x8gZKepaOjopuRh3x8gZKepaOjopuSiHx8gZOfpaOjopuSiHx9gZOfpaOjopuSiH19gZOfpqOjopuSiH19gpOfpqOkopySiX19gpOfpqOkopySiX19gpSgpqOko5ySiX19gpSgpqSkopySiX5+gpSgpqSkopySin5+gpSgpqSkopySin5+g5SgpqSkopySin5+g5ShpqSkop2Tin5+g5ShpqSkop2Ti35/g5ShpqWko52Ti39/g5ShpqWko52Ti39/hJWhp6Wko52UjH9/hJWhp6Wko52UjH9/hJWhp6Wlop2UjIB/hJWhp6WlpJ6UjICAhJWhp6WlpJ6UjICAhJWip6WlpJ6VjYCAhZaip6WlpJ6VjYCAhZaip6WlpJ6VjYGBhZaip6alpJ+VjYGBhZaip6alpJ+VjoGBhZajp6alpJ+VjoGBhpajqKalpJ+WjoGBhpajqKalpZ+WjoGChpajqKalpZ+WjoKChpajqKalpZ+Wj4KChpajqKalpZ+Wj4KChpejqKalpZ+Wj4KChpejqKalpZ+Xj4KCh5ejqKampp+Xj4KDh5ejqKampp+Xj4ODh5ejqKampp+XkIODh5ejqKampqCXkIODh5ejqaampqCXkIODh5ikqaampqCYkIODiJikqaampqCYkIOEiJikqaampqCYkYSEiJikqaampqCYkYSEiJikqaenpqCYkYSEiJikqqenp6GZkYSEiJmkqqenp6GZkoSEiZmlqqenp6GZkoWFiZmlqqenp6GZkoWFiZmlqqenp6GZkoWFiZmlqqinp6GZkoWFipqlqqinp6GakoWFipqlqqinp6GakoWGipqlqqinp6GakoaGipqlq6inp6GakoaGipqlq6inp6GakoaGipqlq6inp6Gak4aGipqlq6inp6Kak4aGipulq6moqKKak4aGi5ulq6moqKKbk4aHi5ulq6moqKKbk4eHi5ulq6moqKKbk4eHi5ulrKmoqKKbk4eHi5ulrKmoqKKblIeHi5ylrKmoqKKblIeHi5ylrKmoqKOblIeHi5ylrKmoqKOblIeHjJylrKmpqKOblIeIjJylrKmpqaOblIeIjJylrKmpqaOblYeIjJylrKmpqaOclYeIjJ2mrKmpqaOclYeIjJ2mrKmpqaOclYeIjJ2mrampqaOclYiIjJ2mrampqaOclYiIjZ2mrampqaOclYiIjZ2mrampqaSclYiJjZ2mrampqaSdlYiJjZ2nraqpqaSdloiJjZ2nraqpqqSdloiJjZ6nraqpqqSdloiJjZ6nraqpqqSdloiJjp6nraqpqqSdloiJjp6nraqqqaSdloiJjp6nraqqqaSel4mJjp6nraqqqqSel4mKjp6nraqqqqSel4mKjp6oraqqqqWel4mKjp+oraqqqqWel4mKj5+oraqqqqWel4mKj5+oraqqqqWfl4mKj5+oraqqqqWfl4qKj5+oraqqqqWfl4qKj5+oraqqqqWfl4qLj5+orauqqqWfl4qLkJ+oraurq6afl4qLkJ+oraurq6agl4qLkKCpraurq6agl4qLkKCpraurq6agl4qLkKCpraurq6agl4qLkKCprrurq6egl4uLkKCprrurq6egl4uLkKCprrurq6egl4uLkKCprrurq6ehlouMkaCprrurq6ehlouMkaCprrurq6ehlouMkaCprrurq6ehmIuMkaCprrurq6ehmIuMkaCqrrurq6ehmIuMkaCqrrurq6ehmIuMkaGqrrurq6ehmIuMkaGqrryrq6ehmIuMkaGqrryrrKehmIyMkaGqrryrrKehmIyNkaGqrryrrKehmIyNkaGqrryrrKehmYyNkqGqrryrrKehmYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGqrryrrKeimYyNkqGrrryrrKeimYyNkqGrrryrrKeimYyOkqGrrryrrKeimYyOkqGrrryrrKeimYyOkqKrrryrraeimYyOkqKrrryrraeimY2OkqKrrrysraeimY2OkqKrrrysraeimY2OkqKrrrysraeimY2Ok6KrrrysraeimY2Ok6KsrrysraeimY2Ok6KsrrysraeimY2Ok6Ksrrysraejmg==');
  }, []);

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_sessions')
        .select('id,visitor_name,visitor_phone,status,unread_count,last_message_at,created_at,customer_user_id')
        .order('last_message_at', { ascending: false });
      return (data || []) as ChatSession[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — realtime channel pushes updates
  });

  // Sync URL ?session= param with selected session for deep-linking from call popup
  useEffect(() => {
    const sid = searchParams.get('session');
    if (sid && sid !== selectedSession) {
      setSelectedSession(sid);
    }
  }, [searchParams, selectedSession]);

  // Realtime for new sessions
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Load messages for selected session
  useEffect(() => {
    if (!selectedSession) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', selectedSession)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
      // Mark as read & reset unread
      await supabase.from('chat_messages').update({ is_read: true }).eq('session_id', selectedSession).eq('sender_type', 'visitor');
      await supabase.from('chat_sessions').update({ unread_count: 0 }).eq('id', selectedSession);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    };
    load();
  }, [selectedSession, queryClient]);

  // Realtime: pick up ALL inserts/updates (visitor, staff, AI) for the open session
  useEffect(() => {
    if (!selectedSession) return;
    const channel = supabase
      .channel(`admin-msg-${selectedSession}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${selectedSession}`,
      }, async (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.sender_type === 'visitor') {
          audioRef.current?.play().catch(() => {});
          toast.info(`${newMsg.sender_name}: ${newMsg.message.substring(0, 50)}`);
          await supabase.from('chat_messages').update({ is_read: true }).eq('id', newMsg.id);
          await supabase.from('chat_sessions').update({ unread_count: 0 }).eq('id', selectedSession);
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${selectedSession}`,
      }, (payload) => {
        const upd = payload.new as ChatMessage;
        setMessages(prev => prev.map(m => m.id === upd.id ? { ...m, ...upd } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession, queryClient]);

  // Typing indicator via broadcast
  useEffect(() => {
    if (!selectedSession) return;
    const channel = supabase.channel(`typing-${selectedSession}`);
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.sender_type === 'visitor') {
        setVisitorTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setVisitorTyping(false), 3000);
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  // Broadcast staff typing
  const broadcastTyping = useCallback(() => {
    if (!selectedSession) return;
    supabase.channel(`typing-${selectedSession}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender_type: 'staff', name: staffInfo.name },
    });
  }, [selectedSession, staffInfo.name]);

  // Global notification for any new visitor message
  useEffect(() => {
    const channel = supabase
      .channel('admin-global-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: 'sender_type=eq.visitor',
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.session_id !== selectedSession) {
          audioRef.current?.play().catch(() => {});
          toast.info(`নতুন মেসেজ: ${msg.sender_name}`, { description: msg.message.substring(0, 60) });
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendReply = async (text?: string, imageUrl?: string) => {
    const msg = (text || input).trim();
    if ((!msg && !imageUrl) || !selectedSession) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Check if this is the first staff reply in this session - send welcome message first
      const hasStaffReply = messages.some(m => m.sender_type === 'staff');
      if (!hasStaffReply) {
        const { data: welcomeSetting } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'chat_welcome_message')
          .single();
        const welcomeMsg = welcomeSetting?.value || 'আসসালামু আলাইকুম! স্বর্ণ সুতায় স্বাগতম। আপনাকে কিভাবে সাহায্য করতে পারি?';
        const { data: welcomeRow, error: welcomeErr } = await supabase.from('chat_messages').insert({
          session_id: selectedSession,
          sender_type: 'staff',
          sender_id: session?.user.id || null,
          sender_name: '🤝 Welcome',
          sender_avatar: null,
          message: welcomeMsg,
        }).select('*').single();
        if (welcomeErr) {
          console.error('welcome insert err', welcomeErr);
          toast.error('ওয়েলকাম মেসেজ পাঠানো যায়নি');
        } else if (welcomeRow) {
          setMessages(prev => prev.some(m => m.id === (welcomeRow as any).id) ? prev : [...prev, welcomeRow as ChatMessage]);
        }
      }

      const { data: row, error: insErr } = await supabase.from('chat_messages').insert({
        session_id: selectedSession,
        sender_type: 'staff',
        sender_id: session?.user.id || null,
        sender_name: staffInfo.name,
        sender_avatar: staffInfo.avatar,
        message: msg,
        image_url: imageUrl || null,
      }).select('*').single();
      if (insErr) {
        console.error('reply insert err', insErr);
        toast.error('রিপ্লাই পাঠানো যায়নি');
        return;
      }
      if (row) {
        setMessages(prev => prev.some(m => m.id === (row as any).id) ? prev : [...prev, row as ChatMessage]);
      }
      await supabase.from('chat_sessions').update({ last_message_at: new Date().toISOString() }).eq('id', selectedSession);

      // Push a lightweight broadcast signal so the visitor's widget pulls fresh
      // messages immediately even if postgres_changes is RLS-blocked for them.
      try {
        const sigCh = supabase.channel(`chat-signal-${selectedSession}`);
        await new Promise<void>((resolve) => {
          sigCh.subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
          });
          // Safety timeout so we never hang the UI
          setTimeout(() => resolve(), 800);
        });
        await sigCh.send({ type: 'broadcast', event: 'new_message', payload: { ts: Date.now() } });
        setTimeout(() => { supabase.removeChannel(sigCh); }, 500);
      } catch (e) {
        console.warn('broadcast signal failed', e);
      }

      if (!text) setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSession) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ফাইল সাইজ ৫MB এর বেশি হতে পারবে না');
      return;
    }
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const filePath = `${selectedSession}/admin/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, optimized, { contentType: optimized.type, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-images')
        .createSignedUrl(filePath, 315360000);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('signed url failed');
      await sendReply('', signed.signedUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploading(false);
    }
  };



  const closeSession = async (id: string) => {
    await supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    if (selectedSession === id) setSelectedSession(null);
  };

  const reopenSession = async (id: string) => {
    await supabase.from('chat_sessions').update({ status: 'active' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    toast.success('চ্যাট পুনরায় চালু হয়েছে');
  };

  const deleteSession = async (id: string) => {
    await supabase.from('chat_messages').delete().eq('session_id', id);
    await supabase.from('chat_sessions').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    if (selectedSession === id) setSelectedSession(null);
    toast.success('চ্যাট মুছে ফেলা হয়েছে');
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const closedSessions = sessions.filter(s => s.status === 'closed');
  const selected = sessions.find(s => s.id === selectedSession);

  // Filter sessions by search
  const filterSessions = (list: ChatSession[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(s => s.visitor_name.toLowerCase().includes(q) || s.visitor_phone.includes(q));
  };

  // Filter messages by search
  const displayMessages = messageSearch.trim()
    ? messages.filter(m => m.message.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  const filteredActive = filterSessions(activeSessions);
  const filteredClosed = filterSessions(closedSessions);

  return (
    <div className="h-[calc(100vh-theme(spacing.14)-theme(spacing.12))] md:h-[calc(100vh-theme(spacing.12))] flex gap-4">
      {/* IncomingCallNotification globally mounted in AdminDashboard */}
      {/* Session List */}
      <div className={cn(
        'w-full md:w-80 shrink-0 bg-background border border-border rounded-xl flex flex-col overflow-hidden',
        selectedSession ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-3 border-b border-border">
          <h2 className="font-bold text-sm flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4" /> লাইভ চ্যাট
            {sessions.filter(s => s.unread_count > 0).length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{sessions.filter(s => s.unread_count > 0).length}</Badge>
            )}
          </h2>
          {/* Session Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="নাম বা ফোন দিয়ে সার্চ..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredActive.length === 0 && filteredClosed.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">কোনো চ্যাট নেই</p>
          )}
          {filteredActive.map(s => (
            <button key={s.id} onClick={() => setSelectedSession(s.id)}
              className={cn(
                'w-full text-left p-3 border-b border-border transition-colors',
                selectedSession === s.id
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : s.unread_count > 0
                    ? 'bg-primary/5 hover:bg-primary/10'
                    : 'hover:bg-muted/50'
              )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.unread_count > 0 && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <span className={cn('text-sm truncate', s.unread_count > 0 ? 'font-bold' : 'font-medium')}>
                    {s.visitor_name}
                  </span>
                </div>
                {s.unread_count > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5 shrink-0">{s.unread_count}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3" /> {s.visitor_phone}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(s.last_message_at), 'dd MMM, hh:mm a')}
              </p>
            </button>
          ))}
          {filteredClosed.length > 0 && (
            <>
              <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                বন্ধ চ্যাট
              </div>
              {filteredClosed.map(s => (
                <button key={s.id} onClick={() => setSelectedSession(s.id)}
                  className={cn(
                    'w-full text-left p-3 border-b border-border transition-colors opacity-60',
                    selectedSession === s.id ? 'bg-primary/10 border-l-2 border-l-primary opacity-100' : 'hover:bg-muted/50'
                  )}>
                  <span className="font-medium text-sm truncate">{s.visitor_name}</span>
                  <p className="text-[10px] text-muted-foreground">{s.visitor_phone}</p>
                </button>
              ))}
            </>
          )}
        </ScrollArea>
      </div>

      {/* Chat Thread */}
      <div className={cn(
        'flex-1 bg-background border border-border rounded-xl flex flex-col overflow-hidden',
        !selectedSession ? 'hidden md:flex' : 'flex'
      )}>
        {!selectedSession ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">একটি চ্যাট সিলেক্ট করুন</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedSession(null)}>
                  <X className="h-4 w-4" />
                </Button>
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  {selected?.status === 'active' && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{selected?.visitor_name}</h3>
                  <p className="text-[10px] text-muted-foreground">{selected?.visitor_phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Message search toggle */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowMessageSearch(!showMessageSearch); setMessageSearch(''); }}>
                  <Search className="h-4 w-4" />
                </Button>
                {selected?.status === 'active' && can('live_chat', 'full') && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => closeSession(selectedSession!)}>
                    চ্যাট বন্ধ করুন
                  </Button>
                )}
                {selected?.status === 'closed' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => reopenSession(selectedSession!)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> পুনরায় চালু
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="text-xs">
                          <Trash2 className="h-3 w-3 mr-1" /> মুছুন
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>চ্যাট মুছে ফেলবেন?</AlertDialogTitle>
                          <AlertDialogDescription>এই চ্যাটের সকল মেসেজ স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>বাতিল</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSession(selectedSession!)}>মুছে ফেলুন</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>

            {/* Message Search Bar */}
            {showMessageSearch && (
              <div className="px-3 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={messageSearch}
                    onChange={e => setMessageSearch(e.target.value)}
                    placeholder="মেসেজে সার্চ করুন..."
                    className="pl-8 h-8 text-xs"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
              {displayMessages.map(m => (
                <RichChatBubble
                  key={m.id}
                  message={m.message}
                  senderType={m.sender_type as 'visitor' | 'staff' | 'ai'}
                  senderName={m.sender_name}
                  senderAvatar={m.sender_avatar}
                  createdAt={m.created_at}
                  isWelcome={m.sender_name === '🤝 Welcome'}
                  imageUrl={m.image_url}
                  voiceUrl={(m as any).voice_url}
                  voiceDurationMs={(m as any).voice_duration_ms}
                  metadata={(m as any).metadata}
                />
              ))}
              {visitorTyping && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  টাইপ করছেন...
                </div>
              )}
            </div>

            {/* Reply Input */}
            {(selected?.status === 'active' && canReply) && (
              <div className="border-t border-border">
                {/* Quick Replies */}
                {showQuickReplies && (
                  <div className="px-3 pt-2 flex flex-wrap gap-1.5">
                    {quickReplies.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => { sendReply(qr); setShowQuickReplies(false); }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-3 flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-10 w-10 shrink-0', showQuickReplies && 'text-primary bg-primary/10')}
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    title="Quick Reply"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    title="ছবি পাঠান"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  </Button>
                  <Input
                    value={input}
                    onChange={e => { setInput(e.target.value); broadcastTyping(); }}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                    placeholder="রিপ্লাই লিখুন..."
                    className="flex-1"
                  />
                  <Button size="icon" onClick={() => sendReply()} disabled={sending || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
