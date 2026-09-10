create or replace function public.get_recently_used_product_ids(p_limit int default 30)
returns table(product_id uuid, last_used timestamptz)
language sql stable security definer set search_path = public as $$
  select oi.product_id, max(o.created_at) as last_used
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id is not null
    and o.deleted_at is null
  group by oi.product_id
  order by last_used desc
  limit p_limit;
$$;
grant execute on function public.get_recently_used_product_ids(int) to authenticated;