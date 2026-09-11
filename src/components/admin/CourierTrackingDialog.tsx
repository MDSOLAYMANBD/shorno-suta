import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Send, Clock, StickyNote, Truck, MapPin, Phone, User } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

const SUPABASE_URL = 'https://xxucasikopqtcztbgfbw.supabase.co';

interface CourierTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber?: string;
  consignmentId?: string | null;
  courierStatus?: string | null;
  courierProvider?: string | null;
  onUpdate: () => void;
}

interface OrderNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
}

interface TrackingEvent {
  id: string;
  status: string | null;
  note: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  hub_name: string | null;
  hub_phone: string | null;
  created_at: string;
}

const statusColorMap: Record<string, string> = {
  in_review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  pending: 'bg-orange-100 text-orange-800 border-orange-300',
  delivered: 'bg-green-100 text-green-800 border-green-300',
  partial_delivered: 'bg-blue-100 text-blue-800 border-blue-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  hold: 'bg-purple-100 text-purple-800 border-purple-300',
  unknown: 'bg-muted text-muted-foreground',
};

const statusLabelMap: Record<string, string> = {
  in_review: 'রিভিউতে আছে',
  pending: 'পেন্ডিং',
  delivered: 'ডেলিভারড',
  partial_delivered: 'আংশিক ডেলিভারড',
  cancelled: 'বাতিল',
  hold: 'হোল্ড',
};

