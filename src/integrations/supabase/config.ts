// Single source of truth for the Supabase backend the app talks to.
// The backend is self-hosted on our VPS (Coolify) at api.shornosuta.com.
// Every fetch to an edge function or storage URL must build on these values,
// never on a hardcoded host.

export const SUPABASE_URL = "https://api.shornosuta.com";

// Public anon key (safe to ship in the browser; RLS protects the data).
export const SUPABASE_PUBLISHABLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTM2NDk4MCwiZXhwIjo0OTQ3MDM4NTgwLCJyb2xlIjoiYW5vbiJ9.8SrXqiAa_1UfDiFdRJ2a0pfhhFyLfwBYxXBFmrzujR4";

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// localStorage key for the persisted auth session. Pinned explicitly so the
// admin "session still restoring" checks stay correct if the host changes.
export const AUTH_STORAGE_KEY = "sb-shornosuta-auth-token";
