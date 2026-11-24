// Shadamon Shop as this shop's supplier: dropshipping (admin → ড্রপশিপিং). The same as the
// CORE Shop engine's supplier function, for one shop. Talks to Shadamon's partner API with
// this shop's own partner key, which CORE set up at Shadamon and keeps in
// public.supplier_links (service role only, never in the browser).
//
//   ?action=catalog        Shadamon's products, with the ones the shop already added (staff)
//   ?action=account        the shop's Shadamon wallet, deliveries and review state (staff)
//   ?action=withdraw       {amount, method, account_number, …}: the wallet's money to the
//                          shop's bKash / Nagad / bank; Shadamon pays it (admin)
//   ?action=import         {product_ids}: adds them to the shop, Shadamon's name in their
//                          text changed to the shop's (staff)
//   ?action=create_order, bulk_create, check_status, track_parcel, cancel_order,
//          cancel_parcel, bulk_status
//                          "Shadamon" in the order's courier menu: Shadamon packs and ships
//                          the order and the profit goes to the shop's Shadamon wallet
//   ?action=sync           courier-status-poll's cron (x-internal-secret): Shadamon's product
//                          changes into the shop, and the progress of its orders there
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SHADAMON_ACTIVE_STATUSES, fitToCollect, shadamonArea, shadamonStatus, swapBrand,
} from "../_shared/shadamon.ts";

/** This shop's name, for Shadamon's name in the products' text. */
const BRAND = { bn: 'স্বর্ণ সুতা', en: 'Shorno Suta' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SHARED_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || Deno.env.get('COURIER_WEBHOOK_SECRET') || '';

const NOT_READY = 'Shadamon সংযোগ এখনো চালু হয়নি। CORE Automation সাপোর্টে যোগাযোগ করুন।';
const MAX_IMPORT = 50;

// deno-lint-ignore no-explicit-any
type Row = any;
// deno-lint-ignore no-explicit-any
type Db = any;
interface Link { url: string; key: string; syncedAt: string }

class HttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const service = (): Db => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------- who is asking
const STAFF_ROLES: Record<string, string[]> = {
  products: ['admin', 'product_manager'],
  orders: ['admin', 'order_manager'],
  money: ['admin'],
};

/** The service client, for a signed-in staff member with one of the roles (or our own cron). */
async function staff(req: Request, kind: 'products' | 'orders' | 'money'): Promise<Db> {
  const db = service();
  const internal = req.headers.get('x-internal-secret') || '';
  if (INTERNAL_SHARED_SECRET && internal === INTERNAL_SHARED_SECRET) return db;
  const auth = req.headers.get('Authorization') || '';
  if (!auth) throw new HttpError('Unauthorized', 401);
  const { data: { user } } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!user) throw new HttpError('Unauthorized', 401);
  for (const role of STAFF_ROLES[kind]) {
    const { data } = await db.rpc('has_role', { _user_id: user.id, _role: role });
    if (data === true) return db;
  }
  throw new HttpError('Access denied', 403);
}

