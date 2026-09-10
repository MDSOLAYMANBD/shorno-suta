import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { normalizeBDPhone } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Link2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type RawRow = Record<string, string>;

interface ColumnMap {
  name: string;
  phone: string;
  address: string;
  status: string;
  date: string;
}

const NONE = '__none__';

// Guesses which spreadsheet column holds each field by header name — covers
// this store's own "Facebook Order Manage" sheet layout (Name, Number,
// Adress, Status, Date) plus common English/Bangla variants, so the admin
// usually doesn't have to touch the mapping dropdowns at all.
function guessColumn(headers: string[], patterns: RegExp[]): string {
  for (const p of patterns) {
    const hit = headers.find(h => p.test(h));
    if (hit) return hit;
  }
  return NONE;
}

function guessColumnMap(headers: string[]): ColumnMap {
  return {
    name: guessColumn(headers, [/^name$/i, /নাম/i, /customer/i]),
    phone: guessColumn(headers, [/^number$/i, /phone/i, /mobile/i, /নম্বর/i, /ফোন/i]),
    address: guessColumn(headers, [/adress/i, /address/i, /ঠিকানা/i]),
    status: guessColumn(headers, [/^status$/i, /স্ট্যাটাস/i]),
    date: guessColumn(headers, [/^date$/i, /তারিখ/i]),
  };
}

// A row counts as a "delivered" (successful) order unless its status clearly
// says otherwise — matches this sheet's own vocabulary (Return / Paid Return
// / Cancel), read the same way regardless of case.
function isDeliveredStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  if (!s) return true;
  return !s.includes('return') && !s.includes('cancel') && !s.includes('বাতিল') && !s.includes('ফেরত');
}

