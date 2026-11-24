-- Dropshipping from Shadamon Shop (admin → ড্রপশিপিং; the supplier edge function), the same
-- as in the CORE Shop engine. The shop picks Shadamon's products and adds them; the supplier
-- function keeps them in step with Shadamon (stock, Shadamon's own price, the least the shop
-- may sell for, and whether it is still on sale). cost_price holds Shadamon's wholesale
-- price, so the profit reports count it. An order of such products goes to Shadamon from the
-- order's courier menu ("Shadamon"): Shadamon packs and ships it and the profit goes to the
-- shop's Shadamon wallet.
--
--   supplier             'shadamon' (null: the shop's own product)
--   supplier_product_id  the product's id at Shadamon
--   supplier_price       Shadamon's price: the shop may sell for more, never for less
--   supplier_paused      Shadamon took it off sale, so the sync turned the product off
--                        (and turns it back on when Shadamon does; a product the shop
--                        turned off itself stays off)
alter table public.products
  add column if not exists supplier text check (supplier is null or supplier in ('shadamon')),
  add column if not exists supplier_product_id text,
  add column if not exists supplier_price numeric,
  add column if not exists supplier_paused boolean not null default false;
-- This shop grants products' columns one by one: signed-in users (the admin's select *)
-- read these as they read cost_price; visitors do not.
grant select (supplier, supplier_product_id, supplier_price, supplier_paused) on public.products to authenticated;

create unique index if not exists products_supplier_item_idx
  on public.products (supplier, supplier_product_id)
  where supplier is not null;

-- The price a shopper pays (a sale price below the price, else the price) never goes below
-- Shadamon's price: an order below it could not be sent to Shadamon.
create or replace function public.keep_supplier_min_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  _sells_for numeric;
begin
  if new.supplier is null or coalesce(new.supplier_price, 0) <= 0 or new.deleted_at is not null then
    return new;
  end if;
  _sells_for := case when coalesce(new.original_price, 0) > 0 and new.original_price < new.price
                     then new.original_price else new.price end;
  if _sells_for < new.supplier_price then
    raise exception 'এই পণ্যটি Shadamon থেকে আসে: দাম ৳% এর কম রাখা যাবে না।', round(new.supplier_price)
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_supplier_min_price on public.products;
create trigger trg_products_supplier_min_price
  before insert or update of price, original_price, supplier_price on public.products
  for each row execute function public.keep_supplier_min_price();

-- The shop's products that come from Shadamon, for the admin (badges, the editor's least
-- price, profit, the courier menu's "Shadamon"). Staff only.
create or replace function public.get_supplier_products()
returns table (id uuid, supplier text, supplier_product_id text, supplier_price numeric, cost_price numeric, supplier_paused boolean)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  if not (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'product_manager'::app_role)
          or has_role(auth.uid(), 'order_manager'::app_role) or has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'access denied';
  end if;
  return query
  select p.id, p.supplier, p.supplier_product_id, p.supplier_price, p.cost_price, p.supplier_paused
  from public.products p
  where p.supplier is not null and p.deleted_at is null;
end;
$$;
revoke execute on function public.get_supplier_products() from public, anon;
grant execute on function public.get_supplier_products() to authenticated;

-- The shop's partner key at Shadamon's partner API, which CORE sets up for the shop
-- (Shadamon: POST /core/shops). Service role only: no policy, no grant to the browser.
--   synced_at  Shadamon's server time at the last product sync (?updated_since=)
create table if not exists public.supplier_links (
  supplier text primary key check (supplier in ('shadamon')),
  api_url text not null default 'https://api.shadamonshop.com/functions/v1/partner-api',
  api_key text,
  partner_id text,
  partner_ref uuid not null default gen_random_uuid(),
  synced_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supplier_links enable row level security;
revoke all on public.supplier_links from public, anon, authenticated;
grant select, insert, update, delete on public.supplier_links to service_role;

-- Shadamon's changed products (its partner API's product objects) in the shop, then
-- remembers Shadamon's time for the next ?updated_since=. Service role only.
--   stock, pre-order and the wholesale price (cost_price) follow Shadamon;
--   the price: a product that kept Shadamon's price follows it, one the shop sells for more
--     keeps its own unless Shadamon's price passes it (then it goes up to Shadamon's);
--   on_sale false turns the product off (supplier_paused), true turns back on only what
--     the sync turned off.
create or replace function public.supplier_apply(_items jsonb, _synced_at text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _i record;
  _p record;
  _sells_for numeric;
  _price numeric;
  _sale numeric;
  _n integer := 0;
begin
  for _i in
    select * from jsonb_to_recordset(coalesce(_items, '[]'::jsonb))
      as x(id text, price numeric, compare_at_price numeric, wholesale_price numeric, stock integer,
           allow_pre_order boolean, on_sale boolean, color_images jsonb)
    where x.id is not null and coalesce(x.price, 0) > 0
  loop
    for _p in
      select p.id, p.price, p.original_price, p.supplier_price, p.is_active, p.supplier_paused
      from public.products p
      where p.supplier = 'shadamon' and p.supplier_product_id = _i.id and p.deleted_at is null
    loop
      _sells_for := case when coalesce(_p.original_price, 0) > 0 and _p.original_price < _p.price
                         then _p.original_price else _p.price end;
      _price := _p.price;
      _sale := _p.original_price;
      if _sells_for = coalesce(_p.supplier_price, _sells_for) then
        -- kept Shadamon's price (and its crossed-out price): follow it
        _price := coalesce(_i.compare_at_price, _i.price);
        _sale := case when _i.compare_at_price is not null then _i.price end;
      elsif _sells_for < _i.price then
        if coalesce(_p.original_price, 0) > 0 and _p.original_price < _p.price and _i.price < _p.price then
          _sale := _i.price;
        else
          _price := _i.price;
          _sale := null;
        end if;
      end if;
      update public.products set
        supplier_price = _i.price,
        price = _price,
        original_price = _sale,
        cost_price = coalesce(_i.wholesale_price, cost_price),
        stock = greatest(coalesce(_i.stock, 0), 0),
        allow_pre_order = coalesce(_i.allow_pre_order, allow_pre_order),
        is_active = case when _i.on_sale is false then false
                         when _i.on_sale and supplier_paused then true
                         else is_active end,
        supplier_paused = case when _i.on_sale is false then (supplier_paused or is_active)
                               when _i.on_sale then false
                               else supplier_paused end,
        -- Shadamon's photos per colour, until the shop has its own for them
        variant_images = case
          when jsonb_typeof(_i.color_images) = 'object' and _i.color_images <> '{}'::jsonb
               and coalesce(variant_images -> 'color_images', '{}'::jsonb) = '{}'::jsonb
          then jsonb_set(coalesce(variant_images, '{}'::jsonb), '{color_images}', _i.color_images)
          else variant_images end
      where id = _p.id;
      _n := _n + 1;
    end loop;
  end loop;
  if nullif(_synced_at, '') is not null then
    update public.supplier_links set synced_at = _synced_at, updated_at = now() where supplier = 'shadamon';
  end if;
  return _n;
end;
$$;
revoke execute on function public.supplier_apply(jsonb, text) from public, anon, authenticated;
grant execute on function public.supplier_apply(jsonb, text) to service_role;

notify pgrst, 'reload schema';
