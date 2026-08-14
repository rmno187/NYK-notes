import { BackupData, EncryptedBackupPayload } from '../types';

// Utility functions for converting ArrayBuffers to Base64 strings
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array, keyUsage: KeyUsage[]): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsage
  );
}

/**
 * Encrypts backup data with password using AES-256-GCM
 */
export async function encryptBackup(data: BackupData, password: string): Promise<EncryptedBackupPayload> {
  if (!password) {
    throw new Error('Password is required for encrypted export.');
  }

  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(jsonString);

  // Generate random salt (16 bytes) and IV (12 bytes for AES-GCM)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt, ['encrypt']);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plaintextBuffer
  );

  return {
    version: 1,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertextBuffer),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypts encrypted backup payload using password
 */
export async function decryptBackup(payload: EncryptedBackupPayload, password: string): Promise<BackupData> {
  if (!password) {
    throw new Error('Password is required for decryption.');
  }

  try {
    const saltBuffer = new Uint8Array(base64ToBuffer(payload.salt));
    const ivBuffer = new Uint8Array(base64ToBuffer(payload.iv));
    const ciphertextBuffer = base64ToBuffer(payload.ciphertext);

    const key = await deriveKey(password, saltBuffer, ['decrypt']);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const data = JSON.parse(jsonString) as BackupData;

    if (!data.notes || !Array.isArray(data.notes)) {
      throw new Error('Invalid backup data format.');
    }

    return data;
  } catch (err: any) {
    throw new Error('Decryption failed. Incorrect password or corrupted backup file.');
  }
}
