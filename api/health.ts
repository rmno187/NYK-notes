import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, getSupabaseConfig } from './lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url, key, source } = getSupabaseConfig();
  const supabase = getSupabase();

  let tableNotesExists = false;
  let rlsEnabled = false;
  let errorDetail = null;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('notes').select('id').limit(1);
      if (!error) {
        tableNotesExists = true;
      } else {
        errorDetail = error.message;
        if (error.message.includes('row-level security') || error.code === '42501') {
          rlsEnabled = true;
        }
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
    authKeySource: source,
    supabaseConfigured: Boolean(supabase),
    tableNotesExists,
    rlsBlocking: rlsEnabled,
    errorDetail,
  });
}
