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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const { accountId, vaultId, changes } = req.body || {};
    const targetVaultId = vaultId || accountId;

    if (!targetVaultId) {
      return res.status(400).json({ error: 'vaultId required' });
    }

    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes must be an array' });
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

    if (changes.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
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
      // First attempt upsert with onConflict on (id, vault_id)
      let { error } = await supabase.from('notes').upsert(supabaseRows, {
        onConflict: 'id,vault_id',
      });

      // If composite key failed, try with single key 'id'
      if (error && error.message.includes('onConflict')) {
        const fallback = await supabase.from('notes').upsert(supabaseRows, {
          onConflict: 'id',
        });
        error = fallback.error;
      }

      if (error) {
        console.error('Supabase push error:', error);
        if (error.message.includes('row-level security') || error.code === '42501') {
          return res.status(500).json({
            error:
              'Supabase Row Level Security (RLS) is blocking inserts. In your Supabase SQL editor, run: ALTER TABLE notes DISABLE ROW LEVEL SECURITY; or add an INSERT/UPDATE policy.',
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
    }

    return res.status(200).json({
      success: true,
      count: changes.length,
      serverTimestamp: Date.now(),
      persistedToSupabase: true,
    });
  } catch (err: any) {
    console.error('Push error:', err);
    return res.status(500).json({ error: err.message || 'Push failed' });
  }
}
