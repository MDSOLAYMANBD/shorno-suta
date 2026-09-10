// Configuration-driven column registry for the CRM customer table.
// Adding a column = add one entry. Visibility prefs persist per user.

import type { AudienceCustomer } from '@/lib/audience/types';

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render: (c: AudienceCustomer) => string;
}

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const money = (n: number) => '৳' + Math.round(n).toLocaleString();

export const CUSTOMER_COLUMNS: ColumnDef[] = [
  { id: 'name',            label: 'Name',            defaultVisible: true,  width: '180px', render: (c) => c.name || '—' },
  { id: 'phone',           label: 'Phone',           defaultVisible: true,  width: '140px', render: (c) => c.phone },
  { id: 'matched_by',      label: 'Matched By',      defaultVisible: true,  width: '180px', render: (c) => (c.matchedBy || []).join(', ') || '—' },
  { id: 'division',        label: 'Division',        defaultVisible: false, width: '110px', render: () => '—' },
  { id: 'district',        label: 'District',        defaultVisible: true,  width: '120px', render: (c) => c.district || '—' },
  { id: 'upazila',         label: 'Upazila',         defaultVisible: false, width: '120px', render: (c) => c.upazila || '—' },
  { id: 'area',            label: 'Area',            defaultVisible: false, width: '120px', render: (c) => c.area || '—' },
  { id: 'total_orders',    label: 'Orders',          defaultVisible: true,  align: 'right', width: '80px',  render: (c) => String(c.total_orders) },
  { id: 'total_spent',     label: 'Spend',           defaultVisible: true,  align: 'right', width: '100px', render: (c) => money(c.total_spent) },
  { id: 'last_order_date', label: 'Last Order',      defaultVisible: true,  width: '110px', render: (c) => fmt(c.last_order_date) },
  { id: 'delivery_status', label: 'Last Delivery',   defaultVisible: false, width: '110px', render: (c) => c.delivered_orders > 0 ? 'Delivered' : '—' },
  { id: 'payment_method',  label: 'Payment',         defaultVisible: false, width: '90px',  render: () => '—' },
  { id: 'tags',            label: 'Tags',            defaultVisible: false, width: '120px', render: (c) => c.tags.join(', ') || '—' },
  { id: 'customer_type',   label: 'Type',            defaultVisible: true,  width: '90px',  render: (c) => c.customer_type || '—' },
  { id: 'created_at',      label: 'Created',         defaultVisible: false, width: '110px', render: () => '—' },
];

export const DEFAULT_VISIBLE = CUSTOMER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