export default function CourierTrackingDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  consignmentId,
  courierStatus,
  courierProvider,
  onUpdate,
}: CourierTrackingDialogProps) {
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pageSyncLoading, setPageSyncLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState(courierStatus || '');
  const [savingNote, setSavingNote] = useState(false);
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchNotes();
      fetchTrackingEvents();
      fetchEntryDate();
      setLiveStatus(courierStatus || '');
      if (consignmentId) {
        refreshStatus();
      }
    }
  }, [open, orderId]);

  const fetchEntryDate = async () => {
    const { data } = await supabase
      .from('orders')
      .select('courier_entry_date')
      .eq('id', orderId)
      .single();
    if (data?.courier_entry_date) setEntryDate(data.courier_entry_date);
  };

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_notes')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (!error && data) setNotes(data);
    setLoading(false);
  };

  const fetchTrackingEvents = async () => {
    setTrackingLoading(true);
    const { data, error } = await (supabase as any)
      .from('courier_tracking_events')
      .select('id, status, note, rider_name, rider_phone, hub_name, hub_phone, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (!error && data) setTrackingEvents(data);
    setTrackingLoading(false);
  };

  const refreshStatus = async () => {
    if (!consignmentId) return;
    setStatusLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/steadfast-courier?action=check_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ consignment_id: consignmentId }),
      });
      const result = await res.json();
      if (res.ok && result.status) {
        const oldStatus = liveStatus;
        const newStatus = result.status;
        setLiveStatus(newStatus);

        if (oldStatus && newStatus !== oldStatus) {
          const oldLabel = statusLabelMap[oldStatus] || oldStatus;
          const newLabel = statusLabelMap[newStatus] || newStatus;
          await supabase.from('order_notes').insert({
            order_id: orderId,
            note: `স্ট্যাটাস আপডেট: ${oldLabel} → ${newLabel}`,
            created_by: 'System',
          });
          fetchNotes();
        }

        toast.success('স্ট্যাটাস আপডেট হয়েছে');
        onUpdate();
      } else {
        toast.error(result.error || 'স্ট্যাটাস আনতে সমস্যা');
      }
    } catch {
      toast.error('স্ট্যাটাস আনতে সমস্যা হয়েছে');
    } finally {
      setStatusLoading(false);
    }
  };

  const syncFromSteadfastPage = async () => {
    if (!consignmentId) return;
    setPageSyncLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/steadfast-tracking-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sync failed');
      if (result.inserted > 0) {
        toast.success(`${result.inserted} টি নতুন আপডেট এসেছে`);
      } else {
        toast.info('সব আপডেট আগেই সিঙ্ক করা আছে');
      }
      fetchTrackingEvents();
      onUpdate();
    } catch (e: any) {
      toast.error(e.message || 'Steadfast থেকে আনতে সমস্যা');
    } finally {
      setPageSyncLoading(false);
    }
  };
  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from('order_notes').insert({
        order_id: orderId,
        note: newNote.trim(),
        created_by: 'Admin',
      });
      if (error) throw error;
      setNewNote('');
      toast.success('নোট যোগ হয়েছে');
      fetchNotes();
    } catch {
      toast.error('নোট সেভ করতে সমস্যা');
    } finally {
      setSavingNote(false);
    }
  };

  const statusClass = statusColorMap[liveStatus] || statusColorMap.unknown;
  const statusLabel = statusLabelMap[liveStatus] || liveStatus || 'অজানা';

  // Get latest rider/hub info from tracking events
  const latestWithRider = trackingEvents.find(e => e.rider_name || e.rider_phone);
  const latestWithHub = trackingEvents.find(e => e.hub_name || e.hub_phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            🚚 কুরিয়ার ট্র্যাকিং
            {orderNumber && <span className="text-muted-foreground font-normal text-sm">({orderNumber})</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Status Card */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">কনসাইনমেন্ট ID</span>
            <span className="text-xs font-mono">{consignmentId || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">বর্তমান স্ট্যাটাস</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${statusClass}`}>
                {statusLabel}
              </Badge>
              {consignmentId && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={refreshStatus} disabled={statusLoading}>
                  <RefreshCw className={`h-3 w-3 ${statusLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>
          {entryDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" /> কুরিয়ারে পাঠানো
              </span>
              <span className="text-xs">
                {format(new Date(entryDate), 'dd MMM yyyy, hh:mm a', { locale: bn })}
              </span>
            </div>
          )}

          {/* Assigned To / Hub / Rider Info */}
          {(latestWithHub || latestWithRider) && (
            <div className="border-t pt-2 mt-2 space-y-1.5">
              {latestWithHub && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> হাব
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{latestWithHub.hub_name}</span>
                    {latestWithHub.hub_phone && (
                      <a href={`tel:${latestWithHub.hub_phone}`}>
                        <Button size="icon" variant="ghost" className="h-5 w-5">
                          <Phone className="h-3 w-3 text-primary" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
              {latestWithRider && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> ডেলিভারিম্যান
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{latestWithRider.rider_name}</span>
                    {latestWithRider.rider_phone && (
                      <a href={`tel:${latestWithRider.rider_phone}`}>
                        <Button size="icon" variant="ghost" className="h-5 w-5">
                          <Phone className="h-3 w-3 text-primary" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs: Tracking & Notes */}
        <Tabs defaultValue="tracking" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="tracking" className="flex-1 text-xs">
              🛤️ ট্র্যাকিং ({trackingEvents.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 text-xs">
              📝 নোটস ({notes.length})
            </TabsTrigger>
          </TabsList>

          {/* Tracking Timeline */}
          <TabsContent value="tracking" className="flex-1 min-h-0 mt-2 flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground text-center">
              কুরিয়ার আপডেট প্রতি ১০ মিনিটে অটোমেটিক সিঙ্ক হয় (স্ট্যাটাস, ডেলিভারিম্যান, হাব, dispatch ইত্যাদি)
            </p>
            <ScrollArea className="h-[220px] rounded-md border p-2">
              {trackingLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">লোড হচ্ছে...</p>
              ) : trackingEvents.length === 0 ? (
                <div className="text-center py-6 space-y-1">
                  <Truck className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">কোনো ট্র্যাকিং আপডেট নেই</p>
                  <p className="text-[10px] text-muted-foreground/60">Steadfast ওয়েবহুক সেটআপ করলে এখানে লাইভ আপডেট দেখাবে</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trackingEvents.map((event) => {
                    const evtStatusClass = statusColorMap[event.status || ''] || statusColorMap.unknown;
                    return (
                      <div key={event.id} className="relative pl-4 border-l-2 border-primary/30">
                        <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                        {event.status && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mb-1 ${evtStatusClass}`}>
                            {statusLabelMap[event.status] || event.status}
                          </Badge>
                        )}
                        {event.note && (
                          <p className="text-sm">{event.note}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.created_at), 'dd MMM yyyy, hh:mm a', { locale: bn })}
                          </span>
                          {event.rider_name && (
                            <span className="text-[10px] text-muted-foreground">👤 {event.rider_name}</span>
                          )}
                          {event.hub_name && (
                            <span className="text-[10px] text-muted-foreground">📍 {event.hub_name}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 min-h-0 mt-2 flex flex-col gap-2">
            <ScrollArea className="h-[180px] rounded-md border p-2">
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-4">লোড হচ্ছে...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">কোনো নোট নেই</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => {
                    const isSystem = note.created_by === 'System';
                    return (
                      <div key={note.id} className="relative pl-4 border-l-2 border-muted-foreground/20">
                        <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${isSystem ? 'bg-blue-500' : 'bg-primary'}`} />
                        <p className={`text-sm ${isSystem ? 'text-blue-700 dark:text-blue-400 font-medium' : ''}`}>{note.note}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(note.created_at), 'dd MMM yyyy, hh:mm a', { locale: bn })}
                          </span>
                          {note.created_by && (
                            <span className={`text-[10px] ${isSystem ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>— {note.created_by}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Add Note */}
            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="নোট লিখুন..."
                className="text-sm h-9"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addNote()}
              />
              <Button size="sm" className="h-9 px-3" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
