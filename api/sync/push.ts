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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const { accountId, vaultId, changes, deviceId } = req.body || {};
    const targetVaultId = vaultId || accountId;

    if (!targetVaultId) {
      return res.status(400).json({ error: 'vaultId required' });
    }

    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes must be an array' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({
        error: 'Supabase credentials not configured in Vercel environment variables (SUPABASE_URL / SUPABASE_ANON_KEY)',
      });
    }

    const supabaseRows = changes
      .filter((c: any) => c.noteId && c.ciphertext && c.iv)
      .map((c: any) => {
        const envelopeJson = JSON.stringify({
          ciphertext: c.ciphertext,
          iv: c.iv,
          version: c.version || 1,
        });
        return {
          id: c.noteId,
          vault_id: targetVaultId,
          encrypted_data: envelopeJson,
          version: c.version || 1,
          updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
          deleted: Boolean(c.deleted),
        };
      });

    if (supabaseRows.length > 0) {
      const { error } = await supabase.from('notes').upsert(supabaseRows, {
        onConflict: 'id,vault_id',
      });

      if (error) {
        // Fallback for single primary key 'id'
        const { error: fallbackErr } = await supabase.from('notes').upsert(supabaseRows, {
          onConflict: 'id',
        });
        if (fallbackErr) {
          return res.status(500).json({ error: fallbackErr.message });
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: changes.length,
      serverTimestamp: Date.now(),
      persistedToSupabase: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Push failed' });
  }
}
