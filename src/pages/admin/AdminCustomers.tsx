import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Phone, User, MapPin, ShoppingCart, Download, Search, Star, Users, TrendingUp, ChevronLeft, ChevronRight, FileText, Upload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import CustomerProfileDialog from '@/components/admin/CustomerProfileDialog';
import { fetchAllRows } from '@/lib/supabaseHelpers';

const PAGE_SIZE = 500;

type OrderFilter = 'all' | '2+' | '3+' | '5+';

export default function AdminCustomers() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<any>(null);

  // Debounce search
  const searchTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[0] = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 400);
  }, []);

  // Summary stats query (all customers, no pagination)
  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const { count: total } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      const { count: repeat } = await supabase.from('customers').select('*', { count: 'exact', head: true }).gte('delivered_orders', 2);
      const { data: revenueData } = await supabase.from('customers').select('total_spent');
      const totalRevenue = (revenueData || []).reduce((s: number, c: any) => s + (c.total_spent || 0), 0);
      return { total: total || 0, repeat: repeat || 0, totalRevenue };
    },
    staleTime: 60000,
  });

  // Main paginated query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', page, debouncedSearch, orderFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from('customers').select('*', { count: 'exact' });

      // Search
      if (debouncedSearch.trim()) {
        query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }

      // Order filter
      const minOrders = orderFilter === '2+' ? 2 : orderFilter === '3+' ? 3 : orderFilter === '5+' ? 5 : 0;
      if (minOrders > 0) {
        query = query.gte('total_orders', minOrders);
      }

      // Date filter
      if (startDate) query = query.gte('last_order_date', startDate);
      if (endDate) query = query.lte('last_order_date', endDate + 'T23:59:59');

      // Order & pagination
      query = query.order('last_order_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      return { customers: data || [], totalCount: count || 0 };
    },
  });

  const customers = data?.customers || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(customers.map((c: any) => c.id)));
      setSelectAll(true);
    }
  };

  const getSelectedCustomers = () => {
    if (selectedIds.size === 0) return customers;
    return customers.filter((c: any) => selectedIds.has(c.id));
  };

  // Fetch ALL customers across all pages matching current filters (bypass 1000-row limit)
  const fetchAllFilteredCustomers = async (): Promise<any[]> => {
    return await fetchAllRows<any>(() => {
      let q = supabase.from('customers').select('*');
      if (debouncedSearch.trim()) {
        q = q.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }
      const minOrders = orderFilter === '2+' ? 2 : orderFilter === '3+' ? 3 : orderFilter === '5+' ? 5 : 0;
      if (minOrders > 0) q = q.gte('total_orders', minOrders);
      if (startDate) q = q.gte('last_order_date', startDate);
      if (endDate) q = q.lte('last_order_date', endDate + 'T23:59:59');
      return q.order('last_order_date', { ascending: false, nullsFirst: false });
    });
  };

  // Download helpers
  const formatPhone = (phone: string) => {
    let p = (phone || '').replace(/\s+/g, '');
    if (!p.startsWith('+')) p = p.startsWith('88') ? '+' + p : '+88' + p;
    return p;
  };

  // Strip characters that break naive (non-quote-aware) CSV parsers. Real
  // customer names/addresses in this DB routinely contain literal commas
  // (e.g. "নাম,,জনি", "Munna,,,,,c/o akm Badrudduza") — quoting the field
  // doesn't help because Google Ads' Customer Match uploader (confirmed) and
  // likely Facebook's ad account CSV import split on every comma regardless
  // of quotes, silently corrupting row column counts.
  const csvField = (v: any) => String(v ?? '').replace(/["\r\n]/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  const downloadFacebookCSV = async () => {
    const tid = toast.loading('সব কাস্টমার লোড হচ্ছে...');
    try {
      const list = selectedIds.size > 0 ? getSelectedCustomers() : await fetchAllFilteredCustomers();
      const rows = list.map((c: any) => {
        const parts = csvField(c.name).split(' ');
        return [formatPhone(c.phone), parts[0] || '', parts.slice(1).join(' ') || '', 'BD', csvField(c.address), c.total_spent || 0].join(',');
      });
      const csv = 'phone,fn,ln,country,city,value\n' + rows.join('\n');
      downloadFile(csv, `facebook-customers-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${list.length} জন কাস্টমারের Facebook CSV ডাউনলোড হয়েছে`, { id: tid });
    } catch (e: any) {
      toast.error('ডাউনলোড ব্যর্থ: ' + (e?.message || ''), { id: tid });
    }
  };

  // Google Ads Customer Match format — header must be exactly
  // Email,Phone,First Name,Last Name,Country,Zip in that order (Google
  // rejects a mismatched order/casing, not just a mismatched column count).
  // We don't store email or zip, so those columns are left blank —
  // phone-only rows are a valid Customer Match list.
  const downloadGoogleCSV = async () => {
    const tid = toast.loading('সব কাস্টমার লোড হচ্ছে...');
    try {
      const list = selectedIds.size > 0 ? getSelectedCustomers() : await fetchAllFilteredCustomers();
      const rows = list.map((c: any) => {
        const parts = csvField(c.name).split(' ');
        return ['', formatPhone(c.phone), parts[0] || '', parts.slice(1).join(' ') || '', 'BD', ''].join(',');
      });
      const csv = 'Email,Phone,First Name,Last Name,Country,Zip\n' + rows.join('\n');
      downloadFile(csv, `google-ads-customers-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${list.length} জন কাস্টমারের Google Ads CSV ডাউনলোড হয়েছে`, { id: tid });
    } catch (e: any) {
      toast.error('ডাউনলোড ব্যর্থ: ' + (e?.message || ''), { id: tid });
    }
  };

  const downloadPhoneCSV = async () => {
    const tid = toast.loading('সব নম্বর লোড হচ্ছে...');
    try {
      const list = selectedIds.size > 0 ? getSelectedCustomers() : await fetchAllFilteredCustomers();
      const rows = list.map((c: any) => formatPhone(c.phone));
      const csv = 'phone\n' + rows.join('\n');
      downloadFile(csv, `phone-numbers-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`${list.length} টি নম্বর ডাউনলোড হয়েছে`, { id: tid });
    } catch (e: any) {
      toast.error('ডাউনলোড ব্যর্থ: ' + (e?.message || ''), { id: tid });
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const orderFilters: { label: string; value: OrderFilter; icon?: any }[] = [
    { label: 'সব', value: 'all' },
    { label: '2+ অর্ডার', value: '2+' },
    { label: '3+ অর্ডার', value: '3+' },
    { label: '5+ অর্ডার', value: '5+' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">মোট কাস্টমার</p>
              <p className="text-xl font-bold">{stats?.total || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Star className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">রিপিট কাস্টমার</p>
              <p className="text-xl font-bold">{stats?.repeat || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">মোট রেভিনিউ</p>
              <p className="text-xl font-bold">৳{(stats?.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="নাম বা ফোন দিয়ে সার্চ..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {orderFilters.map(f => (
            <Button key={f.value} size="sm" variant={orderFilter === f.value ? 'default' : 'outline'}
              onClick={() => { setOrderFilter(f.value); setPage(0); }}>
              {f.value !== 'all' && <Star className="h-3 w-3 mr-1" />}
              {f.label}
            </Button>
          ))}
          <div className="flex gap-2 ml-auto">
            <div>
              <label className="text-[10px] text-muted-foreground">From</label>
              <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} className="w-[130px] h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">To</label>
              <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} className="w-[130px] h-8 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Selection & Downloads */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} জন সিলেক্টেড` : 'সব সিলেক্ট'}
          </span>
        </div>
        <div className="flex gap-2 ml-auto">
          <Link to="/admin/customers/import">
            <Button size="sm" variant="outline">
              <Upload className="h-3.5 w-3.5 mr-1" /> ইম্পোর্ট কাস্টমার
            </Button>
          </Link>
          <Button onClick={downloadPhoneCSV} size="sm" variant="outline">
            <Phone className="h-3.5 w-3.5 mr-1" /> নম্বর CSV ({selectedIds.size || totalCount})
          </Button>
          <Button onClick={downloadFacebookCSV} size="sm" variant="outline">
            <Download className="h-3.5 w-3.5 mr-1" /> Facebook CSV
          </Button>
          <Button onClick={downloadGoogleCSV} size="sm" variant="outline">
            <FileText className="h-3.5 w-3.5 mr-1" /> Google CSV
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">কাস্টমার ({totalCount})</h2>
        {totalPages > 1 && (
          <span className="text-xs text-muted-foreground">পেজ {page + 1} / {totalPages}</span>
        )}
      </div>

      {/* Customer List */}
      {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : (
        <div className="space-y-2">
          {customers.map((c: any) => (
            <Card key={c.id} className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedIds.has(c.id) ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setProfileCustomer(c)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} onClick={e => e.stopPropagation()} />
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{c.name || 'Unknown'}</p>
                      {(c.delivered_orders || 0) >= 3 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Star className="h-2.5 w-2.5 mr-0.5" />স্টার</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>
                    {c.address && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /> {c.address}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">৳{(c.total_spent || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><ShoppingCart className="h-3 w-3" /> {c.total_orders} অর্ডার</p>
                    {c.last_order_date && <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.last_order_date), { addSuffix: true })}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {customers.length === 0 && <p className="text-muted-foreground text-center py-8">কোনো কাস্টমার নেই</p>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i).map(i => (
            <Button key={i} size="sm" variant={i === page ? 'default' : 'outline'}
              onClick={() => setPage(i)} className="w-8 h-8 p-0">
              {i + 1}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CustomerProfileDialog
        customer={profileCustomer}
        open={!!profileCustomer}
        onOpenChange={(open) => !open && setProfileCustomer(null)}
      />
    </div>
  );
}
