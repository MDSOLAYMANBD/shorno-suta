-- Drop the overly-permissive public SELECT policy on giveaway_entries
-- The public giveaway page already uses the get_public_giveaway_entries() RPC function
-- Staff access is preserved via the existing "Staff can view giveaway entries" policy
DROP POLICY IF EXISTS "Anyone can read giveaway entries" ON public.giveaway_entries;