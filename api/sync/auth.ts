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
    const { authKeyHex, authSalt, vaultId, accountId } = req.body || {};
    const targetVaultId = vaultId || accountId;

    if (!authKeyHex || !authSalt) {
      return res.status(400).json({ error: 'authKeyHex and authSalt are required' });
    }

    const { url, key } = getSupabaseConfig();
    const supabase = getSupabase();

    if (!supabase) {
      return res.status(500).json({
        error:
          'Supabase credentials missing on Vercel. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your Vercel Project Settings > Environment Variables.',
      });
    }

    const newVaultId = targetVaultId || 'vault_' + Math.random().toString(36).substring(2, 14);

    return res.status(200).json({
      vaultId: newVaultId,
      accountId: newVaultId,
      isNew: !targetVaultId,
      supabaseConnected: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Auth error' });
  }
}
