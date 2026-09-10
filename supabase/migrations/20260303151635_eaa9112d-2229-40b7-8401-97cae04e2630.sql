-- Allow users to update their own push subscriptions (needed for upsert)
CREATE POLICY "Users can update own subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add unique constraint for upsert to work properly
ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_endpoint_unique 
UNIQUE (user_id, endpoint);