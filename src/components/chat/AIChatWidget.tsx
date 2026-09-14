import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Send, Loader2, Sparkles, Phone, User, Mic, StopCircle, Trash2, MoreVertical, LogOut, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { isAgentOnline } from '@/lib/agentHours';
import { useNotificationSound, requestNotificationPermission } from '@/hooks/useNotificationSound';
import { useSiteConfig, DEFAULT_BUTTONS_CONFIG } from '@/hooks/useSiteConfig';
import ChatAuthGate from './ChatAuthGate';
import ChatProfileCompleteGate from './ChatProfileCompleteGate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import VoiceMessage from './VoiceMessage';
import VoiceCallDialog, { VoiceCallMiniBar } from './VoiceCallDialog';

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'visitor' | 'staff' | 'ai';
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  image_url: string | null;
  voice_url?: string | null;
  voice_duration_ms?: number | null;
  created_at: string;
  metadata?: any;
}

const STORAGE_KEY = 'sd_ai_chat_session';

const DEFAULT_WHATSAPP_NUMBER = '8801843711211';
const DEFAULT_MESSENGER_LINK = 'https://m.me/shornosuta';

const normalizeWhatsAppLink = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return `https://wa.me/${DEFAULT_WHATSAPP_NUMBER}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.startsWith('880') ? digits : digits.startsWith('0') ? `880${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized || DEFAULT_WHATSAPP_NUMBER}`;
};

const normalizeMessengerLink = (value?: string | null) => {
  const raw = (value || '').trim();
  if (!raw) return DEFAULT_MESSENGER_LINK;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://m.me/${raw.replace(/^@/, '')}`;
};

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const [activeStaff, setActiveStaff] = useState<{ name: string; avatar: string | null } | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callMinimized, setCallMinimized] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { user, loading: authLoading, signOut } = useCustomerAuth();
  const { profile, displayName, avatarUrl } = useCustomerProfile();
  const { data: settings } = useAllSettings();
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const recorder = useVoiceRecorder();
  const call = useVoiceCall({ sessionId, sessionToken, callerName: name, callerPhone: phone });
  const { notify } = useNotificationSound();

  const startHour = parseInt(settings?.live_agent_start_hour || '10', 10);
  const endHour = parseInt(settings?.live_agent_end_hour || '21', 10);
  const agentOnline = useMemo(() => isAgentOnline(startHour, endHour), [startHour, endHour]);

  // Lock body scroll on mobile while chat is open so the page underneath
  // doesn't scroll when the user swipes inside the chat panel.
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

  // 1. Load saved session from localStorage (anonymous fallback)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.sessionId && d.sessionToken) {
          setSessionId(d.sessionId);
          setSessionToken(d.sessionToken);
          setName(d.name || '');
          setPhone(d.phone || '');
        }
      }
    } catch { /* ignore */ }
  }, []);

  // 2. When user is logged in, restore their persistent chat session and link if needed
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      // Pre-fill name/phone from profile
      if (profile) {
        if (profile.full_name) setName(profile.full_name);
        if (profile.phone) setPhone(profile.phone);
      }
      // Try to load user's existing session
      const { data } = await supabase.rpc('get_user_chat_session');
      if (data && (data as any[]).length > 0) {
        const s: any = (data as any[])[0];
        setSessionId(s.id);
        setSessionToken(s.session_token);
        if (s.visitor_name) setName(s.visitor_name);
        if (s.visitor_phone) setPhone(s.visitor_phone);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: s.id, sessionToken: s.session_token, name: s.visitor_name, phone: s.visitor_phone }));
      } else if (sessionId && sessionToken) {
        // Link existing anonymous session to this user
        try { await supabase.rpc('link_chat_session_to_user', { p_session_id: sessionId, p_session_token: sessionToken }); } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, profile?.id]);

  // Reusable history loader — used for initial load AND as a realtime fallback
  // (visitor clients cannot receive postgres_changes for chat_messages because of RLS,
  // so we explicitly refetch via the SECURITY DEFINER RPC after sending).
  const loadMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (!sessionId || !sessionToken) return null;
    const { data, error } = await supabase.rpc('get_visitor_chat_messages', {
      p_session_id: sessionId,
      p_session_token: sessionToken,
    });
    if (error) {
      console.error('history load err', error);
      return null;
    }
    const next = (data || []) as ChatMessage[];
    setMessages((prev) => {
      // Merge by id, preserving any in-memory items (e.g., the in-memory greeting)
      const byId = new Map<string, ChatMessage>();
      prev.forEach((m) => byId.set(m.id, m));
      next.forEach((m) => byId.set(m.id, m));
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
    // If a fresh AI/staff message arrived, clear typing indicator
    if (next.some((m) => m.sender_type === 'ai' || m.sender_type === 'staff')) {
      setAiTyping(false);
    }
    // Detect last staff replier for header
    const lastStaff = [...next].reverse().find((m) => m.sender_type === 'staff');
    if (lastStaff) setActiveStaff({ name: lastStaff.sender_name || 'এজেন্ট', avatar: lastStaff.sender_avatar });
    return next;
  }, [sessionId, sessionToken]);

  // 3. Initial history load (and recover from invalid session)
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    (async () => {
      const result = await loadMessages();
      if (result === null) {
        localStorage.removeItem(STORAGE_KEY);
        setSessionId(null);
        setSessionToken(null);
      }
    })();
  }, [sessionId, sessionToken, loadMessages]);

  // Helper: notify visitor of inbound message (sound + badge + browser notif)
  const notifyInbound = useCallback((m: ChatMessage) => {
    const isInbound = m.sender_type === 'staff' || m.sender_type === 'ai';
    if (!isInbound) return;
    if (m.sender_type === 'ai') setAiTyping(false);
    if (m.sender_type === 'staff') setActiveStaff({ name: m.sender_name || 'এজেন্ট', avatar: m.sender_avatar });
    const tabHidden = typeof document !== 'undefined' && document.hidden;
    if (!open || tabHidden) {
      setHasNewMsg(true);
      try {
        const preview = (m.message || '').replace(/[#*_`>\-]/g, '').slice(0, 80) || 'নতুন বার্তা';
        const title = m.sender_type === 'staff' ? `👤 ${m.sender_name || 'এজেন্ট'}` : '✨ স্বর্ণ সুতা AI';
        notify('chat', title, preview, () => { setOpen(true); setHasNewMsg(false); }, `chat-${sessionId}`);
      } catch { /* ignore */ }
    }
  }, [open, notify, sessionId]);

  // 4a. postgres_changes listener (works for some users; RLS may block others)
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`ai-chat-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        notifyInbound(m);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, notifyInbound]);

  // 4b. Broadcast signal listener — admin/AI side pings this channel after sending a reply.
  // We don't trust the payload; we just pull fresh messages via the secure RPC.
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`chat-signal-${sessionId}`)
      .on('broadcast', { event: 'new_message' }, async () => {
        const before = messages.length;
        const next = await loadMessages();
        if (next && next.length > before) {
          const fresh = next[next.length - 1];
          if (fresh) notifyInbound(fresh as ChatMessage);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, loadMessages, messages.length, notifyInbound]);

  // 4c. Polling fallback — when widget is open OR tab is visible, poll every 4s.
  // This guarantees admin replies appear within a few seconds even if both
  // postgres_changes and broadcast signals are missed (RLS/network/Facebook in-app browser).
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden && !open) return;
      const before = messages.length;
      const next = await loadMessages();
      if (!cancelled && next && next.length > before) {
        const fresh = next[next.length - 1];
        if (fresh) notifyInbound(fresh as ChatMessage);
      }
    };
    const interval = window.setInterval(tick, 4000);
    const onFocus = () => { tick(); };
    const onVisible = () => { if (!document.hidden) tick(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sessionId, sessionToken, open, loadMessages, messages.length, notifyInbound]);

  // Tab title badge while there are unread inbound messages
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const original = document.title;
    if (hasNewMsg && !open) {
      document.title = `🔔 নতুন বার্তা · ${original.replace(/^🔔\s*নতুন বার্তা\s*·\s*/, '')}`;
    } else {
      document.title = original.replace(/^🔔\s*নতুন বার্তা\s*·\s*/, '');
    }
    return () => { document.title = original.replace(/^🔔\s*নতুন বার্তা\s*·\s*/, ''); };
  }, [hasNewMsg, open]);

  // Ask for browser notification permission on first chat open
  useEffect(() => {
    if (open) requestNotificationPermission();
  }, [open]);

  // 5. Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, aiTyping]);

  // 6. Greeting on open (anonymous, in-memory only — not stored)
  const [greetingShown, setGreetingShown] = useState(false);
  useEffect(() => {
    if (!open || greetingShown) return;
    if (sessionId && messages.length > 0) { setGreetingShown(true); return; }
    if (!sessionId && messages.length === 0) {
      const greet = user
        ? `আসসালামু আলাইকুম ${displayName || ''}! 🌿 স্বর্ণ সুতায় আবার স্বাগতম। আমি কীভাবে সাহায্য করতে পারি?`
        : 'আসসালামু আলাইকুম! 🌿 স্বর্ণ সুতায় স্বাগতম। আমি আপনাকে কীভাবে সাহায্য করতে পারি?\n\n- প্রোডাক্ট, দাম, ফেব্রিক\n- ডেলিভারি ও পলিসি\n- অর্ডার ট্র্যাকিং';
      setMessages([{
        id: 'greeting',
        session_id: '',
        sender_type: 'ai',
        sender_name: 'স্বর্ণ সুতা AI',
        sender_avatar: null,
        message: greet,
        image_url: null,
        created_at: new Date().toISOString(),
        metadata: { quick_replies: ['ডেলিভারি কত দিনে?', 'নতুন প্রোডাক্ট দেখান', 'অর্ডার ট্র্যাক'] },
      }]);
      setGreetingShown(true);
    }
  }, [open, sessionId, messages.length, greetingShown, user, displayName]);

  // Create session using known name+phone (logged-in user with complete profile)
  const createSessionFor = useCallback(async (n: string, p: string): Promise<{ sid: string; tok: string } | null> => {
    try {
      const { data, error } = await supabase.rpc('create_visitor_chat_session', { p_name: n, p_phone: p });
      if (error) throw error;
      const [sid, tok] = (data as string).split('::');
      setSessionId(sid); setSessionToken(tok);
      setName(n); setPhone(p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: sid, sessionToken: tok, name: n, phone: p }));
      if (user) { try { await supabase.rpc('link_chat_session_to_user', { p_session_id: sid, p_session_token: tok }); } catch { /* ignore */ } }
      return { sid, tok };
    } catch (e: any) {
      console.error(e); toast.error('সেশন তৈরি ব্যর্থ');
      return null;
    }
  }, [user]);

  const ensureSession = useCallback(async (): Promise<{ sid: string; tok: string } | null> => {
    if (sessionId && sessionToken) return { sid: sessionId, tok: sessionToken };
    if (!user) { setShowAuthGate(true); return null; }
    const pName = profile?.full_name || displayName || user.user_metadata?.full_name || '';
    const pPhone = profile?.phone || '';
    const pAddress = profile?.address || '';
    if (!pName || !/^01[3-9]\d{8}$/.test(pPhone) || !pAddress) {
      setShowProfileGate(true);
      return null;
    }
    return await createSessionFor(pName, pPhone);
  }, [sessionId, sessionToken, user, profile, displayName, createSessionFor]);

  const onProfileComplete = async (n: string, p: string, _a: string) => {
    setShowProfileGate(false);
    const s = await createSessionFor(n, p);
    if (s && input.trim()) await sendMessageWith(s.sid, s.tok, input);
  };

  const handleLogout = async () => {
    try { await signOut(); } catch { /* ignore */ }
    localStorage.removeItem(STORAGE_KEY);
    setSessionId(null); setSessionToken(null);
    setMessages([]); setName(''); setPhone('');
    setShowAuthGate(false); setShowProfileGate(false);
    setGreetingShown(false);
    toast.success('লগ আউট হয়েছে');
  };

  const sendMessageWith = async (sid: string, tok: string, text: string) => {
    if (!text.trim()) return;
    setInput('');
    setSending(true);
    setAiTyping(true);
    try {
      const { error: sendErr } = await supabase.rpc('send_visitor_chat_message', {
        p_session_id: sid, p_sender_name: name || displayName || 'Visitor', p_message: text, p_visitor_phone: phone || undefined, p_session_token: tok,
      } as any);
      if (sendErr) throw sendErr;
      // Pull in the persisted visitor message immediately
      loadMessages();

      const history = messages.slice(-8).filter((m) => m.id !== 'greeting').map((m) => ({
        role: m.sender_type === 'visitor' ? 'user' : 'assistant',
        content: m.message,
      }));

      const { data, error } = await supabase.functions.invoke('ai-chat-reply', {
        body: { session_id: sid, session_token: tok, visitor_message: text, history, visitor_phone: phone },
      });
      if (error) {
        const msg = (error as any)?.context?.body || error.message || 'AI error';
        if (String(msg).includes('429')) toast.error('একটু পরে চেষ্টা করুন');
        else if (String(msg).includes('402')) toast.error('AI ক্রেডিট শেষ — admin-কে জানান');
        else console.error('ai invoke err', error);
        setAiTyping(false);
      } else {
        // Realtime is unreliable for anonymous visitor clients (RLS blocks SELECT),
        // so explicitly refetch a few times to pick up the AI reply that the edge
        // function just inserted via SECURITY DEFINER RPC.
        await loadMessages();
        setTimeout(() => { loadMessages(); }, 800);
        setTimeout(() => { loadMessages(); }, 2000);
      }
    } catch (e: any) {
      console.error(e); toast.error('পাঠাতে সমস্যা');
      setAiTyping(false);
    } finally {
      setSending(false);
      setTimeout(() => setAiTyping(false), 15000);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    const s = await ensureSession();
    if (!s) return;
    await sendMessageWith(s.sid, s.tok, text);
  };

  // Voice recording handlers
  const startVoice = async () => {
    const s = await ensureSession();
    if (!s) return;
    try {
      await recorder.start();
      toast.success('🎤 কথা বলুন...', { duration: 1500 });
    } catch (e: any) {
      console.error('[voice start failed]', e);
      toast.error(e?.message || 'মাইক্রোফোন চালু করা যায়নি', { duration: 5000 });
    }
  };

  const finishVoice = async () => {
    if (!recorder.recording) return;
    const result = await recorder.stop();
    if (!result || !sessionId || !sessionToken) return;
    if (result.durationMs < 500) { toast.info('আরও বেশি কথা বলুন'); return; }
    setUploadingVoice(true);
    setAiTyping(true);
    try {
      const ext = result.mimeType.includes('mp4') ? 'mp4' : result.mimeType.includes('ogg') ? 'ogg' : 'webm';
      const path = `${sessionId}/${sessionToken}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-voice').upload(path, result.blob, {
        contentType: result.mimeType, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-voice')
        .createSignedUrl(path, 315360000);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('signed url failed');
      const publicUrl = signed.signedUrl;

      // Insert visitor voice message
      const { error: insErr } = await supabase.from('chat_messages').insert({
        session_id: sessionId,
        sender_type: 'visitor',
        sender_name: name || displayName || 'Visitor',
        message: '🎤 ভয়েস মেসেজ',
        voice_url: publicUrl,
        voice_duration_ms: result.durationMs,
      } as any);
      if (insErr) console.error(insErr);
      await supabase.rpc('update_visitor_chat_activity', { p_session_id: sessionId, p_unread_count: 1, p_session_token: sessionToken } as any);

      // Transcribe + reply
      const { data: tData, error: tErr } = await supabase.functions.invoke('voice-transcribe', {
        body: { session_id: sessionId, session_token: sessionToken, voice_url: publicUrl, mime_type: result.mimeType },
      });
      if (tErr) {
        console.error('transcribe err', tErr);
        toast.error('ভয়েস বুঝতে সমস্যা — text-এ লিখুন');
        setAiTyping(false);
        return;
      }
      const transcript = (tData as any)?.transcript;
      if (transcript) {
        // Refetch to show transcribed visitor message
        loadMessages();
        const history = messages.slice(-8).filter((m) => m.id !== 'greeting').map((m) => ({
          role: m.sender_type === 'visitor' ? 'user' : 'assistant', content: m.message,
        }));
        await supabase.functions.invoke('ai-chat-reply', {
          body: { session_id: sessionId, session_token: sessionToken, visitor_message: transcript, history, visitor_phone: phone },
        });
        // Pull the AI reply (realtime unreliable for visitors due to RLS)
        await loadMessages();
        setTimeout(() => { loadMessages(); }, 800);
        setTimeout(() => { loadMessages(); }, 2000);
      } else {
        setAiTyping(false);
      }
    } catch (e: any) {
      console.error(e); toast.error('ভয়েস পাঠাতে সমস্যা'); setAiTyping(false);
    } finally {
      setUploadingVoice(false);
      setTimeout(() => setAiTyping(false), 15000);
    }
  };

  const cancelVoice = () => { recorder.cancel(); };

  // Voice call — 24/7 available; agents only respond live during agent hours, otherwise call gracefully ends.
  const handleCall = async () => {
    const s = await ensureSession();
    if (!s) return;
    setCallOpen(true);
    setCallMinimized(false);
    if (!agentOnline) {
      toast.info(`এখন এজেন্ট অফলাইন (সকাল ${startHour}টা-রাত ${endHour - 12}টা পর্যন্ত live সাপোর্ট) — তবু কল চেষ্টা করছি`, { duration: 4500 });
    }
    try {
      await call.startCall();
    } catch (e: any) {
      console.error('[call start failed]', e);
      toast.error(e?.message || 'কল শুরু করা যায়নি');
    }
  };

  const closeCall = () => { setCallOpen(false); setCallMinimized(false); call.reset(); };
  const minimizeCall = () => { setCallMinimized(true); setCallOpen(false); };
  const expandCall = () => { setCallMinimized(false); setCallOpen(true); };

  const handleQuickReply = async (text: string) => {
    // Live Call shortcut — opens WebRTC call dialog directly
    if (text === '📞 লাইভ কল' || text === 'Talk to Human') {
      await handleCall();
      return;
    }
    setInput(text);
    setTimeout(() => handleSend(), 50);
  };

  // Header label — 24/7 call available, but live-agent text only during hours
  const headerLabel = activeStaff
    ? { name: activeStaff.name, sub: '👤 আমাদের এজেন্ট রিপ্লাই দিচ্ছেন', avatar: activeStaff.avatar }
    : agentOnline
    ? { name: 'স্বর্ণ সুতা AI', sub: '🟢 অনলাইন · এজেন্ট দ্রুত রিপ্লাই দেবেন', avatar: null }
    : { name: 'স্বর্ণ সুতা AI', sub: `🤖 AI সহায়তায় আছে · এজেন্ট সকাল ${startHour}টা-রাত ${endHour - 12}টা`, avatar: null };

  // Match MobileBottomNav first, then fall back to store-wide settings and safe defaults.
  const bottomNavItems = savedBtnConfig?.bottom_nav?.items || DEFAULT_BUTTONS_CONFIG.bottom_nav.items;
  const bottomNavWhatsApp = bottomNavItems.find((item: any) => item.icon_type === 'whatsapp')?.href || '';
  const bottomNavMessenger = bottomNavItems.find((item: any) => item.icon_type === 'messenger')?.href || '';
  const whatsappLink = normalizeWhatsAppLink(bottomNavWhatsApp || settings?.contact_whatsapp_link || settings?.whatsapp_number);
  const messengerLink = normalizeMessengerLink(bottomNavMessenger || settings?.contact_messenger_link || settings?.messenger_link);

  const handleFabClick = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setHasNewMsg(false);
    setMenuOpen(true);
  };

  const closeContactMenu = () => {
    setMenuOpen(false);
  };

  const openLiveChat = () => {
    setMenuOpen(false);
    setOpen(true);
    setHasNewMsg(false);
  };

  return (
    <>
      {/* Backdrop to close menu on outside click */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[2147483645] bg-background/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Ultra-premium contact channel panel */}
      {menuOpen && (
        <div className="fixed bottom-36 right-4 lg:bottom-24 lg:right-6 z-[2147483647] w-[300px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/60 backdrop-blur-xl">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-secondary/30 blur-3xl" />

            {/* Header */}
            <div className="relative px-5 pt-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_theme(colors.emerald.500)]" />
                <h3 className="text-sm font-bold tracking-tight">কীভাবে যোগাযোগ করবেন?</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">আপনার পছন্দের চ্যানেল বেছে নিন</p>
            </div>

            {/* Options */}
            <div className="relative p-2 space-y-1.5">
              {(
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeContactMenu}
                  className="group w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#25D366]/10 border border-transparent hover:border-[#25D366]/30 transition-all duration-200"
                >
                  <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-[#25D366]/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold leading-tight">হোয়াটসঅ্যাপ</div>
                    <div className="text-[11px] text-muted-foreground truncate">সবচেয়ে দ্রুত রেসপন্স</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#25D366]/15 text-[#128C7E] shrink-0">দ্রুত</span>
                </a>
              )}

              {(
                <a
                  href={messengerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeContactMenu}
                  className="group w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#0084FF]/10 border border-transparent hover:border-[#0084FF]/30 transition-all duration-200"
                >
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#00B2FF] via-[#006AFF] to-[#A033FF] flex items-center justify-center shadow-lg shadow-[#0084FF]/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/></svg>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-semibold leading-tight">মেসেঞ্জার</div>
                    <div className="text-[11px] text-muted-foreground truncate">Facebook দিয়ে চ্যাট</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0084FF]/15 text-[#0084FF] shrink-0">Meta</span>
                </a>
              )}

              <button
                onClick={openLiveChat}
                className="group w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all duration-200"
              >
                <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                  <span className={cn('absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background', agentOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                    লাইভ চ্যাট
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-primary to-secondary text-primary-foreground">AI</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {agentOnline ? '🟢 এজেন্ট + AI অনলাইন' : '🤖 AI ২৪/৭ সহায়তায়'}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">২৪/৭</span>
              </button>
            </div>

            {/* Footer */}
            <div className="relative px-4 py-2.5 border-t border-border/50 bg-muted/30">
              <p className="text-[10px] text-center text-muted-foreground">
                ⚡ গড় রেসপন্স টাইম <span className="font-semibold text-foreground">২ মিনিট</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={handleFabClick}
        className={cn(
          'fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[2147483646] h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110',
          'bg-gradient-to-br from-primary to-secondary text-primary-foreground'
        )}
        aria-label="Chat options"
      >
        {(open || menuOpen) ? <X className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        {hasNewMsg && !open && !menuOpen && <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full animate-pulse border-2 border-background" />}
        {!open && !menuOpen && !hasNewMsg && <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-ping" />}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-36 sm:right-4 lg:bottom-24 lg:right-6 z-[2147483647] sm:w-[380px] h-[min(620px,90vh)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center backdrop-blur overflow-hidden">
              {headerLabel.avatar ? (
                <img src={headerLabel.avatar} alt="" className="h-full w-full object-cover" />
              ) : activeStaff ? (
                <User className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-1.5 truncate">
                {headerLabel.name}
                <span className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', agentOnline || activeStaff ? 'bg-emerald-400' : 'bg-amber-400')} />
              </h3>
              <p className="text-[11px] opacity-90 truncate">{headerLabel.sub}</p>
            </div>
            <button
              onClick={handleCall}
              className={cn(
                'h-10 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all shrink-0',
                'bg-primary-foreground text-primary shadow-md hover:scale-105 hover:shadow-lg ring-2 ring-primary-foreground/30'
              )}
              title={agentOnline ? 'এজেন্টকে লাইভ কল করুন' : `এখন এজেন্ট অফলাইন · কিন্তু কল চেষ্টা করতে পারবেন`}
              aria-label="Call agent"
            >
              <Phone className="h-4 w-4 animate-pulse" />
              <span className="hidden sm:inline">লাইভ কল</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-9 w-9 rounded-full bg-foreground/55 text-background hover:bg-foreground/70 ring-2 ring-primary-foreground/60 hover:ring-primary-foreground/90 shadow-md flex items-center justify-center shrink-0 transition-all"
                  title="অ্যাকাউন্ট / লগ আউট"
                  aria-label="Account menu"
                >
                  <MoreVertical className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                      {displayName || user.email || 'লগইন করা'}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer text-xs">
                      <LogOut className="h-3.5 w-3.5 mr-2" /> লগ আউট
                    </DropdownMenuItem>
                  </>
                ) : (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    এখনো লগইন করেননি।<br />
                    <span className="opacity-80">চ্যাট শুরু করতে Google দিয়ে লগইন করুন।</span>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center sm:hidden"><X className="h-4 w-4" /></button>
          </div>

          {/* Auth gate overlay */}
          {showAuthGate && !user && (
            <ChatAuthGate onClose={() => setShowAuthGate(false)} />
          )}
          {showProfileGate && user && (
            <ChatProfileCompleteGate
              user={user}
              defaultName={profile?.full_name || displayName}
              defaultPhone={profile?.phone || ''}
              defaultAddress={profile?.address || ''}
              onComplete={onProfileComplete}
            />
          )}

          {!showAuthGate && !showProfileGate && (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-background to-muted/20">
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} onQuickReply={handleQuickReply} />
                ))}
                {aiTyping && (
                  <div className="flex items-end gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0"><Sparkles className="h-3.5 w-3.5 text-primary-foreground" /></div>
                    <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1">
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="h-1.5 w-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Recording bar */}
              {recorder.recording && (
                <div className="px-3 py-2 bg-destructive/10 border-t border-destructive/30 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs flex-1 tabular-nums">রেকর্ড হচ্ছে · {Math.floor(recorder.elapsedMs / 1000)}s / 60s</span>
                  <Button size="sm" variant="ghost" onClick={cancelVoice} className="h-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={finishVoice} className="h-7 gap-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"><StopCircle className="h-3.5 w-3.5" /> পাঠান</Button>
                </div>
              )}

              {/* Input */}
              {!recorder.recording && (
                <div className="p-2 border-t border-border bg-card flex gap-2 shrink-0">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={uploadingVoice ? 'ভয়েস আপলোড হচ্ছে...' : 'আপনার প্রশ্ন লিখুন...'}
                    className="flex-1 rounded-full"
                    disabled={sending || uploadingVoice}
                  />
                  {input.trim() ? (
                    <Button size="icon" onClick={handleSend} disabled={sending} className="rounded-full bg-gradient-to-br from-primary to-secondary shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={startVoice}
                      disabled={uploadingVoice}
                      className="rounded-full bg-gradient-to-br from-primary to-secondary shrink-0"
                      title="ভয়েস মেসেজ"
                    >
                      {uploadingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              )}
              <div className="px-3 pb-2 text-[10px] text-center text-muted-foreground">
                ⚡ Powered by AI · উত্তর সবসময় ১০০% সঠিক নাও হতে পারে
              </div>
            </>
          )}
        </div>
      )}

      {/* Voice call dialog */}
      <VoiceCallDialog
        open={callOpen && !callMinimized}
        status={call.status}
        durationSec={call.durationSec}
        muted={call.muted}
        error={call.error}
        errorCode={call.errorCode}
        agentOnline={agentOnline}
        audioUnlocked={call.audioUnlocked}
        pc={call.pc}
        connectedAt={call.connectedAt}
        onToggleMute={call.toggleMute}
        onEnableSpeaker={call.enableSpeaker}
        onEnd={call.endCall}
        onClose={closeCall}
        onMinimize={minimizeCall}
        onRetry={call.retry}
      />
      {callMinimized && call.isActive && (
        <VoiceCallMiniBar
          status={call.status}
          durationSec={call.durationSec}
          muted={call.muted}
          audioUnlocked={call.audioUnlocked}
          pc={call.pc}
          connectedAt={call.connectedAt}
          onExpand={expandCall}
          onToggleMute={call.toggleMute}
          onEnableSpeaker={call.enableSpeaker}
          onEnd={call.endCall}
        />
      )}
    </>
  );
}

function MessageBubble({ m, onQuickReply }: { m: ChatMessage; onQuickReply: (t: string) => void }) {
  const isVisitor = m.sender_type === 'visitor';
  const isAI = m.sender_type === 'ai';
  const isStaff = m.sender_type === 'staff';
  const meta = m.metadata || {};

  return (
    <div className={cn('flex flex-col gap-1.5', isVisitor && 'items-end')}>
      <div className={cn('flex items-end gap-2 max-w-[88%]', isVisitor ? 'self-end flex-row-reverse' : 'self-start')}>
        {!isVisitor && (
          <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden', isAI ? 'bg-gradient-to-br from-primary to-secondary' : 'bg-secondary')}>
            {isStaff && m.sender_avatar ? (
              <img src={m.sender_avatar} alt="" className="h-full w-full object-cover" />
            ) : isAI ? (
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            ) : (
              <User className="h-3.5 w-3.5 text-secondary-foreground" />
            )}
          </div>
        )}
        <div className={cn(
          'px-3 py-2 rounded-2xl text-sm break-words',
          isVisitor ? 'bg-primary text-primary-foreground rounded-br-sm' : isAI ? 'bg-card border border-border rounded-bl-sm shadow-sm' : 'bg-secondary text-secondary-foreground rounded-bl-sm',
        )}>
          {isStaff && <div className="text-[10px] opacity-70 mb-0.5 font-medium">👤 {m.sender_name || 'Staff'}</div>}
          {m.image_url && <img src={m.image_url} alt="attachment" className="rounded-lg mb-1 max-w-full" />}
          {m.voice_url ? (
            <VoiceMessage url={m.voice_url} durationMs={m.voice_duration_ms} variant={isVisitor ? 'visitor' : isStaff ? 'staff' : 'ai'} />
          ) : isAI ? (
            <div className="prose prose-sm max-w-none [&_p]:my-1 [&_a]:text-primary [&_a]:underline [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.message}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{m.message}</p>
          )}
        </div>
      </div>

      {/* Suggested products — visual cards with image */}
      {isAI && meta.suggested_products?.length > 0 && (
        <div className="ml-9 max-w-[88%] space-y-1.5">
          {meta.category_label && (
            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
              🏷️ {meta.category_label}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {meta.suggested_products.slice(0, 6).map((p: any) => {
              // Pricing — supports new metadata (is_sale/regular_price/discount_percent) and legacy (price/original_price)
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
                  className="flex items-center gap-2.5 bg-card border border-border rounded-xl p-2 hover:border-primary hover:shadow-sm transition-all"
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
                    অর্ডার →
                  </span>
                </Link>
              );
            })}
          </div>
          {meta.category_link && (
            <Link
              to={meta.category_link}
              className="block text-center text-[11px] text-primary font-semibold py-1 hover:underline"
            >
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
          {meta.address_card.map_link && (
            <a
              href={meta.address_card.map_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium underline underline-offset-2"
            >
              🗺️ গুগল ম্যাপে দেখুন
            </a>
          )}
        </div>
      )}

      {/* Quick replies */}
      {isAI && meta.quick_replies?.length > 0 && (
        <div className="ml-9 flex flex-wrap gap-1.5 max-w-[88%]">
          {meta.quick_replies.map((q: string) => (
            <button
              key={q}
              onClick={() => onQuickReply(q)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1',
                q === 'Talk to Human' || q === '📞 লাইভ কল'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white font-semibold'
                  : 'border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {(q === 'Talk to Human' || q === '📞 লাইভ কল') && <Phone className="h-3 w-3" />}
              {q === 'Talk to Human' ? '📞 লাইভ কল' : q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
