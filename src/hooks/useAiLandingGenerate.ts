import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AiGenerateParams {
  product_ids: string[];
  style_preset?: string;
  tone?: string;
  title?: string;
  slug?: string;
  landing_page_id?: string;
  directive?: string;
}

export interface AiGenerateResult {
  landing_page_id: string;
  slug: string;
  generation_id: string | null;
  sections: Array<{ id: string; sort_order: number; ai_meta: any }>;
  layout_meta: {
    theme?: string;
    colors?: any;
    typography?: any;
    section_count: number;
  };
  tokens: { in: number | null; out: number | null };
  duration_ms: number;
}

export function useAiLandingGenerate() {
  return useMutation<AiGenerateResult, Error, AiGenerateParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke('ai-landing-generate', {
        body: params,
      });
      if (error) throw new Error(error.message || 'AI generation failed');
      if (data?.error) throw new Error(data.error);
      return data as AiGenerateResult;
    },
  });
}
