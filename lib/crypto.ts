import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit key from a passphrase using PBKDF2
 */
export function deriveKey(passphrase: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, 1000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns base64-encoded: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string, passphrase: string): { encrypted: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: iv (16) + authTag (16) + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return {
    encrypted: combined.toString('base64'),
    salt,
  };
}

/**
 * Decrypts AES-256-GCM ciphertext
 * Input: base64-encoded iv + authTag + ciphertext
 */
export function decrypt(encryptedBase64: string, passphrase: string, salt: string): string {
  const key = deriveKey(passphrase, salt);
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically secure random passphrase (hex)
 */
export function generatePassphrase(): string {
  return crypto.randomBytes(32).toString('hex');
}
