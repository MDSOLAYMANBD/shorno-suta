-- 1. ai_knowledge_base table
CREATE TABLE public.ai_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'faq',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active FAQs"
ON public.ai_knowledge_base FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins manage FAQs"
ON public.ai_knowledge_base FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ai_knowledge_base_updated_at
BEFORE UPDATE ON public.ai_knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ai_kb_active_priority ON public.ai_knowledge_base(is_active, priority DESC);

-- 2. ai_support_requests table
CREATE TABLE public.ai_support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL DEFAULT '',
  visitor_phone TEXT NOT NULL DEFAULT '',
  last_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

ALTER TABLE public.ai_support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all support requests"
ON public.ai_support_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update support requests"
ON public.ai_support_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_support_status_created ON public.ai_support_requests(status, created_at DESC);

-- 3. Add metadata column to chat_messages
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. SECURITY DEFINER fn for AI escalation (called by edge function)
CREATE OR REPLACE FUNCTION public.create_ai_support_request(
  p_session_id UUID,
  p_session_token TEXT,
  p_visitor_name TEXT,
  p_visitor_phone TEXT,
  p_last_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE id = p_session_id AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  INSERT INTO public.ai_support_requests (session_id, visitor_name, visitor_phone, last_message)
  VALUES (p_session_id, COALESCE(left(trim(p_visitor_name), 200), ''), COALESCE(left(trim(p_visitor_phone), 20), ''), left(COALESCE(p_last_message, ''), 1000))
  RETURNING id INTO v_id;

  INSERT INTO public.admin_notifications (type, title, message, link, reference_id)
  VALUES (
    'support_request',
    '🆘 হিউম্যান সাপোর্ট রিকোয়েস্ট',
    COALESCE(NULLIF(trim(p_visitor_name), ''), 'একজন ভিজিটর') || ' (' || COALESCE(NULLIF(trim(p_visitor_phone), ''), 'ফোন নেই') || ')',
    '/admin/ai-support-requests',
    v_id::text
  );

  RETURN v_id;
END;
$$;

-- 5. SECURITY DEFINER fn for inserting AI message (edge function)
CREATE OR REPLACE FUNCTION public.insert_ai_chat_message(
  p_session_id UUID,
  p_session_token TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
    RAISE EXCEPTION 'Session token required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_sessions
    WHERE id = p_session_id AND session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid session';
  END IF;

  INSERT INTO public.chat_messages (session_id, sender_type, sender_name, message, metadata)
  VALUES (p_session_id, 'ai', 'স্বর্ণ সুতা AI', left(COALESCE(p_message, ''), 5000), COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  UPDATE public.chat_sessions SET last_message_at = now() WHERE id = p_session_id;

  RETURN v_id;
END;
$$;

-- 6. Seed default settings
INSERT INTO public.store_settings (key, value) VALUES
('ai_chat_enabled', 'true'),
('ai_chat_auto_reply', 'true'),
('ai_chat_system_prompt', 'তুমি স্বর্ণ সুতার একজন বন্ধুসুলভ কাস্টমার সাপোর্ট প্রতিনিধি। সবসময় বাংলায় (প্রয়োজনে English) ইসলামিক সম্মানজনক ভাষায় উত্তর দাও। সংক্ষিপ্ত, পরিষ্কার এবং সাহায্যকারী হও। নিজে থেকে দাম বানিয়ে বলবে না — শুধু provided context থেকে answer দিবে।'),
('ai_chat_greeting', 'আসসালামু আলাইকুম! 🌿 স্বর্ণ সুতায় স্বাগতম। আমি আপনাকে কীভাবে সাহায্য করতে পারি? প্রোডাক্ট, দাম, ডেলিভারি বা অর্ডার সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।'),
('ai_chat_model', 'google/gemini-2.5-flash')
ON CONFLICT (key) DO NOTHING;

-- 7. Seed a few default FAQs
INSERT INTO public.ai_knowledge_base (question, answer, category, priority) VALUES
('ডেলিভারি কত দিনে আসে?', 'ঢাকার ভেতরে ১-২ দিন এবং ঢাকার বাইরে ৩-৫ দিনের মধ্যে আপনার অর্ডার ডেলিভারি হয়ে যাবে ইনশাআল্লাহ।', 'delivery', 100),
('ডেলিভারি চার্জ কত?', 'ঢাকার ভেতরে ৭০ টাকা এবং ঢাকার বাইরে ১৩০ টাকা ডেলিভারি চার্জ। ক্যাশ অন ডেলিভারি সুবিধা আছে।', 'delivery', 90),
('পণ্য কি রিটার্ন/এক্সচেঞ্জ করা যায়?', 'হ্যাঁ, ডেলিভারির ৩ দিনের মধ্যে অরিজিনাল প্যাকেজিং সহ রিটার্ন/এক্সচেঞ্জ করা যাবে। পণ্য ব্যবহৃত বা ধোয়া হলে গ্রহণযোগ্য নয়।', 'return', 80),
('পেমেন্ট কীভাবে করব?', 'আপনি ক্যাশ অন ডেলিভারি (COD), bKash, Nagad বা ব্যাংক ট্রান্সফারে পেমেন্ট করতে পারবেন।', 'faq', 70)
ON CONFLICT DO NOTHING;