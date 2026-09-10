import { optimizedImageUrl, srcSetFor } from '@/lib/imageUrl';

interface Props {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export default function LandingHero({ title, subtitle, imageUrl }: Props) {
  if (!title && !subtitle && !imageUrl) return null;
  return (
    <section className="relative py-10 sm:py-16 px-4 text-center" style={{ background: 'linear-gradient(180deg, #F1F8F4 0%, #FFFFFF 100%)' }}>
      <div className="max-w-3xl mx-auto">
        {title && (
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 leading-tight" style={{ color: '#1a1a1a' }}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-base sm:text-lg mb-6" style={{ color: '#666' }}>
            {subtitle}
          </p>
        )}
        {imageUrl && (
          <img
            src={optimizedImageUrl(imageUrl, 800, 80)}
            srcSet={srcSetFor(imageUrl, [400, 800, 1200], 80)}
            sizes="(max-width: 640px) 100vw, 800px"
            alt={title || 'Hero'}
            width={1200}
            height={675}
            className="w-full max-w-2xl mx-auto rounded-xl mb-6 shadow-lg"
            style={{ aspectRatio: '16 / 9', height: 'auto' }}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src !== imageUrl) { img.srcset = ''; img.src = imageUrl; }
            }}
          />
        )}
      </div>
    </section>
  );
}
