# Security Architecture & Threat Model: Vercel · Sync

## Overview
**Vercel · Sync** provides end-to-end encrypted (E2EE) synchronisation across multiple trusted devices.
The guiding security axiom:
> **The device owns the keys. The server only stores authenticated ciphertexts.**

---

## 1. Cryptographic Design

### Zero-Knowledge Key Derivation
1. **Passphrase / Recovery Phrase**: User provides or is generated a 12-word mnemonic or high-entropy passphrase.
2. **PBKDF2-SHA256 (600,000 rounds)** + unique 32-byte cryptographic salt $\rightarrow$ **Master Secret (256-bit)**.
3. **HKDF-SHA256 Expansion**:
   - `HKDF(MasterSecret, info="notes-sync-auth-v1")` $\rightarrow$ **Auth Key (256-bit)** (Used to sign in and prove account ownership to the Vercel API).
   - `HKDF(MasterSecret, info="notes-sync-content-v1")` $\rightarrow$ **Master Encryption Key (MEK, 256-bit)** (Held only in local client storage/memory; NEVER sent to any server).

### Authenticated Note Encryption (AES-256-GCM)
- Every note is JSON-serialized (`Note` structure with all metadata and content) and encrypted with **AES-256-GCM** using the MEK.
- Each encryption operation generates a cryptographically secure, random 96-bit (12-byte) Initialization Vector (IV).
- The 128-bit authentication tag is authenticated. Any ciphertext tampering causes decryption to fail instantly, preventing corrupted or injected notes.

### Device Pairing (Zero-Knowledge Exchange)
- Device A generates an ephemeral ECDH (P-256) key pair and displays a pairing QR / code.
- Device B generates its own ECDH key pair and exchanges public keys over a temporary server relay channel.
- Both derive a shared ephemeral AES-GCM key to securely transmit the Master Encryption Key from Device A to Device B without the server ever obtaining plaintext keys.

---

## 2. Threat Model

### Protected Against (In Scope)
* **Compromised Backend / Cloud Database**: A compromised Vercel database, hacked storage layer, or rogue database administrator cannot read note titles, contents, tags, dates, or author metadata. All content is authenticated ciphertext.
* **Man-in-the-Middle (MitM) / Network Interception**: Even if TLS were terminated or intercepted, the payloads remain fully encrypted end-to-end with AES-256-GCM.
* **Ciphertext Tampering / Bit-Flipping**: AES-GCM's authentication tag prevents malicious payload alteration or forged notes.
* **Cross-User Data Isolation**: Sync accounts are authenticated using Auth proofs derived independently from the Master Secret; one user cannot push or pull another user's encrypted blobs.

### Not Protected Against (Out of Scope / Inherent Client Limits)
* **Malware / Keyloggers on User Device**: An attacker who compromises the operating system or browser memory on an active client device can inspect notes or intercept input.
* **Physical Device Theft**: If a physical device is stolen while unlocked or without disk/OS encryption, local client storage can be inspected.
* **Lost Recovery Key & All Devices**: If a user loses all trusted devices and their recovery phrase, data cannot be recovered by the server (by design).
