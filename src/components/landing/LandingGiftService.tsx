import { useState } from 'react';
import { Gift, Heart, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LazyImage } from '@/components/ui/lazy-image';

interface LandingGiftServiceProps {
  heading?: string;
  description?: string;
  sampleNote?: string;
  sampleSender?: string;
  bgColor?: string;
  accentColor?: string;
  ctaText?: string;
  sampleImages?: string[];
  imageCaption?: string;
  hideCta?: boolean;
}

export default function LandingGiftService({
  heading,
  description,
  sampleNote,
  sampleSender,
  bgColor,
  accentColor,
  ctaText,
  sampleImages = [],
  imageCaption,
  hideCta = false,
}: LandingGiftServiceProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Resolve empty strings from DB to sensible defaults
  const ac = accentColor || '#e91e63';
  const resolvedHeading = heading || 'প্রিয়জনকে সারপ্রাইজ দিন! 🎁';
  const resolvedDesc = description || 'আপনি যদি চান আপনার প্রিয় মানুষকে উপহার দিতে একটি সুন্দর নোটের মাধ্যমে, আমরা সেটা প্যাক করে দিচ্ছি একদম ফ্রি-তে!';
  const resolvedNote = sampleNote || 'তোমার জন্য ছোট্ট একটা সারপ্রাইজ! তোমাকে অনেক ভালোবাসি ❤️';
  const resolvedSender = sampleSender || 'তোমার আপনজন';
  const resolvedCta = ctaText || 'এখনই অর্ডার করুন';
  const resolvedCaption = imageCaption || 'মেমোতে গিফট নোট দেখতে এমন হবে ✨';

  return (
    <section
      className="py-8 px-4"
      style={{ backgroundColor: bgColor || undefined }}
    >
      <div className="max-w-xl mx-auto">
        {/* Main Card */}
        <div className="relative rounded-2xl border-2 border-dashed overflow-hidden bg-gradient-to-br from-pink-50 via-white to-rose-50" style={{ borderColor: ac + '40' }}>
          {/* FREE Badge */}
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-green-500 text-white text-xs font-bold px-3 py-1 shadow-lg hover:bg-green-500">
              ✨ FREE
            </Badge>
          </div>

          <div className="p-6 space-y-5">
            {/* Heading */}
            <div className="text-center space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: ac }}>
                {resolvedHeading}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {resolvedDesc}
              </p>
            </div>

            {/* Instruction */}
            <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: ac }}>
              <Sparkles className="h-4 w-4" />
              <span>আপনার মনের কথা লিখে দিন নোটে</span>
              <Sparkles className="h-4 w-4" />
            </div>

            {/* Sample Gift Note Card */}
            <div className="mx-auto max-w-sm">
              <div
                className="rounded-xl p-5 shadow-md border"
                style={{
                  background: `linear-gradient(135deg, ${ac}08, ${ac}15)`,
                  borderColor: ac + '30',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: ac + '20' }}
                  >
                    <Gift className="h-4 w-4" style={{ color: ac }} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ac }}>
                    Gift Note
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-foreground/80 italic mb-3">
                  "{resolvedNote}"
                </p>

                <div className="flex items-center gap-1.5 justify-end">
                  <Heart className="h-3 w-3" style={{ color: ac, fill: ac }} />
                  <span className="text-xs font-medium text-muted-foreground">— {resolvedSender}</span>
                </div>
              </div>
            </div>

            {/* Sample Images Gallery */}
            {sampleImages.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-center text-xs font-medium text-muted-foreground">{resolvedCaption}</p>
                <div className={`grid gap-3 ${sampleImages.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-2'}`}>
                  {sampleImages.map((url, i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden shadow-lg border-[3px] border-white cursor-pointer transition-transform hover:scale-[1.03] active:scale-95"
                      style={{ boxShadow: `0 4px 20px ${ac}20` }}
                      onClick={() => setLightboxUrl(url)}
                    >
                      <LazyImage
                        src={url}
                        alt={`গিফট মেমো স্যাম্পল ${i + 1}`}
                        className="w-full aspect-[3/4]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            {!hideCta && (
              <div className="text-center pt-1">
                <button
                  onClick={() => document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-lg transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: ac }}
                >
                  {resolvedCta}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="গিফট মেমো স্যাম্পল"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
