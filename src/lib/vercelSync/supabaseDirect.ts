import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EncryptedNoteEnvelope } from '../../types';

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

const STORAGE_KEY_URL = 'app_supabase_url';
const STORAGE_KEY_ANON = 'app_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let currentClientKey = '';

export function getClientSupabaseConfig(): SupabaseCredentials | null {
  // 1. Check user-configured custom credentials in localStorage
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem(STORAGE_KEY_URL);
    const customKey = localStorage.getItem(STORAGE_KEY_ANON);
    if (customUrl && customKey) {
      return { url: customUrl.trim(), anonKey: customKey.trim() };
    }
  }

  // 2. Check injected / build-time environment variables
  const metaEnv = (import.meta as any).env || {};
  const envUrl =
    (metaEnv.VITE_SUPABASE_URL as string) ||
    (metaEnv.SUPABASE_URL as string) ||
    (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : '') ||
    '';

  const envKey =
    (metaEnv.VITE_SUPABASE_ANON_KEY as string) ||
    (metaEnv.SUPABASE_ANON_KEY as string) ||
    (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : '') ||
    '';

  if (envUrl && envKey) {
    return { url: envUrl.trim(), anonKey: envKey.trim() };
  }

  return null;
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url && anonKey) {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
      localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_ANON);
    }
    cachedClient = null;
  }
}

export function getDirectSupabaseClient(): SupabaseClient | null {
  const config = getClientSupabaseConfig();
  if (!config) return null;

  const keyIdentifier = `${config.url}_${config.anonKey}`;
  if (cachedClient && currentClientKey === keyIdentifier) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    });
    currentClientKey = keyIdentifier;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create direct Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(customConfig?: SupabaseCredentials): Promise<{
  success: boolean;
  message: string;
  tableExists: boolean;
  notesCount?: number;
}> {
  try {
    const config = customConfig || getClientSupabaseConfig();
    if (!config || !config.url || !config.anonKey) {
      return {
        success: false,
        message: 'No Supabase URL or Anon Key configured.',
        tableExists: false,
      };
    }

    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    });

    const { count, error } = await client
      .from('notes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Connected to Supabase project, but the "notes" table has not been created yet.',
          tableExists: false,
        };
      }
      if (error.code === '42501' || error.message.includes('row-level security')) {
        return {
          success: false,
          message: 'Connected, but Row-Level Security (RLS) is blocking access. Run: ALTER TABLE notes DISABLE ROW LEVEL SECURITY;',
          tableExists: true,
        };
      }
      return {
        success: false,
        message: error.message || 'Database query error',
        tableExists: false,
      };
    }

    return {
      success: true,
      message: `Connected successfully! Found ${count ?? 0} encrypted records in "notes" table.`,
      tableExists: true,
      notesCount: count ?? 0,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to connect to Supabase.',
      tableExists: false,
    };
  }
}

export async function pushNotesDirectToSupabase(
  vaultId: string,
  envelopes: EncryptedNoteEnvelope[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = getDirectSupabaseClient();
  if (!supabase) {
    return { success: false, count: 0, error: 'Direct Supabase client not initialized' };
  }

  if (envelopes.length === 0) {
    return { success: true, count: 0 };
  }

  const rows = envelopes
    .filter((env) => env.noteId && env.ciphertext && env.iv)
    .map((env) => {
      const envelopeJson = JSON.stringify({
        ciphertext: env.ciphertext,
        iv: env.iv,
        version: env.version || 1,
      });
      return {
        id: env.noteId,
        vault_id: vaultId,
        encrypted_data: envelopeJson,
        version: env.version || 1,
        updated_at: new Date(env.updatedAt || Date.now()).toISOString(),
        deleted: Boolean(env.deleted),
      };
    });

  if (rows.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Attempt upsert on (id, vault_id)
  let { error } = await supabase.from('notes').upsert(rows, {
    onConflict: 'id,vault_id',
  });

  // 2. Fallback if primary key is only 'id'
  if (error && (error.message.includes('onConflict') || error.code === '42P10')) {
    const fallback = await supabase.from('notes').upsert(rows, {
      onConflict: 'id',
    });
    error = fallback.error;
  }

  // 3. Fallback: single item delete + insert if conflict constraint is missing
  if (error && error.code !== '42501' && !error.message.includes('row-level security')) {
    for (const r of rows) {
      await supabase.from('notes').delete().eq('id', r.id).eq('vault_id', r.vault_id);
      const ins = await supabase.from('notes').insert(r);
      if (ins.error) {
        error = ins.error;
        break;
      } else {
        error = null;
      }
    }
  }

  if (error) {
    console.error('Supabase direct push error:', error);
    return { success: false, count: 0, error: error.message || error.code };
  }

  return { success: true, count: rows.length };
}

export async function pullNotesDirectFromSupabase(
  vaultId: string,
  since: number = 0
): Promise<{ success: boolean; envelopes: EncryptedNoteEnvelope[]; serverTimestamp: number; error?: string }> {
  const supabase = getDirectSupabaseClient();
  if (!supabase) {
    return { success: false, envelopes: [], serverTimestamp: Date.now(), error: 'Direct Supabase client not initialized' };
  }

  let query = supabase
    .from('notes')
    .select('id, vault_id, encrypted_data, version, updated_at, deleted')
    .eq('vault_id', vaultId);

  if (since > 0) {
    query = query.gt('updated_at', new Date(since).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase direct pull error:', error);
    return { success: false, envelopes: [], serverTimestamp: Date.now(), error: error.message || error.code };
  }

  const envelopes: EncryptedNoteEnvelope[] = (data || []).map((row: any) => {
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

  return {
    success: true,
    envelopes,
    serverTimestamp: Date.now(),
  };
}
