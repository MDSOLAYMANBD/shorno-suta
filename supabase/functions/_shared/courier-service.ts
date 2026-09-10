// Courier abstraction so multiple couriers (Steadfast, Pathao, RedX, Paperfly)
// can share the auto-recreation workflow. Each provider implements this
// interface; the recreate_parcel action delegates via getCourierService().

export interface CreateParcelResult {
  consignment_id: string;
  tracking_code: string | null;
  status: string;
  cod_amount: number;
  raw: any;
}

export interface DeleteAttempt {
  deleted: boolean;
  detail: string;
  result?: any;
}

export interface CourierService {
  name: string;
  // Status values where automatic recreation is safe (parcel not yet in network)
  canRecreate(status: string | null | undefined): boolean;
  createParcel(order: any): Promise<CreateParcelResult>;
  // Optional best-effort delete; failures must never block recreation
  tryDeleteParcel(consignmentId: string, status: string | null | undefined): Promise<DeleteAttempt>;
}

// Statuses that allow safe recreation (not yet dispatched)
export const RECREATABLE_STATUSES = new Set([
  'in_review', 'draft', 'awaiting_dispatch', 'pending',
]);

// Statuses that block recreation (parcel in courier network)
export const BLOCKED_STATUSES = new Set([
  'picked', 'shipped', 'hold', 'delivered',
  'partial_delivered', 'cancelled', 'returned',
  'delivered_approval_pending', 'partial_delivered_approval_pending',
  'cancelled_approval_pending', 'unknown_approval_pending',
]);
