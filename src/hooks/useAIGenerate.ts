import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AIGenerateType = 'seo' | 'product_description' | 'landing_content' | 'caption' | 'banner_image' | 'general';

export type BannerImageModel =
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'
  | 'gemini-2.5-flash-image'
  | 'gemini-2.5-flash-image-preview'
  | 'imagen-4.0-generate-001'
  | 'imagen-3.0-generate-002'
  | 'auto';

export interface BannerImageOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  model?: BannerImageModel;
}

export function useAIGenerate() {
  const [loading, setLoading] = useState(false);

  const generateContent = useCallback(async (
    type: AIGenerateType,
    prompt: string,
    context?: string
  ): Promise<string | null> => {
    if (!prompt.trim()) {
      toast.error('প্রম্পট দিন');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type, prompt, context },
      });

      if (error) {
        const msg = error.message || 'AI জেনারেশনে সমস্যা হয়েছে';
        toast.error(msg);
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.content || null;
    } catch (e: any) {
      toast.error(e.message || 'AI সার্ভিসে সমস্যা হয়েছে');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBannerImage = useCallback(async (
    prompt: string,
    options: BannerImageOptions = {}
  ): Promise<string | null> => {
    if (!prompt.trim()) {
      toast.error('ব্যানারের জন্য প্রম্পট দিন');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type: 'banner_image',
          prompt,
          size: options.size || '1792x1024',
          quality: options.quality || 'standard',
          model: options.model || 'auto',
        },
      });

      if (error) {
        toast.error(error.message || 'ব্যানার জেনারেশনে সমস্যা হয়েছে');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.image_url || null;
    } catch (e: any) {
      toast.error(e.message || 'Gemini সার্ভিসে সমস্যা হয়েছে');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateContent, generateBannerImage, loading };
}
