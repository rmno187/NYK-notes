import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

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
  // Enable CORS
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

    const supabase = getSupabase();
    const newVaultId = targetVaultId || 'vault_' + Math.random().toString(36).substring(2, 14);

    return res.status(200).json({
      vaultId: newVaultId,
      accountId: newVaultId,
      isNew: !targetVaultId,
      supabaseConnected: Boolean(supabase),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Auth error' });
  }
}
