create table if not exists public.integration_assets (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  asset_type text not null,
  asset_id text not null,
  parent_id text,
  display_name text,
  access_token text,
  scopes text[],
  webhook_subscribed boolean not null default false,
  token_expires_at timestamptz,
  last_health_check_at timestamptz,
  health_status text not null default 'unknown',
  health_detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_assets_unique unique (platform, asset_id)
);

alter table public.integration_assets enable row level security;

drop policy if exists "admin_all_integration_assets" on public.integration_assets;
create policy "admin_all_integration_assets" on public.integration_assets
  for all
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop trigger if exists trg_integration_assets_updated_at on public.integration_assets;
create trigger trg_integration_assets_updated_at
  before update on public.integration_assets
  for each row execute function public.update_updated_at_column();

create index if not exists idx_integration_assets_platform on public.integration_assets(platform);
create index if not exists idx_integration_assets_health on public.integration_assets(health_status);