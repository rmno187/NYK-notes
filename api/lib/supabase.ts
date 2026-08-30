import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig(): { url?: string; key?: string; source?: string } {
  // Check all possible variable names injected by Vercel integrations & platforms
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;

  let source = 'none';
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) source = 'SUPABASE_SERVICE_ROLE_KEY';
  else if (process.env.SUPABASE_ANON_KEY) source = 'SUPABASE_ANON_KEY';
  else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) source = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
  else if (process.env.VITE_SUPABASE_ANON_KEY) source = 'VITE_SUPABASE_ANON_KEY';

  return { url, key, source };
}

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, key } = getSupabaseConfig();
  if (url && key) {
    try {
      cachedClient = createClient(url, key, {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
    }
  }

  return cachedClient;
}
