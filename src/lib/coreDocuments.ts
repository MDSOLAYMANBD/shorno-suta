import type { CoreDocument } from '@/lib/coreConnect';

// The ID documents an order for a number needs (e.g. IP Number & SMS Service): the NID card,
// both sides, and an organization's trade licence too.

export type AccountType = 'individual' | 'organization';
export type DocKind = CoreDocument['kind'];
export interface PickedDoc extends CoreDocument {
  /** A preview of the photo (none for a PDF). */
  preview: string | null;
  size: number;
}

export const DOC_SLOTS: { kind: DocKind; label: string; organizationOnly?: boolean }[] = [
  { kind: 'nid_front', label: 'এনআইডি কার্ড · সামনের দিক' },
  { kind: 'nid_back', label: 'এনআইডি কার্ড · পেছনের দিক' },
  { kind: 'trade_license', label: 'ট্রেড লাইসেন্স', organizationOnly: true },
];

/** The kinds an account type has to send. */
export const neededKinds = (account: AccountType | '') =>
  DOC_SLOTS.filter((s) => account && (!s.organizationOnly || account === 'organization')).map((s) => s.kind);
