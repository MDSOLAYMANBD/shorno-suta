
-- Add group_id to staff_notifications
ALTER TABLE public.staff_notifications ADD COLUMN IF NOT EXISTS group_id UUID;
CREATE INDEX IF NOT EXISTS idx_staff_notifications_group_id ON public.staff_notifications(group_id);

-- Reactions table
CREATE TABLE public.staff_notification_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.staff_notification_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all reactions"
  ON public.staff_notification_reactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert own reactions"
  ON public.staff_notification_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON public.staff_notification_reactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON public.staff_notification_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE public.staff_notification_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_notification_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all comments"
  ON public.staff_notification_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert own comments"
  ON public.staff_notification_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.staff_notification_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_staff_notification_reactions_group ON public.staff_notification_reactions(group_id);
CREATE INDEX idx_staff_notification_comments_group ON public.staff_notification_comments(group_id);
