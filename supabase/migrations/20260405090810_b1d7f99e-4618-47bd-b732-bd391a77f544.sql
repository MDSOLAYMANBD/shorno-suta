-- Fix 1: Avatar bucket DELETE policy - add ownership check
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete avatars" ON storage.objects;

-- Remove any existing DELETE policy on avatars bucket that lacks ownership
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND cmd = 'DELETE'
    AND policyname ILIKE '%avatar%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Create properly scoped DELETE policy
CREATE POLICY "Customers can delete own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 2: Revoke public SELECT on cost_price column in products table
-- (Re-apply in case previous migration didn't stick)
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM authenticated;

-- Grant cost_price access only through admin RLS (service role always has access)
-- Staff who need cost_price will use service-role or RPC