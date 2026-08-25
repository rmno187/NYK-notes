import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Untrusted in-memory & fallback persistent storage layer for Vercel Sync
// The backend NEVER receives or knows the Master Encryption Key or plaintext notes.
interface EncryptedNoteRecord {
  noteId: string;
  version: number;
  ciphertext: string;
  iv: string;
  updatedAt: number;
  deleted: boolean;
}

interface SyncAccount {
  accountId: string;
  authKeyHash: string; // SHA-256 hash of client's authKeyHex
  authSalt: string;
  createdAt: number;
  devices: { deviceId: string; lastSeen: number }[];
  notes: Map<string, EncryptedNoteRecord>;
}

// Temporary pairing ticket for device-to-device ECDH key exchange
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

// Simple hash helper
async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', provider: 'vercel-sync' });
  });

  // 2. Zero-Knowledge Sync Auth (Register or Login)
  app.post('/api/sync/auth', async (req, res) => {
    try {
      const { authKeyHex, authSalt, accountId } = req.body;
      if (!authKeyHex || !authSalt) {
        return res.status(400).json({ error: 'authKeyHex and authSalt are required' });
      }

      const authKeyHash = await sha256(authKeyHex);

      // If accountId provided, verify it exists and matches
      if (accountId && syncAccounts.has(accountId)) {
        const acc = syncAccounts.get(accountId)!;
        if (acc.authKeyHash !== authKeyHash) {
          return res.status(401).json({ error: 'Invalid authentication credentials' });
        }
        return res.json({ accountId: acc.accountId, isNew: false });
      }

      // Check if any existing account has this authKeyHash
      for (const [id, acc] of syncAccounts.entries()) {
        if (acc.authKeyHash === authKeyHash) {
          return res.json({ accountId: id, isNew: false });
        }
      }

      // Create new sync bucket
      const newAccountId = accountId || 'acc_' + Math.random().toString(36).substring(2, 14);
      const newAccount: SyncAccount = {
        accountId: newAccountId,
        authKeyHash,
        authSalt,
        createdAt: Date.now(),
        devices: [],
        notes: new Map(),
      };
      syncAccounts.set(newAccountId, newAccount);

      return res.json({ accountId: newAccountId, isNew: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Authentication error' });
    }
  });

  // Auth Middleware for Sync routes
  const requireSyncAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const authKeyHex = authHeader.replace('Bearer ', '').trim();
    const authKeyHash = await sha256(authKeyHex);

    const accountId = (req.body?.accountId || req.query?.accountId) as string;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId required' });
    }

    const account = syncAccounts.get(accountId);
    if (!account || account.authKeyHash !== authKeyHash) {
      return res.status(401).json({ error: 'Unauthorized sync access' });
    }

    (req as any).syncAccount = account;
    next();
  };

  // 3. Push Encrypted Changes
  app.post('/api/sync/push', requireSyncAuth, (req, res) => {
    try {
      const account: SyncAccount = (req as any).syncAccount;
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

      for (const change of changes) {
        if (!change.noteId || !change.ciphertext || !change.iv) continue;

        const existing = account.notes.get(change.noteId);
        if (!existing || change.updatedAt >= existing.updatedAt) {
          account.notes.set(change.noteId, {
            noteId: change.noteId,
            version: (existing?.version || 0) + 1,
            ciphertext: change.ciphertext,
            iv: change.iv,
            updatedAt: change.updatedAt || Date.now(),
            deleted: Boolean(change.deleted),
          });
        }
      }

      res.json({ success: true, count: changes.length, serverTimestamp: Date.now() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Push failed' });
    }
  });

  // 4. Pull Encrypted Changes
  app.get('/api/sync/pull', requireSyncAuth, (req, res) => {
    try {
      const account: SyncAccount = (req as any).syncAccount;
      const since = Number(req.query.since || 0);

      const modifiedNotes: EncryptedNoteRecord[] = [];
      for (const record of account.notes.values()) {
        if (record.updatedAt > since) {
          modifiedNotes.push(record);
        }
      }

      res.json({
        notes: modifiedNotes,
        serverTimestamp: Date.now(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Pull failed' });
    }
  });

  // 5. Device Pairing Relay API (Ephemeral ECDH exchange)
  // Device A creates a pairing session
  app.post('/api/sync/pair/init', (req, res) => {
    const { initiatorPublicKey } = req.body;
    if (!initiatorPublicKey) {
      return res.status(400).json({ error: 'initiatorPublicKey is required' });
    }

    // 6-digit easy pairing code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pairingSessions.set(code, {
      code,
      initiatorPublicKey,
      createdAt: Date.now(),
      claimed: false,
    });

    // Auto clean after 5 minutes
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
