import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);

// Supabase & Zero-Knowledge E2EE Server Layer
// The backend & Supabase database NEVER receive plaintext note content or master encryption keys.
// Database table: 'notes' (id, vault_id, encrypted_data, version, updated_at, deleted)

interface EncryptedNoteRecord {
  noteId: string;
  vaultId?: string;
  version: number;
  ciphertext: string;
  iv: string;
  updatedAt: number;
  deleted: boolean;
}

interface SyncAccount {
  vaultId: string;
  accountId: string;
  authKeyHash: string; // SHA-256 hash of client's authKeyHex
  authSalt: string;
  createdAt: number;
  devices: { deviceId: string; lastSeen: number }[];
  notes: Map<string, EncryptedNoteRecord>;
}

// Temporary pairing session for device-to-device ECDH key exchange
interface PairingSession {
  code: string;
  initiatorPublicKey: string;
  encryptedCredentials?: string;
  responderPublicKey?: string;
  createdAt: number;
  claimed: boolean;
}

const syncAccounts = new Map<string, SyncAccount>();
const pairingSessions = new Map<string, PairingSession>();

// Synchronous SHA-256 hash helper
function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Local fallback persistence directory
const DATA_DIR = path.join(process.cwd(), '.sync_data');
const STORE_FILE = path.join(DATA_DIR, 'sync_accounts.json');

function loadPersistedStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const item of data) {
          const notesMap = new Map<string, EncryptedNoteRecord>();
          if (item.notes && Array.isArray(item.notes)) {
            for (const n of item.notes) {
              notesMap.set(n.noteId, n);
            }
          }
          const vaultId = item.vaultId || item.accountId;
          syncAccounts.set(vaultId, {
            vaultId,
            accountId: vaultId,
            authKeyHash: item.authKeyHash,
            authSalt: item.authSalt || '',
            createdAt: item.createdAt || Date.now(),
            devices: item.devices || [],
            notes: notesMap,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error loading sync store:', err);
  }
}

function savePersistedStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serializable = Array.from(syncAccounts.values()).map((acc) => ({
      vaultId: acc.vaultId,
      accountId: acc.accountId,
      authKeyHash: acc.authKeyHash,
      authSalt: acc.authSalt,
      createdAt: acc.createdAt,
      devices: acc.devices,
      notes: Array.from(acc.notes.values()),
    }));
    fs.writeFileSync(STORE_FILE, JSON.stringify(serializable, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sync store:', err);
  }
}

loadPersistedStore();

// Lazy Supabase client factory
let supabaseClient: SupabaseClient | null = null;
let supabaseInitialized = false;

function getSupabase(): SupabaseClient | null {
  if (supabaseInitialized) return supabaseClient;

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
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      console.log('Connected to Supabase persistence at:', url);
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  } else {
    console.log('Supabase environment variables not detected. Operating in zero-knowledge local storage fallback mode.');
  }

  supabaseInitialized = true;
  return supabaseClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // 1. Health check & status
  app.get('/api/health', (req, res) => {
    const sb = getSupabase();
    res.json({
      status: 'ok',
      provider: 'vercel-sync-supabase',
      supabaseConfigured: Boolean(sb),
      localVaultsCount: syncAccounts.size,
    });
  });

  // 2. Zero-Knowledge Vault Auth (Register or Verify Vault Access)
  app.post('/api/sync/auth', async (req, res) => {
    try {
      const { authKeyHex, authSalt, vaultId, accountId } = req.body;
      const targetVaultId = vaultId || accountId;

      if (!authKeyHex || !authSalt) {
        return res.status(400).json({ error: 'authKeyHex and authSalt are required' });
      }

      const authKeyHash = sha256(authKeyHex);

      // Verify existing in-memory/local store
      if (targetVaultId && syncAccounts.has(targetVaultId)) {
        const acc = syncAccounts.get(targetVaultId)!;
        if (acc.authKeyHash !== authKeyHash) {
          return res.status(401).json({ error: 'Invalid vault authentication credentials' });
        }
        return res.json({
          vaultId: acc.vaultId,
          accountId: acc.vaultId,
          isNew: false,
          supabaseConnected: Boolean(getSupabase()),
        });
      }

      // Check if any existing vault matches this authKeyHash
      for (const [id, acc] of syncAccounts.entries()) {
        if (acc.authKeyHash === authKeyHash) {
          return res.json({
            vaultId: id,
            accountId: id,
            isNew: false,
            supabaseConnected: Boolean(getSupabase()),
          });
        }
      }

      // Create new vault
      const newVaultId = targetVaultId || 'vault_' + Math.random().toString(36).substring(2, 14);
      const newAccount: SyncAccount = {
        vaultId: newVaultId,
        accountId: newVaultId,
        authKeyHash,
        authSalt,
        createdAt: Date.now(),
        devices: [],
        notes: new Map(),
      };
      syncAccounts.set(newVaultId, newAccount);
      savePersistedStore();

      return res.json({
        vaultId: newVaultId,
        accountId: newVaultId,
        isNew: true,
        supabaseConnected: Boolean(getSupabase()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Authentication error' });
    }
  });

  // Auth Middleware for Sync routes
  const requireSyncAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const authKeyHex = authHeader.replace('Bearer ', '').trim();
    const authKeyHash = sha256(authKeyHex);

    const vaultId = ((req.body?.vaultId || req.body?.accountId || req.query?.vaultId || req.query?.accountId) as string)?.trim();
    if (!vaultId) {
      return res.status(400).json({ error: 'vaultId required' });
    }

    let account = syncAccounts.get(vaultId);
    if (!account) {
      // Auto-register vault with authKeyHash
      account = {
        vaultId,
        accountId: vaultId,
        authKeyHash,
        authSalt: '',
        createdAt: Date.now(),
        devices: [],
        notes: new Map(),
      };
      syncAccounts.set(vaultId, account);
      savePersistedStore();
    } else if (account.authKeyHash !== authKeyHash) {
      return res.status(401).json({ error: 'Unauthorized vault access: Key mismatch' });
    }

    (req as any).syncAccount = account;
    (req as any).vaultId = vaultId;
    next();
  };

  // 3. Push Encrypted Changes to Supabase (and local store)
  app.post('/api/sync/push', requireSyncAuth, async (req, res) => {
    try {
      const account: SyncAccount = (req as any).syncAccount;
      const vaultId: string = (req as any).vaultId;
      const { changes, deviceId } = req.body;

      if (!Array.isArray(changes)) {
        return res.status(400).json({ error: 'changes must be an array' });
      }

      // Update device last seen
      if (deviceId) {
        const dev = account.devices.find((d) => d.deviceId === deviceId);
        if (dev) {
          dev.lastSeen = Date.now();
        } else {
          account.devices.push({ deviceId, lastSeen: Date.now() });
        }
      }

      // Update local storage backup
      for (const change of changes) {
        if (!change.noteId || !change.ciphertext || !change.iv) continue;

        const existing = account.notes.get(change.noteId);
        if (!existing || change.updatedAt >= existing.updatedAt) {
          account.notes.set(change.noteId, {
            noteId: change.noteId,
            vaultId,
            version: (change.version || existing?.version || 0) + 1,
            ciphertext: change.ciphertext,
            iv: change.iv,
            updatedAt: change.updatedAt || Date.now(),
            deleted: Boolean(change.deleted),
          });
        }
      }
      savePersistedStore();

      // Persist to Supabase if configured
      const supabase = getSupabase();
      if (supabase && changes.length > 0) {
        const supabaseRows = changes
          .filter((c) => c.noteId && c.ciphertext && c.iv)
          .map((c) => {
            const envelopeJson = JSON.stringify({
              ciphertext: c.ciphertext,
              iv: c.iv,
              version: c.version || 1,
            });
            return {
              id: c.noteId,
              vault_id: vaultId,
              encrypted_data: envelopeJson,
              version: c.version || 1,
              updated_at: new Date(c.updatedAt || Date.now()).toISOString(),
              deleted: Boolean(c.deleted),
            };
          });

        if (supabaseRows.length > 0) {
          // Attempt upsert into 'notes' table
          const { error } = await supabase.from('notes').upsert(supabaseRows, {
            onConflict: 'id,vault_id',
          });

          if (error) {
            // Fallback for schemas with 'id' as singular primary key
            const { error: fallbackError } = await supabase
              .from('notes')
              .upsert(supabaseRows, { onConflict: 'id' });

            if (fallbackError) {
              console.warn('Supabase upsert warning:', fallbackError.message);
            }
          }
        }
      }

      res.json({
        success: true,
        count: changes.length,
        serverTimestamp: Date.now(),
        persistedToSupabase: Boolean(supabase),
      });
    } catch (err: any) {
      console.error('Error in /api/sync/push:', err);
      res.status(500).json({ error: err.message || 'Push failed' });
    }
  });

  // 4. Pull Encrypted Changes from Supabase (and local store)
  app.get('/api/sync/pull', requireSyncAuth, async (req, res) => {
    try {
      const account: SyncAccount = (req as any).syncAccount;
      const vaultId: string = (req as any).vaultId;
      const since = Number(req.query.since || 0);

      const supabase = getSupabase();
      if (supabase) {
        try {
          let query = supabase
            .from('notes')
            .select('id, vault_id, encrypted_data, version, updated_at, deleted')
            .eq('vault_id', vaultId);

          if (since > 0) {
            const sinceIso = new Date(since).toISOString();
            query = query.gt('updated_at', sinceIso);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const remoteNotes: EncryptedNoteRecord[] = data.map((row: any) => {
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

            return res.json({
              notes: remoteNotes,
              serverTimestamp: Date.now(),
              source: 'supabase',
            });
          } else if (error) {
            console.warn('Supabase pull warning, using fallback store:', error.message);
          }
        } catch (sbErr) {
          console.warn('Supabase pull error, falling back:', sbErr);
        }
      }

      // Local fallback store query
      const modifiedNotes: EncryptedNoteRecord[] = [];
      for (const record of account.notes.values()) {
        if (record.updatedAt > since) {
          modifiedNotes.push(record);
        }
      }

      res.json({
        notes: modifiedNotes,
        serverTimestamp: Date.now(),
        source: 'local_store',
      });
    } catch (err: any) {
      console.error('Error in /api/sync/pull:', err);
      res.status(500).json({ error: err.message || 'Pull failed' });
    }
  });

  // 5. Device Pairing Relay API (Ephemeral ECDH key exchange)
  // Device A creates a pairing session
  app.post('/api/sync/pair/init', (req, res) => {
    const { initiatorPublicKey } = req.body;
    if (!initiatorPublicKey) {
      return res.status(400).json({ error: 'initiatorPublicKey is required' });
    }

    // 6-digit pairing code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pairingSessions.set(code, {
      code,
      initiatorPublicKey,
      createdAt: Date.now(),
      claimed: false,
    });

    // Auto cleanup after 5 minutes
    setTimeout(() => pairingSessions.delete(code), 5 * 60 * 1000);

    res.json({ code });
  });

  // Device B connects with code and sends its public key
  app.post('/api/sync/pair/connect', (req, res) => {
    const { code, responderPublicKey } = req.body;
    const session = pairingSessions.get(code);
    if (!session) {
      return res.status(404).json({ error: 'Pairing code expired or invalid' });
    }

    session.responderPublicKey = responderPublicKey;
    res.json({ initiatorPublicKey: session.initiatorPublicKey });
  });

  // Device A polls for responder, then sends encrypted credentials
  app.post('/api/sync/pair/transfer', (req, res) => {
    const { code, encryptedCredentials } = req.body;
    const session = pairingSessions.get(code);
    if (!session) {
      return res.status(404).json({ error: 'Pairing code expired or invalid' });
    }

    session.encryptedCredentials = encryptedCredentials;
    res.json({ success: true });
  });

  // Device B polls and retrieves encrypted credentials
  app.get('/api/sync/pair/poll', (req, res) => {
    const code = req.query.code as string;
    const session = pairingSessions.get(code);
    if (!session) {
      return res.status(404).json({ error: 'Pairing code expired or invalid' });
    }

    res.json({
      responderPublicKey: session.responderPublicKey,
      encryptedCredentials: session.encryptedCredentials,
    });
  });

  // 6. Local Git Status check
  app.post('/api/git/status', async (req, res) => {
    try {
      const { repoPath } = req.body;
      const targetDir = repoPath ? path.resolve(repoPath) : process.cwd();
      if (!fs.existsSync(targetDir)) {
        return res.status(404).json({ error: `Directory not found: ${targetDir}` });
      }
      if (!fs.existsSync(path.join(targetDir, '.git'))) {
        return res.status(400).json({ error: `Not a git repository: ${targetDir}` });
      }

      const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: targetDir });
      const currentBranch = branchOut.trim() || 'main';

      const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: targetDir });
      const changedFiles = statusOut
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      let remoteUrl = '';
      try {
        const { stdout: remoteOut } = await execAsync('git remote get-url origin', { cwd: targetDir });
        remoteUrl = remoteOut.trim();
      } catch {
        // remote may not be configured
      }

      res.json({
        available: true,
        repoPath: targetDir,
        branch: currentBranch,
        changedFiles,
        hasChanges: changedFiles.length > 0,
        remoteUrl,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to inspect git repo' });
    }
  });

  // 7. Local Git Publish (git add, git status, git commit, git push)
  app.post('/api/git/publish', async (req, res) => {
    try {
      const { repoPath, commitMessage, branch = 'main', files = '.' } = req.body;
      const targetDir = repoPath ? path.resolve(repoPath) : process.cwd();

      if (!fs.existsSync(targetDir)) {
        return res.status(404).json({ error: `Directory not found: ${targetDir}` });
      }
      if (!fs.existsSync(path.join(targetDir, '.git'))) {
        return res.status(400).json({
          error: `Target path is not a git repository: ${targetDir}. Please specify your blog repo path.`,
        });
      }

      const message = (commitMessage || 'Publish blog post').replace(/"/g, '\\"');
      const logs: string[] = [];

      // 1. git add
      logs.push(`$ git add ${files}`);
      const addRes = await execAsync(`git add ${files}`, { cwd: targetDir });
      if (addRes.stdout) logs.push(addRes.stdout.trim());
      if (addRes.stderr) logs.push(addRes.stderr.trim());

      // 2. git status
      logs.push(`$ git status --porcelain`);
      const statusRes = await execAsync('git status --porcelain', { cwd: targetDir });
      const stagedSummary = statusRes.stdout.trim();
      if (stagedSummary) {
        logs.push(stagedSummary);
      }

      // Check if anything to commit
      let committed = false;
      try {
        logs.push(`$ git commit -m "${message}"`);
        const commitRes = await execAsync(`git commit -m "${message}"`, { cwd: targetDir });
        if (commitRes.stdout) logs.push(commitRes.stdout.trim());
        if (commitRes.stderr) logs.push(commitRes.stderr.trim());
        committed = true;
      } catch (commitErr: any) {
        if (commitErr.stdout && commitErr.stdout.includes('nothing to commit')) {
          logs.push('Nothing to commit (working tree clean).');
        } else {
          logs.push(`Commit info: ${commitErr.message}`);
        }
      }

      // 3. git push
      logs.push(`$ git push origin ${branch}`);
      let pushed = false;
      try {
        const pushRes = await execAsync(`git push origin ${branch}`, { cwd: targetDir });
        if (pushRes.stdout) logs.push(pushRes.stdout.trim());
        if (pushRes.stderr) logs.push(pushRes.stderr.trim());
        pushed = true;
      } catch (pushErr: any) {
        logs.push(`Push failed: ${pushErr.stderr || pushErr.message}`);
        return res.status(500).json({
          success: false,
          logs,
          error: `git push failed: ${pushErr.stderr || pushErr.message}`,
        });
      }

      // 4. rev-parse commit SHA
      let commitSha = '';
      try {
        const { stdout: revOut } = await execAsync('git rev-parse HEAD', { cwd: targetDir });
        commitSha = revOut.trim();
      } catch {
        // ignore
      }

      res.json({
        success: true,
        committed,
        pushed,
        commitSha,
        logs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Git publish execution failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
