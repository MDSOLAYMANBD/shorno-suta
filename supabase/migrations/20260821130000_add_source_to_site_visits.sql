-- Adds a visit-level traffic-source column so ভিজিটর অ্যানালিটিক্স can show
-- how many visitors (not just orders — order_origin on the orders table
-- already covers that) arrived from Facebook, Google, direct/organic, etc.
-- Nullable — existing rows predate this and simply won't count in the
-- breakdown, same as any other newly-added optional column.
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS source text;
