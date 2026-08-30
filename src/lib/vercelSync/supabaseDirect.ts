import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EncryptedNoteEnvelope } from '../../types';

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

export interface SchemaInspection {
  tableExists: boolean;
  hasId: boolean;
  hasVaultId: boolean;
  hasEncryptedData: boolean;
  columnsDetected: string[];
  notesCount: number;
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

export async function inspectTableSchema(client: SupabaseClient): Promise<SchemaInspection> {
  const result: SchemaInspection = {
    tableExists: false,
    hasId: false,
    hasVaultId: false,
    hasEncryptedData: false,
    columnsDetected: [],
    notesCount: 0,
  };

  try {
    // 1. Check if table exists & count
    const { count, error: countErr } = await client
      .from('notes')
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      return result;
    }

    result.tableExists = true;
    result.notesCount = count ?? 0;

    // 2. Fetch a single row to inspect columns if any exist
    const { data: sampleRows } = await client.from('notes').select('*').limit(1);
    if (sampleRows && sampleRows.length > 0) {
      const keys = Object.keys(sampleRows[0]);
      result.columnsDetected = keys;
      result.hasId = keys.includes('id');
      result.hasVaultId = keys.includes('vault_id');
      result.hasEncryptedData = keys.includes('encrypted_data');
      return result;
    }

    // 3. If table is empty, test columns by doing a dummy single select
    const testId = await client.from('notes').select('id').limit(0);
    result.hasId = !testId.error;

    const testVault = await client.from('notes').select('vault_id').limit(0);
    result.hasVaultId = !testVault.error;

    const testEnc = await client.from('notes').select('encrypted_data').limit(0);
    result.hasEncryptedData = !testEnc.error;

    const detected: string[] = [];
    if (result.hasId) detected.push('id');
    if (result.hasVaultId) detected.push('vault_id');
    if (result.hasEncryptedData) detected.push('encrypted_data');
    result.columnsDetected = detected;

    return result;
  } catch {
    return result;
  }
}

export async function testSupabaseConnection(customConfig?: SupabaseCredentials): Promise<{
  success: boolean;
  message: string;
  tableExists: boolean;
  notesCount?: number;
  schemaDetails?: SchemaInspection;
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

    const inspection = await inspectTableSchema(client);

    if (!inspection.tableExists) {
      return {
        success: false,
        message: 'Could not connect to the "notes" table. Please create it using the SQL query below.',
        tableExists: false,
        schemaDetails: inspection,
      };
    }

    if (!inspection.hasId || !inspection.hasVaultId || !inspection.hasEncryptedData) {
      const missing: string[] = [];
      if (!inspection.hasId) missing.push("'id'");
      if (!inspection.hasVaultId) missing.push("'vault_id'");
      if (!inspection.hasEncryptedData) missing.push("'encrypted_data'");

      return {
        success: false,
        message: `The 'notes' table is missing required column(s): ${missing.join(', ')}. Run the schema SQL script in your Supabase SQL Editor.`,
        tableExists: true,
        schemaDetails: inspection,
      };
    }

    return {
      success: true,
      message: `Connected successfully! Table schema verified with all required columns. Found ${inspection.notesCount} encrypted records.`,
      tableExists: true,
      notesCount: inspection.notesCount,
      schemaDetails: inspection,
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
  if (error && error.code !== '42501' && !error.message.includes('row-level security') && !error.message.includes('column')) {
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
    let userMsg = error.message || error.code;
    if (error.message?.includes('column') || error.message?.includes('schema cache')) {
      userMsg = `${error.message}. The 'notes' table in your Supabase database doesn't have the expected schema. Run the CREATE TABLE script in your Supabase SQL Editor.`;
    }
    return { success: false, count: 0, error: userMsg };
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

  // Query table
  let query = supabase
    .from('notes')
    .select('*')
    .eq('vault_id', vaultId);

  if (since > 0) {
    query = query.gt('updated_at', new Date(since).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase direct pull error:', error);
    let userMsg = error.message || error.code;
    if (error.message?.includes('column') || error.message?.includes('schema cache')) {
      userMsg = `${error.message}. The 'notes' table is missing expected columns. Please update your table schema in Supabase.`;
    }
    return { success: false, envelopes: [], serverTimestamp: Date.now(), error: userMsg };
  }

  const envelopes: EncryptedNoteEnvelope[] = (data || [])
    .filter((row: any) => row.id && (row.encrypted_data || row.ciphertext))
    .map((row: any) => {
      let ciphertext = '';
      let iv = '';
      const rawEnc = row.encrypted_data || row.ciphertext || '';
      try {
        const parsed = JSON.parse(rawEnc);
        ciphertext = parsed.ciphertext || rawEnc;
        iv = parsed.iv || row.iv || '';
      } catch {
        ciphertext = rawEnc;
        iv = row.iv || '';
      }

      return {
        noteId: row.id,
        vaultId: row.vault_id || vaultId,
        version: Number(row.version || 1),
        ciphertext,
        iv,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        deleted: Boolean(row.deleted),
      };
    });

  return {
    success: true,
    envelopes,
    serverTimestamp: Date.now(),
  };
}
