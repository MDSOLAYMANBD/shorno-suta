-- AI Landing Page Generator: Phase 0 schema (additive only)

-- 1. Generation audit log
CREATE TABLE IF NOT EXISTS public.ai_landing_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  created_by uuid,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  style_preset text,
  tone text,
  prompt_version text NOT NULL DEFAULT 'v1',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  input_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_in integer,
  tokens_out integer,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_landing_generations_lp ON public.ai_landing_generations(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_ai_landing_generations_created_at ON public.ai_landing_generations(created_at DESC);

ALTER TABLE public.ai_landing_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_landing_generations"
ON public.ai_landing_generations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Style/theme presets
CREATE TABLE IF NOT EXISTS public.ai_landing_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  system_prompt_addendum text,
  default_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_typography jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_blueprint jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_landing_presets_active ON public.ai_landing_presets(is_active, sort_order);

ALTER TABLE public.ai_landing_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_landing_presets"
ON public.ai_landing_presets FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_landing_presets_updated
BEFORE UPDATE ON public.ai_landing_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Section AI metadata
ALTER TABLE public.landing_page_sections
  ADD COLUMN IF NOT EXISTS ai_meta jsonb;

-- 4. Seed default presets
INSERT INTO public.ai_landing_presets (key, label, description, system_prompt_addendum, default_colors, default_typography, section_blueprint, sort_order) VALUES
('luxury_abaya', 'লাক্সারি আবায়া',
 'Premium luxury feel for high-end abaya/burkha products',
 'Use a rich, elegant, premium feel suited for luxury abayas. Lean into deep emerald greens, soft creams, and gold accents. Tone is sophisticated but warm.',
 '{"primary":"#0F4C2E","accent":"#C9A84C","bg":"#FAF7F0","text":"#1a1a1a"}'::jsonb,
 '{"heading":"serif","body":"sans"}'::jsonb,
 '["hero","usp_strip","gallery","benefits","social_proof","reviews","offer","delivery_cod","trust_badges","faq","order_form","sticky_cta","whatsapp_cta","footer"]'::jsonb,
 1),
('premium_burkha', 'প্রিমিয়াম বোরকা',
 'Conservative premium look for borkha collections',
 'Modest, elegant, deep navy and forest tones. Emphasize fabric quality, finish, and modesty.',
 '{"primary":"#1a2547","accent":"#429B39","bg":"#FFFFFF","text":"#1a1a1a"}'::jsonb,
 '{"heading":"serif","body":"sans"}'::jsonb,
 '["hero","benefits","gallery","variants","reviews","offer","delivery_cod","trust_badges","faq","order_form","sticky_cta","footer"]'::jsonb,
 2),
('viral_party', 'ভাইরাল পার্টি',
 'Loud, high-energy, conversion-pushing for party dresses',
 'Bold, vibrant, urgent. Use scarcity, countdown, and social proof aggressively. Punchy short Bengali copy. Hot pinks, golds, deep blacks.',
 '{"primary":"#E11D48","accent":"#F59E0B","bg":"#0a0a0a","text":"#FFFFFF"}'::jsonb,
 '{"heading":"display","body":"sans"}'::jsonb,
 '["hero","countdown","usp_strip","gallery","social_proof","reviews","offer","scarcity","delivery_cod","order_form","sticky_cta","whatsapp_cta","footer"]'::jsonb,
 3),
('minimal_cotton', 'মিনিমাল কটন',
 'Clean, minimal, breathable feel for cotton/everyday wear',
 'Lots of whitespace, soft sage and cream, minimalist Swiss-leaning typography. Honest, calm, friendly Bengali tone.',
 '{"primary":"#7d9b76","accent":"#dce5d4","bg":"#f5f0e8","text":"#1a1a1a"}'::jsonb,
 '{"heading":"sans","body":"sans"}'::jsonb,
 '["hero","benefits","gallery","reviews","delivery_cod","order_form","sticky_cta","footer"]'::jsonb,
 4),
('feminine_summer', 'ফেমিনিন সামার',
 'Soft, airy, feminine for summer collections',
 'Blush pinks, soft lavenders, light backgrounds. Elegant feminine voice. Mention breathability and comfort.',
 '{"primary":"#c9a0dc","accent":"#e8c5d0","bg":"#fef0f5","text":"#1a1a1a"}'::jsonb,
 '{"heading":"serif","body":"sans"}'::jsonb,
 '["hero","benefits","gallery","variants","reviews","social_proof","offer","delivery_cod","order_form","sticky_cta","whatsapp_cta","footer"]'::jsonb,
 5),
('conversion_focus', 'কনভার্শন ফোকাস',
 'Maximum conversion structure for FB/TikTok cold traffic',
 'Optimize aggressively for cold traffic conversion. Lead with biggest hook, repeat CTA every 2 sections, heavy COD and trust emphasis, urgency near the form.',
 '{"primary":"#429B39","accent":"#213580","bg":"#FFFFFF","text":"#1a1a1a"}'::jsonb,
 '{"heading":"sans","body":"sans"}'::jsonb,
 '["hero","usp_strip","offer","benefits","gallery","social_proof","reviews","countdown","scarcity","delivery_cod","trust_badges","faq","order_form","sticky_cta","whatsapp_cta","guarantee","footer"]'::jsonb,
 6)
ON CONFLICT (key) DO NOTHING;
