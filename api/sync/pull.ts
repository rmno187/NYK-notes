import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (url && key) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const vaultId = (req.query.vaultId || req.query.accountId) as string;
    const since = Number(req.query.since || 0);

    if (!vaultId) {
      return res.status(400).json({ error: 'vaultId required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({
        error: 'Supabase credentials not configured in Vercel environment variables (SUPABASE_URL / SUPABASE_ANON_KEY)',
      });
    }

    let query = supabase
      .from('notes')
      .select('id, vault_id, encrypted_data, version, updated_at, deleted')
      .eq('vault_id', vaultId);

    if (since > 0) {
      const sinceIso = new Date(since).toISOString();
      query = query.gt('updated_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const remoteNotes = (data || []).map((row: any) => {
      let ciphertext = '';
      let iv = '';
      try {
        const parsed = JSON.parse(row.encrypted_data);
        ciphertext = parsed.ciphertext;
        iv = parsed.iv;
      } catch {
        ciphertext = row.encrypted_data;
      }

      return {
        noteId: row.id,
        vaultId: row.vault_id || vaultId,
        version: Number(row.version || 1),
        ciphertext,
        iv,
        updatedAt: new Date(row.updated_at).getTime(),
        deleted: Boolean(row.deleted),
      };
    });

    return res.status(200).json({
      notes: remoteNotes,
      serverTimestamp: Date.now(),
      source: 'supabase',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Pull failed' });
  }
}
