import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Save, ChevronDown, Send, Wallet, CheckCircle2, Loader2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AutomasDiagnosticDialog from './AutomasDiagnosticDialog';

type ProviderRow = {
  id: string;
  provider_name: string;
  api_url: string | null;
  api_key: string | null;
  sender_id: string | null;
  username: string | null;
  password: string | null;
  is_active: boolean;
};

const KNOWN: { name: string; label: string; icon: string; defaults?: Partial<ProviderRow> }[] = [
  { name: 'mimsms', label: 'MimSMS', icon: '📱' },
  { name: 'automas', label: 'Automas SMS', icon: '🚀', defaults: { api_url: 'https://api.automas.com.bd/smsapiv4' } },
];

function useSmsProviders() {
  return useQuery({
    queryKey: ['sms_providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_providers' as any)
        .select('*')
        .order('provider_name');
      if (error) throw error;
      return (data as unknown as ProviderRow[]) || [];
    },
    staleTime: 30_000,
  });
}

export default function SmsProvidersSection() {
  const { data: providers = [], isLoading, refetch } = useSmsProviders();
  const qc = useQueryClient();

  const setActive = async (name: string) => {
    const row = providers.find((p) => p.provider_name === name);
    if (!row) return toast.error('Provider not found');
    const { error } = await supabase
      .from('sms_providers' as any)
      .update({ is_active: true } as any)
      .eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(`${name} এখন Active`);
    qc.invalidateQueries({ queryKey: ['sms_providers'] });
  };

  const active = providers.find((p) => p.is_active);

  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
          <div className="flex items-center gap-3">
            <span className="text-xl">📨</span>
            <span className="font-medium">SMS Gateway (Multi-Provider)</span>
            {active && (
              <Badge variant="outline" className="ml-2 border-emerald-300 text-emerald-700 bg-emerald-50">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {active.provider_name} Active
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 border-0 shadow-none">
          <CardContent className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              একই সময়ে একটি Provider Active থাকবে। Active করলে অন্যগুলো অটো-Inactive হবে।
              সব SMS (Order, OTP, Notification, Marketing) Active Provider দিয়ে যাবে।
            </p>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-3">
                {KNOWN.map((k) => {
                  const row = providers.find((p) => p.provider_name === k.name);
                  return (
                    <ProviderCard
                      key={k.name}
                      meta={k}
                      row={row}
                      onSaved={() => refetch()}
                      onActivate={() => setActive(k.name)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProviderCard({
  meta,
  row,
  onSaved,
  onActivate,
}: {
  meta: { name: string; label: string; icon: string; defaults?: Partial<ProviderRow> };
  row?: ProviderRow;
  onSaved: () => void;
  onActivate: () => void;
}) {
  const [form, setForm] = useState({
    api_url: row?.api_url ?? meta.defaults?.api_url ?? '',
    api_key: row?.api_key ?? '',
    sender_id: row?.sender_id ?? '',
    username: row?.username ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const isMim = meta.name === 'mimsms';

  const save = async () => {
    if (!row) return toast.error('Provider row missing — re-run migration');
    setSaving(true);
    const { error } = await supabase
      .from('sms_providers' as any)
      .update({
        api_url: form.api_url || null,
        api_key: form.api_key || null,
        sender_id: form.sender_id || null,
        username: form.username || null,
      } as any)
      .eq('id', row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${meta.label} সেভ হয়েছে`);
    onSaved();
  };

  const checkBalance = async () => {
    setBalanceLoading(true);
    setBalance(null);
    const { data, error } = await supabase.functions.invoke('check-sms-balance', {
      body: { provider: meta.name },
    });
    setBalanceLoading(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    setBalance((data as any)?.balance ?? 'N/A');
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className="font-semibold text-sm">{meta.label}</span>
          {row?.is_active && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">ACTIVE</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Active</Label>
          <Switch checked={!!row?.is_active} onCheckedChange={() => !row?.is_active && onActivate()} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {!isMim && (
          <div>
            <Label className="text-xs">API URL</Label>
            <Input value={form.api_url} onChange={(e) => setForm((p) => ({ ...p, api_url: e.target.value }))} placeholder="https://api.automas.com.bd/smsapiv4" />
          </div>
        )}
        {isMim && (
          <div>
            <Label className="text-xs">Username</Label>
            <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
          </div>
        )}
        <div>
          <Label className="text-xs">API Key</Label>
          <Input type="password" value={form.api_key} onChange={(e) => setForm((p) => ({ ...p, api_key: e.target.value }))} placeholder="••••••••" />
        </div>
        <div>
          <Label className="text-xs">Sender ID</Label>
          <Input value={form.sender_id} onChange={(e) => setForm((p) => ({ ...p, sender_id: e.target.value }))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
          <Send className="h-4 w-4 mr-1" /> Test SMS
        </Button>
        <Button size="sm" variant="outline" onClick={checkBalance} disabled={balanceLoading}>
          {balanceLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wallet className="h-4 w-4 mr-1" />} Check Balance
        </Button>
        {meta.name === 'automas' && (
          <Button size="sm" variant="outline" onClick={() => setDiagOpen(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
            <Activity className="h-4 w-4 mr-1" /> Automas Diagnostic
          </Button>
        )}
        {balance !== null && (
          <span className="text-xs px-2 py-1 rounded bg-muted self-center">
            Balance: <span className="font-semibold tabular-nums">{balance}</span>
          </span>
        )}
      </div>

      <TestSmsDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        provider={meta.name}
        providerLabel={meta.label}
      />
      {meta.name === 'automas' && (
        <AutomasDiagnosticDialog
          open={diagOpen}
          onOpenChange={setDiagOpen}
          senderId={form.sender_id}
          apiUrl={form.api_url || 'https://api.automas.com.bd/smsapiv4'}
        />
      )}
    </div>
  );
}

function TestSmsDialog({
  open,
  onOpenChange,
  provider,
  providerLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: string;
  providerLabel: string;
}) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('This is a test SMS from Shorno Suta.');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!/^01[3-9]\d{8}$/.test(phone.trim())) return toast.error('সঠিক BD মোবাইল নম্বর দিন');
    if (!message.trim()) return toast.error('Message লিখুন');
    setSending(true);
    const { data, error } = await supabase.functions.invoke('test-sms-provider', {
      body: { provider, phone: phone.trim(), message: message.trim() },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const d = data as any;
    if (d?.success) {
      toast.success(`SMS পাঠানো হয়েছে — ${providerLabel}${d.message_id ? ` (ID: ${d.message_id})` : ''}`);
      onOpenChange(false);
    } else {
      toast.error(d?.error || 'SMS পাঠানো ব্যর্থ');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test SMS — {providerLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">মোবাইল নম্বর (01XXXXXXXXX)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017XXXXXXXX" />
          </div>
          <div>
            <Label className="text-xs">Message</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} পাঠান
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