// ---------------------------------------------------------------- Shadamon's API
async function shadamonFetch(link: Link, path: string, init: { method?: string; body?: unknown } = {}): Promise<Row> {
  let res: Response;
  try {
    res = await fetch(`${link.url}${path}`, {
      method: init.method || 'GET',
      headers: { 'X-Api-Key': link.key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (e) {
    console.error('[supplier] Shadamon unreachable:', e);
    throw new HttpError('Shadamon-এর সার্ভারে এখন পৌঁছানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।', 502);
  }
  const data = await res.json().catch(() => null);
  if (res.ok && data) return data;
  const message = data?.error?.message;
  // a key Shadamon no longer knows: CORE sets up a new one
  if (res.status === 401) throw new HttpError(NOT_READY, 503);
  if (res.status === 403) throw new HttpError(message || 'Shadamon আপনার দোকানের সংযোগ বন্ধ রেখেছে। CORE Automation সাপোর্টে যোগাযোগ করুন।', 403);
  if (res.status >= 500 || !data) throw new HttpError('Shadamon-এর সার্ভারে সাময়িক সমস্যা। একটু পরে আবার চেষ্টা করুন।', 502);
  throw new HttpError(message || `Shadamon: ${res.status}`, [404, 409, 429].includes(res.status) ? res.status : 400);
}

/** The shop's Shadamon link (null until CORE has set it up). */
async function findLink(db: Db): Promise<Link | null> {
  const { data } = await db.from('supplier_links').select('api_url, api_key, synced_at').eq('supplier', 'shadamon').maybeSingle();
  const url = String(data?.api_url || '').replace(/\/$/, '');
  if (!url || !data?.api_key) return null;
  return { url, key: String(data.api_key), syncedAt: String(data.synced_at || '') };
}

async function shopLink(db: Db): Promise<Link> {
  const link = await findLink(db);
  if (!link) throw new HttpError(NOT_READY, 503);
  return link;
}

// ---------------------------------------------------------------- catalog
async function catalog(db: Db) {
  const link = await shopLink(db);
  const products: Row[] = [];
  let offset: number | null = 0;
  for (let page = 0; page < 25 && offset !== null; page++) {
    const data = await shadamonFetch(link, `/products?limit=200&offset=${offset}`);
    products.push(...(data.products || []));
    offset = typeof data.next_offset === 'number' ? data.next_offset : null;
  }
  const { data: mine } = await db.from('products')
    .select('id, supplier_product_id, is_active, price, original_price, video_url, variant_images')
    .eq('supplier', 'shadamon').is('deleted_at', null);
  const added = new Map<string, Row>((mine || []).map((p: Row) => [p.supplier_product_id, p]));
  // copies made before Shadamon sent these: its linked products and the video on top
  let relinked = false;
  for (const p of products) {
    const own = added.get(p.id);
    if (!own) continue;
    const vi = own.variant_images && typeof own.variant_images === 'object' ? own.variant_images : {};
    const links = Array.isArray(p.linked_product_ids) ? p.linked_product_ids.slice(0, 20) : null;
    const next = { ...vi };
    if (links && JSON.stringify(vi.supplier_links || []) !== JSON.stringify(links)) { next.supplier_links = links; relinked = true; }
    if (own.video_url && p.video_url && p.video_on_image === true && vi.show_video_overlay !== true) next.show_video_overlay = true;
    if (JSON.stringify(next) !== JSON.stringify(vi)) await db.from('products').update({ variant_images: next }).eq('id', own.id);
  }
  if (relinked) await linkSupplierProducts(db);
  return {
    products: products.map((p) => {
      const own = added.get(p.id);
      const sellsFor = own ? (Number(own.original_price) > 0 && Number(own.original_price) < Number(own.price) ? Number(own.original_price) : Number(own.price)) : null;
      return { ...p, added: own ? { id: own.id, is_active: own.is_active, price: sellsFor } : null };
    }),
  };
}

/** What the shop's open orders of Shadamon products will earn once delivered. */
async function pendingProfit(db: Db) {
  const { data: products } = await db.from('products').select('id, supplier_price').eq('supplier', 'shadamon');
  const cost = new Map<string, number>((products || []).map((p: Row) => [p.id, Number(p.supplier_price) || 0]));
  if (!cost.size) return { amount: 0, orders: 0 };
  const { data: orders } = await db.from('orders').select('id')
    .in('status', ['pending', 'confirmed', 'scheduled', 'hold', 'in_review', 'shipped']).is('deleted_at', null).limit(1000);
  const ids = (orders || []).map((o: Row) => o.id);
  if (!ids.length) return { amount: 0, orders: 0 };
  const { data: items } = await db.from('order_items').select('order_id, product_id, quantity, price').in('order_id', ids).in('product_id', [...cost.keys()]);
  let amount = 0;
  const counted = new Set<string>();
  for (const i of items || []) {
    amount += Math.max((Number(i.price) || 0) - (cost.get(i.product_id) || 0), 0) * Math.max(Number(i.quantity) || 1, 1);
    counted.add(i.order_id);
  }
  return { amount: Math.round(amount), orders: counted.size };
}

async function account(db: Db) {
  const link = await shopLink(db);
  const pending = await pendingProfit(db).catch(() => ({ amount: 0, orders: 0 }));
  const [me, wallet] = await Promise.all([shadamonFetch(link, '/me'), shadamonFetch(link, '/wallet')]);
  return {
    pending_profit: pending.amount,
    pending_orders: pending.orders,
    wallet_balance: Number(me.wallet_balance) || 0,
    delivered_orders: Number(me.delivered_orders) || 0,
    orders_need_review: Boolean(me.orders_need_review),
    delivery_charges: me.delivery_charges || {},
    entries: (wallet.entries || []).slice(0, 30),
    withdrawals: (wallet.withdrawals || []).slice(0, 10),
  };
}

async function withdraw(db: Db, body: Row) {
  const amount = Math.floor(Number(body.amount));
  if (!(amount > 0)) throw new HttpError('কত টাকা তুলবেন লিখুন।');
  return await shadamonFetch(await shopLink(db), '/wallet/withdraw', {
    method: 'POST',
    body: {
      amount,
      method: String(body.method || ''),
      account_number: String(body.account_number || ''),
      account_name: body.account_name ? String(body.account_name) : undefined,
      bank_name: body.bank_name ? String(body.bank_name) : undefined,
      branch_name: body.branch_name ? String(body.branch_name) : undefined,
    },
  });
}

// ---------------------------------------------------------------- adding products
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function freeSlug(db: Db, wanted: string, table: 'products' | 'categories'): Promise<string> {
  const base = slugify(wanted) || `item-${crypto.randomUUID().slice(0, 8)}`;
  const { data } = await db.from(table).select('slug').like('slug', `${base}%`).limit(500);
  const taken = new Set((data || []).map((r: Row) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function categoryFor(db: Db, category: Row, cache: Row[]): Promise<string | null> {
  if (!category?.name && !category?.name_bn) return null;
  const norm = (v: unknown) => String(v || '').trim().toLowerCase();
  const same = (a: unknown, b: unknown) => norm(a) !== '' && norm(a) === norm(b);
  const matches = (c: Row) => same(c.name, category.name) || same(c.name_bn, category.name_bn);
  const found = cache.find(matches);
  if (found) return found.id;
  // another import (a tap on the next product) may have just made it: look again
  const fresh = async () => {
    const { data } = await db.from('categories').select('id, name, name_bn, created_at').order('created_at').order('id');
    return (data || []).filter(matches);
  };
  const before = await fresh();
  if (before.length) { cache.push(before[0]); return before[0].id; }
  const name = String(category.name || category.name_bn).slice(0, 100);
  const { data, error } = await db.from('categories')
    .insert({ name, name_bn: String(category.name_bn || ''), slug: await freeSlug(db, category.name || 'category', 'categories') })
    .select('id, name, name_bn').single();
  if (error || !data) return null;
  // two imports at the same moment both made one: keep the oldest, drop ours
  const after = await fresh();
  const keep = after[0] || data;
  if (keep.id !== data.id) await db.from('categories').delete().eq('id', data.id);
  cache.push(keep);
  return keep.id;
}

/** A Shadamon product's photos per colour, only for its colours and only web addresses. */
function colorPhotos(p: Row): Record<string, string[]> {
  const colors: string[] = Array.isArray(p.colors) ? p.colors.map(String) : [];
  const raw = p.color_images && typeof p.color_images === 'object' ? p.color_images : {};
  const out: Record<string, string[]> = {};
  for (const color of colors) {
    const v = raw[color];
    const urls = (Array.isArray(v) ? v : v ? [v] : []).map(String).filter((u: string) => /^https:\/\//.test(u)).slice(0, 10);
    if (urls.length) out[color] = urls;
  }
  return out;
}

async function importProducts(db: Db, ids: string[]) {
  const wanted = [...new Set(ids.map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, MAX_IMPORT);
  if (wanted.length === 0) throw new HttpError('কোন পণ্য যোগ করবেন বেছে নিন।');
  const link = await shopLink(db);
  const { data: existing } = await db.from('products')
    .select('id, supplier_product_id, deleted_at').eq('supplier', 'shadamon').in('supplier_product_id', wanted);
  const { data: cats } = await db.from('categories').select('id, name, name_bn');
  const categories = [...(cats || [])];
  const results: Row[] = [];

  for (const id of wanted) {
    const had = (existing || []).find((p: Row) => p.supplier_product_id === id);
    if (had && !had.deleted_at) {
      results.push({ id, product_id: had.id, existed: true, success: true });
      continue;
    }
    try {
      const { product: p } = await shadamonFetch(link, `/products/${id}`);
      if (!p?.on_sale) throw new HttpError('Shadamon এই পণ্যটি এখন বিক্রি করছে না।');
      // one the shop deleted earlier steps aside for the new copy
      if (had) await db.from('products').update({ supplier: null, supplier_product_id: null, supplier_price: null }).eq('id', had.id);

      const swap = (t: unknown) => swapBrand(String(t || ''), BRAND.bn, BRAND.en);
      const name = swap(p.name || p.name_bn);
      const slugFromUrl = String(p.url || '').split('/product/')[1] || '';
      const sizePrices: Record<string, number> = p.size_prices || {};
      const sizeData = Object.fromEntries(
        Object.entries(sizePrices).filter(([, v]) => Number(v) > 0 && Number(v) !== Number(p.price)).map(([size, v]) => [size, { sale_price: Number(v) }]),
      );
      // each colour's own photos (Shadamon's partner API sends them as color_images)
      const colorImages = colorPhotos(p);
      const { data: row, error } = await db.from('products').insert({
        // one name in the shop's admin (name_bn follows it: sync_product_name_bn)
        name: name.slice(0, 300),
        description: swap(p.description),
        description_bn: swap(p.description_bn),
        slug: await freeSlug(db, slugFromUrl || p.name || 'product', 'products'),
        images: Array.isArray(p.images) ? p.images.slice(0, 20) : [],
        video_url: p.video_url || null,
        sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : null,
        colors: Array.isArray(p.colors) && p.colors.length ? p.colors : null,
        price: Number(p.compare_at_price) > 0 ? Number(p.compare_at_price) : Number(p.price),
        original_price: Number(p.compare_at_price) > 0 ? Number(p.price) : null,
        variant_images: {
          ...(Object.keys(sizeData).length ? { size_data: sizeData } : {}),
          ...(Object.keys(colorImages).length ? { color_images: colorImages } : {}),
          // the video over the photos at the top, as on Shadamon (older answers lack the flag)
          ...(p.video_url && p.video_on_image !== false ? { show_video_overlay: true } : {}),
          // Shadamon's "linked products": joined to this shop's own copies (linkSupplierProducts)
          ...(Array.isArray(p.linked_product_ids) && p.linked_product_ids.length ? { supplier_links: p.linked_product_ids.slice(0, 20) } : {}),
        },
        stock: Math.max(Number(p.stock) || 0, 0),
        allow_pre_order: Boolean(p.allow_pre_order),
        is_active: true,
        category_id: await categoryFor(db, p.category, categories),
        cost_price: Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) : null,
        supplier: 'shadamon',
        supplier_product_id: p.id,
        supplier_price: Number(p.price),
      }).select('id').single();
      if (error || !row) {
        console.error('[supplier] import insert failed:', error);
        throw new HttpError('পণ্যটি যোগ করা যায়নি।');
      }
      results.push({ id, product_id: row.id, success: true });
    } catch (e) {
      results.push({ id, success: false, error: e instanceof Error ? e.message : 'failed' });
    }
  }
  if (results.some((r) => r.success && !r.existed)) await linkSupplierProducts(db);
  return { results, added: results.filter((r) => r.success && !r.existed).length };
}

/**
 * Shadamon's linked products (one shown with another on its page), between this shop's
 * copies: each copy keeps Shadamon's links in variant_images.supplier_links, and its
 * linked_product_ids get the copies the shop has; links the owner added stay. A shop
 * without linked products (no such column) skips it.
 */
async function linkSupplierProducts(db: Db) {
  const { data, error } = await db.from('products').select('id, supplier_product_id, linked_product_ids, variant_images')
    .eq('supplier', 'shadamon').is('deleted_at', null).limit(2000);
  if (error) return;
  const rows: Row[] = data || [];
  const copyOf = new Map<string, string>(rows.map((r) => [r.supplier_product_id, r.id]));
  const copies = new Set<string>(copyOf.values());
  for (const r of rows) {
    const links: string[] = Array.isArray(r.variant_images?.supplier_links) ? r.variant_images.supplier_links : [];
    const fromShadamon = links.map((id) => copyOf.get(id)).filter((id): id is string => !!id && id !== r.id);
    const own = (Array.isArray(r.linked_product_ids) ? r.linked_product_ids : []).filter((id: string) => !copies.has(id));
    const next = [...new Set([...own, ...fromShadamon])];
    const now = Array.isArray(r.linked_product_ids) ? r.linked_product_ids : [];
    if (next.length !== now.length || next.some((id) => !now.includes(id))) {
      await db.from('products').update({ linked_product_ids: next }).eq('id', r.id);
    }
  }
}

// ---------------------------------------------------------------- orders
/** What the courier collects (as steadfast-courier): the due, nothing for a gift or a paid order. */
function collectable(order: Row): number {
  if (order.is_gift_order) return 0;
  const due = Number(order.due_amount);
  const paid = Number(order.paid_amount);
  return Math.round(due > 0 ? due : (due === 0 && paid > 0 ? 0 : Number(order.total) || 0));
}

/** The name of the order's delivery area at checkout (admin → চেকআউট → ডেলিভারি এলাকা). */
async function areaLabel(db: Db, id: unknown): Promise<string> {
  const { data } = await db.from('store_settings').select('value').eq('key', 'checkout_config').maybeSingle();
  try {
    const zones = JSON.parse(String(data?.value || '{}'))?.shipping_zones;
    const zone = Array.isArray(zones) ? zones.find((z: Row) => z && String(z.id) === String(id)) : null;
    return zone?.label ? String(zone.label) : '';
  } catch {
    return '';
  }
}

async function sendOrder(db: Db, orderId: string) {
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) throw new HttpError(`Order not found: ${orderId}`, 404);
  if (order.courier_consignment_id) throw new HttpError(`এই অর্ডার আগেই কুরিয়ারে পাঠানো হয়েছে (${order.courier_consignment_id})।`, 409);
  if (order.is_gift_order) throw new HttpError('উপহারের অর্ডার Shadamon-এ পাঠানো যায় না।');

  const { data: items } = await db.from('order_items').select('product_id, product_name, quantity, price, size, color').eq('order_id', orderId);
  if (!items?.length) throw new HttpError('অর্ডারে কোনো পণ্য নেই।');
  const { data: products } = await db.from('products')
    .select('id, supplier, supplier_product_id, supplier_price').in('id', items.map((i: Row) => i.product_id).filter(Boolean));
  const byId = new Map<string, Row>((products || []).map((p: Row) => [p.id, p]));
  for (const item of items) {
    const p = byId.get(item.product_id);
    if (p?.supplier !== 'shadamon') {
      throw new HttpError(`"${item.product_name}" আপনার নিজের পণ্য — Shadamon শুধু তার পণ্যগুলো পাঠায়। এই অর্ডার অন্য কুরিয়ারে পাঠান।`);
    }
  }

  const link = await shopLink(db);
  const me = await shadamonFetch(link, '/me');
  const area = shadamonArea(order.delivery_area, await areaLabel(db, order.delivery_area));
  const delivery = Number(me.delivery_charges?.[area] ?? 0);
  const collect = collectable(order);
  const lines = items.map((i: Row) => ({
    unitPrice: Number(i.price) || 0,
    quantity: Math.max(Number(i.quantity) || 1, 1),
    minPrice: Number(byId.get(i.product_id).supplier_price) || 0,
  }));
  const fit = fitToCollect(lines, delivery, collect);
  if (!fit.ok) {
    throw new HttpError(`Shadamon-এ পাঠাতে কাস্টমারের কাছ থেকে কমপক্ষে ৳${fit.least} নিতে হবে (Shadamon-এর দাম আর ডেলিভারি চার্জ ৳${delivery}); এই অর্ডারে নেওয়া হবে ৳${collect}।`);
  }

  const note = [String(order.courier_note || '').trim(), order.customer_alt_phone ? `Alt: ${order.customer_alt_phone}` : '']
    .filter(Boolean).join(' | ');
  const answer = await shadamonFetch(link, '/orders', {
    method: 'POST',
    body: {
      partner_order_ref: String(order.order_number).slice(0, 80),
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: [order.customer_address, order.city].filter(Boolean).join(', ').slice(0, 500),
      delivery_area: area,
      notes: note.slice(0, 400) || undefined,
      items: items.map((i: Row, n: number) => ({
        product_id: byId.get(i.product_id).supplier_product_id,
        size: i.size || undefined,
        color: i.color || undefined,
        quantity: lines[n].quantity,
        unit_price: fit.unitPrices[n],
      })),
    },
  });
  const sent = answer.order;
  const status = shadamonStatus(sent?.state) || 'in_review';
  await db.from('orders').update({
    courier_consignment_id: String(sent.order_number),
    courier_tracking_code: String(sent.order_number),
    courier_status: status,
    courier_provider: 'shadamon',
    courier_entry_date: new Date().toISOString(),
    courier_last_synced_total: Number(order.total) || 0,
  }).eq('id', orderId);
  const facts = [
    `আপনার লাভ ৳${Math.round(Number(sent.profit) || 0)}`,
    `কাস্টমার দেবেন ৳${Math.round(Number(sent.total) || 0)}`,
    fit.short > 0 ? `(পয়সার হিসাব মেলাতে ৳${fit.short} কম)` : '',
    answer.needs_review ? 'নতুন দোকানের প্রথম ৫টি অর্ডার Shadamon কাস্টমারকে ফোন করে কনফার্ম করে' : '',
  ].filter(Boolean).join(' • ');
  await db.from('courier_tracking_events').insert({
    order_id: orderId,
    consignment_id: String(sent.order_number),
    status: 'order_created',
    note: facts,
    raw_data: { source: 'supplier', supplier: 'shadamon', response: answer },
  });
  return {
    consignment_id: String(sent.order_number),
    tracking_id: String(sent.order_number),
    tracking_code: String(sent.order_number),
    status,
    profit: Number(sent.profit) || 0,
    needs_review: Boolean(answer.needs_review),
  };
}

/** Shadamon's word on one order, saved on the shop's order. */
async function refreshOrder(db: Db, link: Link, order: Row) {
  const { order: theirs } = await shadamonFetch(link, `/orders/${encodeURIComponent(order.courier_consignment_id)}`);
  const status = shadamonStatus(theirs?.state);
  if (status === undefined) return { order_id: order.id, success: false, error: `unknown state: ${theirs?.state}` };
  if (status === null) {
    // Shadamon cancelled it before it went out: back to the shop to decide
    await db.from('orders').update({
      courier_consignment_id: null, courier_status: null, courier_provider: null, courier_entry_date: null,
      courier_last_synced_total: null, status: 'hold', status_note: 'Shadamon অর্ডারটি বাতিল করেছে — কাস্টমারের সাথে কথা বলে আবার পাঠান বা বাতিল করুন।',
    }).eq('id', order.id);
    await db.from('courier_tracking_events').insert({
      order_id: order.id, consignment_id: String(order.courier_consignment_id), status: 'cancelled_by_supplier',
      note: 'Shadamon অর্ডারটি বাতিল করেছে', raw_data: { source: 'supplier', order: theirs },
    });
    return { order_id: order.id, status: 'cancelled_by_supplier', success: true, changed: true };
  }
  const changed = status !== order.courier_status;
  if (changed) await db.from('orders').update({ courier_status: status }).eq('id', order.id);
  return { order_id: order.id, status, state: theirs.state, profit: theirs.profit, profit_credited: theirs.profit_credited, success: true, changed };
}

async function bulkStatus(db: Db, link: Link, body: Row) {
  let query = db.from('orders').select('id, courier_consignment_id, courier_status')
    .eq('courier_provider', 'shadamon').not('courier_consignment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(typeof body.limit === 'number' ? Math.min(body.limit, 500) : 500);
  if (body.order_ids?.length) query = query.in('id', body.order_ids);
  else if (body.only_active === true) query = query.in('courier_status', SHADAMON_ACTIVE_STATUSES);
  const { data: orders } = await query;
  const results: Row[] = [];
  for (const order of orders || []) {
    try {
      results.push(await refreshOrder(db, link, order));
    } catch (e) {
      if (e instanceof HttpError && e.status === 503) throw e;
      results.push({ order_id: order.id, success: false, error: e instanceof Error ? e.message : 'failed' });
    }
  }
  return {
    updated: results.filter((r) => r.changed).length,
    failed: results.filter((r) => !r.success).length,
    total: results.length,
    results,
  };
}

async function cancelOrder(db: Db, where: { orderId?: string; consignmentId?: string }) {
  let query = db.from('orders').select('id, courier_consignment_id, courier_provider');
  query = where.orderId ? query.eq('id', where.orderId) : query.eq('courier_consignment_id', where.consignmentId).eq('courier_provider', 'shadamon');
  const { data: order } = await query.maybeSingle();
  if (!order) throw new HttpError('Order not found', 404);
  if (!order.courier_consignment_id) return { success: true, already_clean: true };
  if (order.courier_provider !== 'shadamon') throw new HttpError(`Order is on ${order.courier_provider}, not Shadamon.`);
  try {
    await shadamonFetch(await shopLink(db), `/orders/${encodeURIComponent(order.courier_consignment_id)}/cancel`, { method: 'POST' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'cancel failed';
    await db.from('courier_tracking_events').insert({
      order_id: order.id, consignment_id: String(order.courier_consignment_id), status: 'cancel_failed',
      note: `Shadamon-এ বাতিল হয়নি: ${message}`, raw_data: { source: 'supplier' },
    });
    throw new HttpError(message, e instanceof HttpError && e.status === 409 ? 409 : 400);
  }
  await db.from('orders').update({
    courier_consignment_id: null, courier_status: null, courier_provider: null, courier_entry_date: null, courier_last_synced_total: null,
  }).eq('id', order.id);
  await db.from('courier_tracking_events').insert({
    order_id: order.id, consignment_id: String(order.courier_consignment_id), status: 'cancelled_by_merchant',
    note: 'অর্ডার ক্যানসেল হওয়ায় Shadamon-এও বাতিল হয়েছে', raw_data: { source: 'supplier' },
  });
  return { success: true, deleted: true, consignment_id: order.courier_consignment_id };
}

// ---------------------------------------------------------------- the 10-minute sync
async function sync() {
  const db = service();
  const link = await findLink(db);
  if (!link) return { linked: false };

  // 1. what Shadamon changed since the last time
  let applied = 0;
  let productsError = '';
  try {
    const since = link.syncedAt ? `&updated_since=${encodeURIComponent(link.syncedAt)}` : '';
    let offset: number | null = 0;
    let serverTime = '';
    for (let page = 0; page < 25 && offset !== null; page++) {
      const data = await shadamonFetch(link, `/products?limit=200&offset=${offset}${since}`);
      if (!serverTime) serverTime = String(data.server_time || '');
      const items = (data.products || []).map((p: Row) => ({ ...p, color_images: colorPhotos(p) }));
      const { data: n, error } = await db.rpc('supplier_apply', { _items: items, _synced_at: '' });
      if (error) throw new Error(error.message);
      applied += Number(n) || 0;
      offset = typeof data.next_offset === 'number' ? data.next_offset : null;
    }
    // a little overlap: a change saved while this ran comes again next time
    const next = serverTime ? new Date(Date.parse(serverTime) - 60_000).toISOString() : '';
    if (next) await db.rpc('supplier_apply', { _items: [], _synced_at: next });
  } catch (e) {
    productsError = e instanceof Error ? e.message : String(e);
    console.warn('[supplier.sync] products:', productsError);
  }

  // 2. the orders Shadamon is still working on
  let orders: Row = {};
  try {
    const r = await bulkStatus(db, link, { only_active: true });
    orders = { updated: r.updated, failed: r.failed, total: r.total };
  } catch (e) {
    orders = { error: e instanceof Error ? e.message : String(e) };
  }
  return { linked: true, products_applied: applied, products_error: productsError || undefined, orders };
}

// ---------------------------------------------------------------- server
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const action = new URL(req.url).searchParams.get('action') || '';
  let body: Row = {};
  try { body = await req.json(); } catch { /* no body */ }

  try {
    switch (action) {
      case 'sync': {
        const internal = req.headers.get('x-internal-secret') || '';
        const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!((INTERNAL_SHARED_SECRET && internal === INTERNAL_SHARED_SECRET) || (bearer && bearer === SUPABASE_SERVICE_ROLE_KEY))) {
          return json({ error: 'Unauthorized' }, 401);
        }
        return json(await sync());
      }
      case 'catalog':
        return json(await catalog(await staff(req, 'products')));
      case 'account':
        return json(await account(await staff(req, 'products')));
      case 'withdraw':
        return json(await withdraw(await staff(req, 'money'), body), 201);
      case 'import':
        return json(await importProducts(await staff(req, 'products'), Array.isArray(body.product_ids) ? body.product_ids : []));

      case 'create_order': {
        const db = await staff(req, 'orders');
        if (!body.order_id) throw new HttpError('order_id is required');
        return json(await sendOrder(db, String(body.order_id)));
      }
      case 'bulk_create': {
        const db = await staff(req, 'orders');
        const ids: string[] = Array.isArray(body.order_ids) ? body.order_ids : [];
        const results: Row[] = [];
        for (const id of ids) {
          try {
            const r = await sendOrder(db, String(id));
            results.push({ order_id: id, success: true, consignment_id: r.consignment_id });
          } catch (e) {
            results.push({ order_id: id, success: false, error: e instanceof Error ? e.message : 'failed' });
          }
        }
        return json({ results, created: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length });
      }
      case 'check_status': {
        const db = await staff(req, 'orders');
        const id = String(body.consignment_id || '');
        if (!id) throw new HttpError('consignment_id is required');
        const { data: order } = await db.from('orders').select('id, courier_consignment_id, courier_status')
          .eq('courier_consignment_id', id).eq('courier_provider', 'shadamon').maybeSingle();
        if (!order) throw new HttpError('Order not found', 404);
        const r = await refreshOrder(db, await shopLink(db), order);
        return json({ ...r, courier_status: r.state });
      }
      case 'get_parcel_details':
      case 'track_parcel': {
        const db = await staff(req, 'orders');
        const id = String(body.tracking_id || body.consignment_id || '');
        if (!id) throw new HttpError('consignment_id is required');
        return json(await shadamonFetch(await shopLink(db), `/orders/${encodeURIComponent(id)}`));
      }
      case 'cancel_order': {
        const db = await staff(req, 'orders');
        if (!body.order_id) throw new HttpError('order_id is required');
        return json(await cancelOrder(db, { orderId: String(body.order_id) }));
      }
      case 'cancel_parcel': {
        const db = await staff(req, 'orders');
        const id = String(body.tracking_id || body.consignment_id || '');
        if (!id) throw new HttpError('consignment_id is required');
        return json(await cancelOrder(db, { consignmentId: id }));
      }
      case 'bulk_status': {
        const db = await staff(req, 'orders');
        const link = await findLink(db);
        // not set up yet: nothing of the shop's is at Shadamon
        if (!link) return json({ updated: 0, failed: 0, total: 0, results: [] });
        return json(await bulkStatus(db, link, body));
      }
      default:
        throw new HttpError(`Unknown action: ${action}`);
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'failed';
    if (status >= 500) console.error(`[supplier] ${action}:`, e);
    return json({ error: message }, status);
  }
});
