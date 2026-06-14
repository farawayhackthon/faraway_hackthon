const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 1000, KEY_LENGTH, 'sha512');
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  // Test with large string
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);

  return {
    encrypted: combined.toString('base64'),
    salt,
  };
}

try {
    const largeText = 'A'.repeat(5 * 1024 * 1024); // 5 MB
    const pass = crypto.randomBytes(32).toString('hex');
    console.log("Encrypting...");
    const result = encrypt(largeText, pass);
    console.log("Encrypted length:", result.encrypted.length);
} catch (e) {
    console.error("Error:", e);
}
