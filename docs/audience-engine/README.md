# CRM Audience Engine — Developer Guide

A channel-agnostic engine that resolves filters → customer rows → recipients.
SMS is the first consumer; WhatsApp, Email, Push, and Meta Custom Audience
can plug in without duplicating filter logic.

## Folder Structure

```
src/lib/audience/
  types.ts          Shared types: AudienceFilter, AudienceCustomer, SavedAudience, …
  engine.ts         resolveAudiencePhones(filter, message) → { phones, summary }
  presets.ts        25+ semantic preset cards (VIP, Repeat, At-Risk, …)
  districts.ts      64 BD districts + detection from address strings
  helpers.ts        Phone normalisation, dedupe, GSM/Unicode SMS-part calc
  locations.ts      District → upazila tree
  parcelStatuses.ts Delivery status enum + labels
  export.ts         CSV / Excel / Facebook / Google exporters
  templates.ts      {{first_name}}, {{district}}, {{shop}} variable resolver
  analytics.ts      computeAudienceStats(customers) → VIP / district / cost breakdown
  audit.ts          logAudit(action, entity, id, metadata)
  errors.ts         friendlyError() Bengali map + withRetry() helper
  cache.ts          react-query keys shared across channels
  columns.ts        Preview-table column metadata

src/components/admin/audience/
  SmsAudienceEngineTab.tsx    Composer + preview + send (forwardRef handle)
  AudienceConfirmDialog.tsx   Channel-agnostic confirm w/ Dry-Run toggle
  AudienceAnalyticsPanel.tsx  Reusable stats card
  AudiencePresetGrid.tsx      Preset chip grid
  LocationPicker.tsx          District selector
  DeliveryStatusPicker.tsx    Parcel status selector
  IncludeExcludePanel.tsx     Symmetric include/exclude pills
  ManualExcludeBox.tsx        Free-form phone exclusion textarea
  CustomerPreviewTable.tsx    Server-paginated row preview
  CustomerDrawer.tsx          Single-customer profile drawer
  ExportMenu.tsx              Dropdown of export formats
  RuleBuilder.tsx             Advanced JSON rule tree builder
  TagManagerDialog.tsx        CRM tag editor
  SavedAudiencesTab.tsx       Manage saved audiences
  SmsCampaignHistoryTab.tsx   Campaign history + reuse
  SendProgressDialog.tsx      Non-blocking progress modal
  AuditLogTab.tsx             Audit log viewer
```

## Public API

```ts
import { resolveAudiencePhones } from '@/lib/audience/engine';
import { fetchAudienceForExport } from '@/lib/audience/export';
import { resolveTemplate, SAMPLE_CUSTOMER, VARIABLES } from '@/lib/audience/templates';
import { computeAudienceStats } from '@/lib/audience/analytics';
import { logAudit } from '@/lib/audience/audit';
import { friendlyError, withRetry } from '@/lib/audience/errors';
import { useSavedAudiences } from '@/hooks/useSavedAudiences';
import type { AudienceFilter, AudienceCustomer, AudienceSummary } from '@/lib/audience/types';
```

`resolveAudiencePhones(filter, message)` returns `{ phones: string[], summary: AudienceSummary }`.
`fetchAudienceForExport(filter)` returns `AudienceCustomer[]` (server-paginated under the hood).

## Data Flow

```
        UI filter chips                Saved audience load
              │                                │
              ▼                                ▼
        AudienceFilter ─────────────────► engine.resolveAudiencePhones
              │                                │
              │                                ├──► presets.ts (semantic SQL)
              │                                ├──► districts.ts (geo)
              │                                ├──► parcelStatuses.ts
              │                                └──► helpers.ts (normalise/dedupe)
              ▼                                ▼
        analytics.ts ◄── AudienceCustomer[] ◄── export.fetchAudienceForExport
              │
              ▼
        AudienceAnalyticsPanel + AudienceSummary
              │
              ▼
        AudienceConfirmDialog ──► sender (channel-specific)
                                     │
                                     ├──► supabase.functions.invoke('send-sms')   (SMS)
                                     ├──► supabase.functions.invoke('send-wa')    (future)
                                     └──► …
                                     │
                                     ▼
                              sms_campaigns + sms_campaign_recipients
                                     │
                                     ▼
                              crm_audit_logs (logAudit)
```

## Filter / Rule Format

```ts
interface AudienceFilter {
  include: PresetId[];            // semantic cards (vip, repeat, …)
  exclude: PresetId[];
  districts: string[];            // canonical English names
  parcelStatuses: ParcelStatus[];
  rules?: RuleGroup;              // optional advanced AND/OR tree
  manualExclude: string[];        // normalised 8801XXXXXXXXX
  savedAudienceId?: string;
}

interface RuleGroup { type: 'group'; logic: 'and' | 'or'; children: RuleNode[] }
interface RuleLeaf  { type: 'rule'; field: RuleField; op: RuleOp; value: any }
```

Supported `RuleField`: `orders_count`, `total_spent`, `district`, `upazila`,
`courier`, `payment_method`, `last_order_date`, `customer_status`,
`delivery_status`, `order_status`.

Ops: `eq | neq | gte | lte | gt | lt | in | nin | before | after`.

## Extension Guide

Adding a new channel is purely a sender — the engine produces the recipient
list, you handle delivery.

### 1. WhatsApp

```ts
import { resolveAudiencePhones } from '@/lib/audience/engine';
import { fetchAudienceForExport } from '@/lib/audience/export';
import { resolveTemplate } from '@/lib/audience/templates';

const { phones } = await resolveAudiencePhones(filter, body);
const customers = await fetchAudienceForExport(filter);
const byPhone = new Map(customers.map((c) => [c.phone, c]));
for (const phone of phones) {
  const msg = resolveTemplate(body, byPhone.get(phone)!, { shop });
  await supabase.functions.invoke('send-whatsapp', { body: { phone, message: msg } });
}
```

### 2. Email

```ts
const customers = await fetchAudienceForExport(filter);
const withEmail = customers.filter((c) => (c as any).email);
for (const c of withEmail) {
  await supabase.functions.invoke('send-email', {
    body: { to: (c as any).email, subject, html: resolveTemplate(htmlBody, c, { shop }) },
  });
}
```

### 3. Push Notification

```ts
const { phones } = await resolveAudiencePhones(filter, body);
const { data: subs } = await supabase.from('push_subscriptions')
  .select('subscription, customer_phone').in('customer_phone', phones);
for (const s of subs ?? []) {
  await supabase.functions.invoke('send-push-notification', { body: { subscription: s.subscription, title, body } });
}
```

### 4. Meta Custom Audience

Use the existing exporter — produces a hashed, Facebook-ready CSV:

```ts
import { exportAudience } from '@/lib/audience/export';
await exportAudience('facebook', filter, 'campaign-eid-2026');
```

## Conventions

* Phone numbers everywhere internal: normalised `8801XXXXXXXXX`. Convert to
  `01XXXXXXXXX` only at the last mile (provider call).
* SMS pricing: derived in `helpers.smsParts` using GSM-7 (160/153) vs
  Unicode (70/67) rules.
* Audit every destructive or send action via `logAudit`.
* Always wrap user-facing send loops with `withRetry` and surface errors
  through `friendlyError`.

## Testing

See `TESTING.md` for the manual verification checklist.
