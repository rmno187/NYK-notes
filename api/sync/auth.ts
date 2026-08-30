import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, getSupabaseConfig, parseRequestBody } from '../lib/supabase';

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
    const body = parseRequestBody(req);
    const { authKeyHex, authSalt, accountId, vaultId } = body;

    if (!authKeyHex || !authSalt) {
      return res.status(400).json({ error: 'authKeyHex and authSalt are required' });
    }

    const targetVaultId = accountId || vaultId || 'vault_' + authKeyHex.substring(0, 16);
    const supabase = getSupabase();
    const config = getSupabaseConfig();

    return res.status(200).json({
      vaultId: targetVaultId,
      accountId: targetVaultId,
      supabaseConnected: Boolean(supabase),
      source: config.source,
      isNew: !accountId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Auth check error' });
  }
}
