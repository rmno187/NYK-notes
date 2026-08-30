import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, getSupabaseConfig, getBearerToken, parseRequestBody } from '../lib/supabase';

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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authKey = getBearerToken(req);
    if (!authKey) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const body = req.method === 'POST' ? parseRequestBody(req) : {};
    const targetVaultId =
      (req.query.vaultId as string) ||
      (req.query.accountId as string) ||
      body.vaultId ||
      body.accountId;

    if (!targetVaultId) {
      return res.status(400).json({ error: 'vaultId or accountId required in query parameter or body' });
    }

    const sinceParam = req.query.since || body.since || 0;
    const since = Number(sinceParam) || 0;

    const supabase = getSupabase();
    if (!supabase) {
      const config = getSupabaseConfig();
      return res.status(500).json({
        error: `Supabase credentials missing on Vercel. SUPABASE_URL: ${
          config.url ? 'found' : 'MISSING'
        }, SUPABASE_ANON_KEY: ${config.key ? 'found' : 'MISSING'}. Go to Vercel Settings > Environment Variables.`,
      });
    }

    let query = supabase
      .from('notes')
      .select('id, vault_id, encrypted_data, version, updated_at, deleted')
      .eq('vault_id', targetVaultId);

    if (since > 0) {
      query = query.gt('updated_at', new Date(since).toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase pull error:', error);
      if (error.message?.includes('row-level security') || error.code === '42501') {
        return res.status(500).json({
          error:
            'Supabase Row Level Security (RLS) is blocking reads. In Supabase SQL Editor run: ALTER TABLE notes DISABLE ROW LEVEL SECURITY;',
          code: 'RLS_VIOLATION',
          detail: error.message,
        });
      }
      if (error.message?.includes('relation "notes" does not exist') || error.code === '42P01') {
        return res.status(500).json({
          error:
            'Supabase table "notes" does not exist. Run the CREATE TABLE script in your Supabase SQL Editor.',
          code: 'TABLE_NOT_FOUND',
          detail: error.message,
        });
      }
      return res.status(500).json({
        error: `Supabase Error: ${error.message || error.code || 'Query failed'}`,
        code: error.code,
        hint: error.hint,
      });
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
        vaultId: row.vault_id || targetVaultId,
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
      count: remoteNotes.length,
    });
  } catch (err: any) {
    console.error('Unexpected error in pull handler:', err);
    return res.status(500).json({
      error: `Pull failed: ${err.message || 'Internal server error'}`,
    });
  }
}