function parseSheetLink(url: string): { id: string; gid: string | null } | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gidMatch = url.match(/[?#&]gid=(\d+)/);
  return { id: m[1], gid: gidMatch ? gidMatch[1] : null };
}

export default function AdminCustomerImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({ name: NONE, phone: NONE, address: NONE, status: NONE, date: NONE });
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; invalidPhone: number } | null>(null);

  const loadCsvText = (csvText: string) => {
    const parsed = Papa.parse<RawRow>(csvText, { header: true, skipEmptyLines: true });
    const cleanHeaders = (parsed.meta.fields || []).map(h => (h || '').trim()).filter(Boolean);
    setHeaders(cleanHeaders);
    setColMap(guessColumnMap(cleanHeaders));
    setRows(parsed.data);
    setResult(null);
  };

  const handleFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadCsvText(String(reader.result || ''));
      } catch (e: any) {
        toast.error('ফাইল পড়তে সমস্যা হয়েছে: ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => { toast.error('ফাইল পড়া যায়নি'); setLoading(false); };
    reader.readAsText(file);
  };

  const handleSheetUrl = async () => {
    const parsed = parseSheetLink(sheetUrl.trim());
    if (!parsed) { toast.error('সঠিক Google Sheet লিংক দিন'); return; }
    setLoading(true);
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv${parsed.gid ? `&gid=${parsed.gid}` : ''}`;
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error(`শিট থেকে ডেটা আনা যায়নি (HTTP ${res.status}) — শিটটা "Anyone with the link can view" করা আছে কিনা দেখুন`);
      const text = await res.text();
      if (text.trim().startsWith('<')) throw new Error('শিটটা পাবলিক না — শেয়ার সেটিংসে "Anyone with the link can view" করে আবার চেষ্টা করুন');
      loadCsvText(text);
      toast.success('শিট থেকে ডেটা লোড হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'শিট লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  };

  const mappingComplete = colMap.name !== NONE && colMap.phone !== NONE;

  const grouped = useMemo(() => {
    if (!mappingComplete) return [];
    const map = new Map<string, { name: string; address: string; total: number; delivered: number; lastDate: string | null }>();
    let invalidPhone = 0;
    for (const row of rows) {
      const rawPhone = row[colMap.phone] || '';
      const phone = normalizeBDPhone(rawPhone);
      if (!/^01[3-9]\d{8}$/.test(phone)) { invalidPhone++; continue; }
      const name = (row[colMap.name] || '').trim();
      const address = colMap.address !== NONE ? (row[colMap.address] || '').trim() : '';
      const status = colMap.status !== NONE ? (row[colMap.status] || '') : '';
      const dateStr = colMap.date !== NONE ? (row[colMap.date] || '').trim() : '';

      const existing = map.get(phone) || { name: '', address: '', total: 0, delivered: 0, lastDate: null };
      existing.total += 1;
      if (isDeliveredStatus(status)) existing.delivered += 1;
      if (name) existing.name = name;
      if (address) existing.address = address;
      if (dateStr && (!existing.lastDate || dateStr > existing.lastDate)) existing.lastDate = dateStr;
      map.set(phone, existing);
    }
    return { entries: Array.from(map.entries()), invalidPhone };
  }, [rows, colMap, mappingComplete]);

  const handleImport = async () => {
    if (!Array.isArray(grouped) && grouped.entries.length === 0) { toast.error('কোনো বৈধ সারি পাওয়া যায়নি'); return; }
    const { entries, invalidPhone } = grouped as { entries: [string, any][]; invalidPhone: number };
    if (entries.length === 0) { toast.error('কোনো বৈধ ফোন নম্বর পাওয়া যায়নি'); return; }

    setImporting(true);
    try {
      const phones = entries.map(([phone]) => phone);
      const existingSet = new Set<string>();
      for (let i = 0; i < phones.length; i += 500) {
        const batch = phones.slice(i, i + 500);
        const { data } = await supabase.from('customers').select('phone').in('phone', batch);
        (data || []).forEach((r: any) => existingSet.add(r.phone));
      }

      // Only create rows for phones with no customer record at all — an
      // existing customer's total_orders/total_spent are kept in sync by
      // recompute_customer_stats from the real orders table, so overwriting
      // them here with historical sheet counts would corrupt accurate live
      // data the next time they place a real order.
      const toInsert = entries
        .filter(([phone]) => !existingSet.has(phone))
        .map(([phone, v]) => ({
          phone,
          name: v.name || 'Unknown',
          address: v.address || '',
          total_orders: v.total,
          delivered_orders: v.delivered,
          total_spent: 0,
          last_order_date: v.lastDate ? new Date(v.lastDate).toISOString() : null,
        }));

      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error } = await supabase.from('customers').insert(batch as any);
        if (error) throw error;
      }

      setResult({ added: toInsert.length, skipped: entries.length - toInsert.length, invalidPhone });
      toast.success(`${toInsert.length} জন নতুন কাস্টমার যোগ হয়েছে`);
    } catch (e: any) {
      toast.error('ইম্পোর্ট ব্যর্থ: ' + (e?.message || ''));
    } finally {
      setImporting(false);
    }
  };

  const entries = Array.isArray(grouped) ? [] : grouped.entries;
  const invalidPhoneCount = Array.isArray(grouped) ? 0 : grouped.invalidPhone;

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <div className="text-sm text-muted-foreground">কাস্টমার ইম্পোর্ট</div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">১. ডেটা আনুন</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>CSV/Excel ফাইল আপলোড</Label>
            <p className="text-xs text-muted-foreground mb-1">Google Sheet থেকে File → Download → Comma-separated values (.csv) করে এখানে দিন</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" /> ফাইল বেছে নিন
            </Button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">অথবা</span></div>
          </div>

          <div>
            <Label>Google Sheet লিংক (পাবলিক শেয়ার করা থাকতে হবে)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              <Button variant="outline" onClick={handleSheetUrl} disabled={loading || !sheetUrl.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              যেই ট্যাব/মাস ইম্পোর্ট করতে চান, সেটা খুলে ব্রাউজারের URL কপি করুন (URL-এ থাকা gid দেখে সঠিক ট্যাব বেছে নেওয়া হবে) — একবারে একটা ট্যাবই ইম্পোর্ট হবে।
            </p>
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">২. কলাম মিলান</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{rows.length} টা সারি পাওয়া গেছে। কোন কলাম কী বোঝাচ্ছে চেক করে নিন — স্বয়ংক্রিয়ভাবে অনুমান করা হয়েছে, ভুল থাকলে ঠিক করুন।</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['name', 'নাম *'], ['phone', 'ফোন নম্বর *'], ['address', 'ঠিকানা'], ['status', 'স্ট্যাটাস (ডেলিভারড/রিটার্ন বোঝাতে)'], ['date', 'তারিখ'],
              ] as [keyof ColumnMap, string][]).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Select value={colMap[key]} onValueChange={v => setColMap(m => ({ ...m, [key]: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— বেছে নিন —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!mappingComplete && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> নাম ও ফোন নম্বর কলাম বাছাই করা আবশ্যক</p>
            )}
          </CardContent>
        </Card>
      )}

      {mappingComplete && rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">৩. প্রিভিউ ও ইম্পোর্ট</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2"><div className="text-lg font-bold">{rows.length}</div><div className="text-[10px] text-muted-foreground">মোট সারি</div></div>
              <div className="bg-muted/50 rounded p-2"><div className="text-lg font-bold">{entries.length}</div><div className="text-[10px] text-muted-foreground">আলাদা কাস্টমার</div></div>
              <div className="bg-muted/50 rounded p-2"><div className="text-lg font-bold text-destructive">{invalidPhoneCount}</div><div className="text-[10px] text-muted-foreground">ভুল/খালি ফোন নম্বর (বাদ যাবে)</div></div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr>
                  <th className="text-left p-1.5">নাম</th><th className="text-left p-1.5">ফোন</th><th className="text-left p-1.5">ঠিকানা</th><th className="text-right p-1.5">অর্ডার</th>
                </tr></thead>
                <tbody>
                  {entries.slice(0, 8).map(([phone, v]: [string, any]) => (
                    <tr key={phone} className="border-t">
                      <td className="p-1.5">{v.name || '—'}</td>
                      <td className="p-1.5">{phone}</td>
                      <td className="p-1.5 max-w-[160px] truncate">{v.address || '—'}</td>
                      <td className="p-1.5 text-right">{v.total} ({v.delivered} ডেলিভারড)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entries.length > 8 && <p className="text-[11px] text-muted-foreground text-center py-1">... আরও {entries.length - 8} জন</p>}
            </div>

            <p className="text-xs text-muted-foreground">
              যেসব ফোন নম্বর ইতিমধ্যে সিস্টেমে আছে (আসল অর্ডার থেকে) সেগুলো বাদ দেওয়া হবে — তাদের হিসাব ঠিক রাখতে।
            </p>

            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> ইম্পোর্ট হচ্ছে...</> : `ইম্পোর্ট করুন (${entries.length} জন)`}
            </Button>

            {result && (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-sm space-y-1">
                <p className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium"><CheckCircle2 className="h-4 w-4" /> সম্পন্ন হয়েছে</p>
                <p>✅ নতুন যোগ হয়েছে: {result.added} জন</p>
                <p>⏭️ স্কিপ হয়েছে (আগে থেকেই ছিল): {result.skipped} জন</p>
                {result.invalidPhone > 0 && <p>⚠️ ভুল ফোন নম্বরের কারণে বাদ: {result.invalidPhone} সারি</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
