// Client-side Zero-Knowledge Cryptography for Vercel · Sync
// Uses standard Web Crypto API (SubtleCrypto) for AES-256-GCM, PBKDF2, HKDF, ECDH, and SHA-256

import { Note, EncryptedNoteEnvelope } from '../../types';

const PBKDF2_ITERATIONS = 100_000;
const AES_GCM_TAG_LENGTH = 128; // bits

export interface DerivedKeys {
  authKeyHex: string;     // Sent to server to authenticate the sync bucket
  authSalt: string;        // Base64 salt for key derivation
  encryptionKey: CryptoKey; // NEVER leaves client memory/device
  encryptionKeyRaw: string; // Base64 raw key for secure device pairing
}

// Convert ArrayBuffer / Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert ArrayBuffer to Hex String
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Generate random cryptographic bytes
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

// 1. Derive Auth Key and Master Encryption Key from a user passphrase or recovery phrase
export async function deriveSyncKeys(
  passphrase: string,
  existingSaltBase64?: string
): Promise<DerivedKeys> {
  const enc = new TextEncoder();
  const passphraseBytes = enc.encode(passphrase.trim());

  // Use existing salt or generate a fresh 32-byte salt
  const saltBytes = existingSaltBase64
    ? base64ToBuffer(existingSaltBase64)
    : generateRandomBytes(32);

  // Import passphrase as PBKDF2 base key
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive a 256-bit Master Secret using PBKDF2-SHA-256
  const masterSecretBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  // Import Master Secret for HKDF expansion
  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    masterSecretBits,
    { name: 'HKDF' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // A. Derive Auth Key (sent to backend for bucket authentication)
  const authKeyBits = await window.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('notes-sync-auth-v1'),
    },
    hkdfKey,
    256
  );
  const authKeyHex = bufferToHex(authKeyBits);

  // B. Derive Master Encryption Key (MEK) for AES-256-GCM (client only)
  const encryptionKeyBits = await window.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('notes-sync-content-v1'),
    },
    hkdfKey,
    256
  );

  const encryptionKey = await window.crypto.subtle.importKey(
    'raw',
    encryptionKeyBits,
    { name: 'AES-GCM', length: 256 },
    true, // extractable only for pairing
    ['encrypt', 'decrypt']
  );

  const encryptionKeyRaw = bufferToBase64(encryptionKeyBits);

  return {
    authKeyHex,
    authSalt: bufferToBase64(saltBytes),
    encryptionKey,
    encryptionKeyRaw,
  };
}

// Import an existing AES-256-GCM encryption key from raw base64 (e.g. from paired device)
export async function importRawEncryptionKey(rawBase64: string): Promise<CryptoKey> {
  const bytes = base64ToBuffer(rawBase64);
  return window.crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// 2. Encrypt Note with AES-256-GCM (Zero-Knowledge)
export async function encryptNote(
  note: Note,
  key: CryptoKey,
  version = 1
): Promise<EncryptedNoteEnvelope> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(note));
  const iv = generateRandomBytes(12); // Standard 96-bit IV for AES-GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    key,
    plaintext
  );

  return {
    noteId: note.id,
    version,
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    updatedAt: note.updatedAt || Date.now(),
    deleted: Boolean(note.deletedAt),
  };
}

// 3. Decrypt Note with AES-256-GCM
export async function decryptNote(
  envelope: EncryptedNoteEnvelope,
  key: CryptoKey
): Promise<Note | null> {
  try {
    const ciphertextBytes = base64ToBuffer(envelope.ciphertext);
    const ivBytes = base64ToBuffer(envelope.iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: AES_GCM_TAG_LENGTH,
      },
      key,
      ciphertextBytes
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    const parsed = JSON.parse(jsonString) as Note;

    // Preserve the canonical noteId and updated timestamp from envelope
    parsed.id = envelope.noteId;
    if (envelope.deleted && !parsed.deletedAt) {
      parsed.deletedAt = envelope.updatedAt;
    }

    return parsed;
  } catch (err) {
    console.error(`Failed to decrypt note ${envelope.noteId}: Authentication tag mismatch or incorrect key`, err);
    return null;
  }
}

// 4. Client-Side 12-word Recovery Phrase Generator (Deterministic wordlist)
const BIP39_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
  'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
  'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
  'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
  'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
  'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset',
  'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake',
  'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge',
  'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain',
  'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit',
  'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology',
  'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
  'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss',
  'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread',
  'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze',
  'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy',
  'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call',
  'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas',
  'canyon', 'capable', 'capital', 'captain', 'car', 'carbon', 'card', 'cargo', 'carpet', 'carry',
  'cart', 'case', 'cash', 'casino', 'castle', 'casual', 'cat', 'catalog', 'catch', 'category',
  'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling', 'celery', 'cement', 'census', 'century',
  'cereal', 'certain', 'chair', 'chalk', 'champion', 'change', 'chaos', 'chapter', 'charge', 'chase',
  'chat', 'cheap', 'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief', 'child',
  'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar', 'cinnamon', 'circle',
  'citizen', 'city', 'civil', 'claim', 'clap', 'clarify', 'claw', 'clay', 'clean', 'clerk',
  'clever', 'click', 'client', 'cliff', 'climb', 'clinic', 'clip', 'clock', 'clog', 'close',
  'cloth', 'cloud', 'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut',
  'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column', 'combine', 'come', 'comfort',
  'comic', 'common', 'company', 'concert', 'conduct', 'confirm', 'congress', 'connect', 'consider', 'control',
  'convince', 'cook', 'cool', 'copper', 'copy', 'coral', 'core', 'corn', 'correct', 'cost',
  'cotton', 'couch', 'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle',
  'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream', 'credit', 'creek',
  'crew', 'cricket', 'crime', 'crisp', 'critic', 'crop', 'cross', 'crouch', 'crowd', 'crucial',
  'cruel', 'cruise', 'crumble', 'crunch', 'crush', 'cry', 'crystal', 'cube', 'culture', 'cup',
  'cupboard', 'curious', 'current', 'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad'
];

export function generateRecoveryPhrase(wordCount = 12): string {
  const randomValues = new Uint32Array(wordCount);
  window.crypto.getRandomValues(randomValues);
  const words = Array.from(randomValues).map(
    (val) => BIP39_WORDS[val % BIP39_WORDS.length]
  );
  return words.join(' ');
}

// 5. Ephemeral ECDH Key Pair for zero-knowledge device pairing
export async function generatePairingKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const exportedPublic = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  return {
    keyPair,
    publicKeyBase64: bufferToBase64(exportedPublic),
  };
}

// Derive a temporary AES-GCM channel key between two pairing devices
export async function derivePairingChannelKey(
  privateKey: CryptoKey,
  peerPublicKeyBase64: string
): Promise<CryptoKey> {
  const peerKeyBytes = base64ToBuffer(peerPublicKeyBase64);
  const peerPublicKey = await window.crypto.subtle.importKey(
    'raw',
    peerKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  return window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt payload over ephemeral pairing channel
export async function encryptPairingPayload(payload: string, channelKey: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const iv = generateRandomBytes(12);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    enc.encode(payload)
  );
  return JSON.stringify({
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
  });
}

// Decrypt payload from ephemeral pairing channel
export async function decryptPairingPayload(encryptedJson: string, channelKey: CryptoKey): Promise<string> {
  const parsed = JSON.parse(encryptedJson);
  const iv = base64ToBuffer(parsed.iv);
  const ciphertext = base64ToBuffer(parsed.ciphertext);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    ciphertext
  );
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
