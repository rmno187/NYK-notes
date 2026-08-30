import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  let supabaseReachable = false;
  let errorDetail = null;

  if (url && key) {
    try {
      const client = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await client.from('notes').select('id').limit(1);
      if (!error) {
        supabaseReachable = true;
      } else {
        errorDetail = error.message;
      }
    } catch (e: any) {
      errorDetail = e.message;
    }
  }

  res.status(200).json({
    status: 'ok',
    provider: 'vercel-serverless-supabase',
    hasEnvUrl: Boolean(url),
    hasEnvKey: Boolean(key),
    supabaseReachable,
    errorDetail,
  });
}
