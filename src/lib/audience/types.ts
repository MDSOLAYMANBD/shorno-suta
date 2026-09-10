// CRM Audience Engine — shared types. Used by every marketing channel.

export type PresetId =
  | 'all'
  | 'vip'
  | 'repeat'
  | 'new'
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_30d'
  | 'last_90d'
  | 'no_order_30d'
  | 'no_order_90d'
  | 'orders_1'
  | 'orders_2_plus'
  | 'orders_3_plus'
  | 'orders_5_plus'
  | 'orders_10_plus'
  | 'high_spend'
  | 'low_spend'
  | 'cod'
  | 'prepaid'
  | 'inside_dhaka'
  | 'outside_dhaka'
  | 'at_risk'
  | 'blacklist'
  | 'refunded'
  | 'wholesale'
  | 'retail';

export type ParcelStatus =
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'handed_to_courier'
  | 'in_transit'
  | 'delivery_attempt'
  | 'delivered'
  | 'completed'
  | 'returned'
  | 'exchange'
  | 'cancelled'
  | 'failed_delivery';

export type RuleField =
  | 'orders_count'
  | 'total_spent'
  | 'district'
  | 'upazila'
  | 'courier'
  | 'payment_method'
  | 'last_order_date'
  | 'customer_status'
  | 'delivery_status'
  | 'order_status';

export type RuleOp =
  | 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in' | 'nin' | 'before' | 'after';

export interface RuleLeaf {
  type: 'rule';
  field: RuleField;
  op: RuleOp;
  value: string | number | string[] | number[];
}

export interface RuleGroup {
  type: 'group';
  logic: 'and' | 'or';
  children: RuleNode[];
}

export type RuleNode = RuleLeaf | RuleGroup;

export type IncludeMode = 'AND' | 'OR';

export interface AudienceFilter {
  include: PresetId[];
  exclude: PresetId[];
  districts: string[];
  parcelStatuses: ParcelStatus[];
  rules?: RuleGroup;
  manualExclude: string[];
  manualInclude?: string[];      // explicit phone allow-list (used by SMS follow-up)
  savedAudienceId?: string;
  includeMode?: IncludeMode;     // default AND
}

export const EMPTY_FILTER: AudienceFilter = {
  include: [],
  exclude: [],
  districts: [],
  parcelStatuses: [],
  manualExclude: [],
  manualInclude: [],
  includeMode: 'AND',
};

export interface AudienceCustomer {
  phone: string;
  name: string;
  address: string;
  district: string | null;
  upazila: string | null;
  area: string | null;
  total_orders: number;
  delivered_orders: number;
  total_spent: number;
  last_order_date: string | null;
  customer_type: string | null;
  tags: string[];
  matchedBy?: PresetId[];        // which include presets this customer satisfies
}

export interface DuplicateGroup {
  phone: string;
  matchedAudiences: PresetId[];
  customerNames: string[];       // first names seen for that phone (may be 1)
  count: number;
}

export type AudienceSource = 'database' | 'manual' | 'mixed' | 'none';

export interface AudienceSummary {
  matchedCustomers: number;      // # customer rows after filters (pre-dedupe)
  uniqueCustomers: number;       // == matchedCustomers when no clones
  uniquePhones: number;          // distinct phones (db ∪ manual, post-dedupe)
  duplicatePhones: number;       // matchedCustomers - uniquePhones (intra-DB clones)
  excluded: number;              // manual-exclude + exclude-preset rejections
  invalid: number;               // DB-side invalid phones
  finalCount: number;
  smsParts: number;
  estimatedCost: number;
  averageOrders: number;
  averageSpend: number;
  codPercent: number;
  prepaidPercent: number;
  deliveredPercent: number;

  // ── Manual Numbers breakdown ──────────────────────────────────────────
  databaseCount: number;         // unique phones contributed by Audience Engine (DB)
  manualCount: number;           // unique normalized phones from manual paste-box
  manualInvalid: number;         // entries in paste-box that failed validation
  manualOverlap: number;         // phones present in BOTH database & manual lists
  duplicatesRemoved: number;     // overlap + intra-DB clones (total dedupe)
  source: AudienceSource;

  // Legacy alias
  recipients: number;
}

export interface SavedAudience {
  id: string;
  name: string;
  description: string | null;
  filters: AudienceFilter;
  channel_hint: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
