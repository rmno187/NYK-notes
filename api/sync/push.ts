import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, getSupabaseConfig, parseRequestBody, getBearerToken } from '../lib/supabase';

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
    const authKey = getBearerToken(req);
    if (!authKey) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const body = parseRequestBody(req);
    const targetVaultId = body.vaultId || body.accountId || (req.query?.vaultId as string) || (req.query?.accountId as string);
    const changes = body.changes;

    if (!targetVaultId) {
      return res.status(400).json({ error: 'vaultId or accountId required in request body or query' });
    }

    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes must be an array of note envelopes' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      const config = getSupabaseConfig();
      return res.status(500).json({
        error: `Supabase environment variables missing on Vercel. SUPABASE_URL: ${
          config.url ? 'found' : 'MISSING'
        }, SUPABASE_ANON_KEY: ${config.key ? 'found' : 'MISSING'}. Go to Vercel Settings > Environment Variables.`,
      });
    }

    if (changes.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const supabaseRows = changes
      .filter((c: any) => c && c.noteId && c.ciphertext && c.iv)
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

    if (supabaseRows.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    // 1. Try standard upsert with composite key (id, vault_id)
    let upsertResult = await supabase.from('notes').upsert(supabaseRows, {
      onConflict: 'id,vault_id',
    });

    // 2. If composite key constraint wasn't created, retry with single key 'id'
    if (upsertResult.error && (upsertResult.error.message.includes('onConflict') || upsertResult.error.code === '42P10')) {
      upsertResult = await supabase.from('notes').upsert(supabaseRows, {
        onConflict: 'id',
      });
    }

    // 3. If standard upsert still fails, fallback to delete + insert
    if (upsertResult.error && upsertResult.error.code !== '42501' && !upsertResult.error.message.includes('row-level security')) {
      for (const row of supabaseRows) {
        await supabase.from('notes').delete().eq('id', row.id).eq('vault_id', row.vault_id);
        const ins = await supabase.from('notes').insert(row);
        if (ins.error) {
          upsertResult = ins;
          break;
        } else {
          upsertResult = { data: null, error: null } as any;
        }
      }
    }

    if (upsertResult.error) {
      const error = upsertResult.error;
      console.error('Supabase push error:', error);
      
      if (error.message?.includes('row-level security') || error.code === '42501') {
        return res.status(500).json({
          error:
            'Supabase Row Level Security (RLS) is blocking inserts. In Supabase SQL Editor run: ALTER TABLE notes DISABLE ROW LEVEL SECURITY;',
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
        error: `Supabase Error: ${error.message || error.code || 'Unknown DB error'}`,
        code: error.code,
        hint: error.hint,
      });
    }

    return res.status(200).json({
      success: true,
      count: supabaseRows.length,
      serverTimestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Unexpected error in push handler:', err);
    return res.status(500).json({
      error: `Push failed: ${err.message || 'Internal server error'}`,
    });
  }
}
