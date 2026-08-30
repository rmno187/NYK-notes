import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

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
      const config = getSupabaseConfig();
      return res.status(500).json({
        error: `Supabase environment variables missing on Vercel. (SUPABASE_URL: ${
          config.url ? 'found' : 'missing'
        }, SUPABASE_ANON_KEY: ${config.key ? 'found' : 'missing'})`,
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
      console.error('Supabase pull error:', error);
      if (error.message.includes('row-level security') || error.code === '42501') {
        return res.status(500).json({
          error:
            'Supabase Row Level Security (RLS) is blocking reads. In your Supabase SQL editor, run: ALTER TABLE notes DISABLE ROW LEVEL SECURITY; or add a SELECT policy.',
          code: 'RLS_VIOLATION',
          detail: error.message,
        });
      }
      if (error.message.includes('relation "notes" does not exist') || error.code === '42P01') {
        return res.status(500).json({
          error:
            'Supabase table "notes" does not exist. In your Supabase SQL Editor, run the CREATE TABLE statement.',
          code: 'TABLE_NOT_FOUND',
          detail: error.message,
        });
      }
      return res.status(500).json({ error: error.message, code: error.code });
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
    console.error('Pull error:', err);
    return res.status(500).json({ error: err.message || 'Pull failed' });
  }
}
