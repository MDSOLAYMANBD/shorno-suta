// Runs as a side-effect import from `main.tsx` — this is the earliest point
// at which we can push Consent Mode v2 defaults into the dataLayer before any
// tracking script (GA4, Google Ads, GTM, Meta Pixel) has a chance to load.
//
// Also persists any Google Ads click ids present in the current URL so the
// server-side track-conversion function can use them later.

import { initConsentDefaults } from "@/lib/consent";
import { persistClickIdsFromUrl } from "@/lib/trackingIds";

if (typeof window !== "undefined") {
  try {
    initConsentDefaults();
  } catch { /* never block boot */ }
  try {
    persistClickIdsFromUrl();
  } catch { /* never block boot */ }
}
