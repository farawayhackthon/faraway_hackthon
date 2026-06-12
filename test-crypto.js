const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha512');
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);

  return {
    encrypted: combined.toString('base64'),
    salt,
  };
}

function decrypt(encryptedBase64, passphrase, salt) {
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

function generatePassphrase() {
  return crypto.randomBytes(32).toString('hex');
}

const payloadUserId = 'admin-user-id';
const demoContent = 'my secret paper content';

const masterPassphrase = generatePassphrase();
const { encrypted: encryptedPayload, salt } = encrypt(demoContent, masterPassphrase);
const vaultKey = `vault-secret-key-${payloadUserId}`;
const { encrypted: encryptedKey, salt: keySalt } = encrypt(masterPassphrase, vaultKey);

const vaultKeyDecrypt = `vault-secret-key-${payloadUserId}`;
const masterPassphraseDecrypted = decrypt(encryptedKey, vaultKeyDecrypt, keySalt);
const decryptedContent = decrypt(encryptedPayload, masterPassphraseDecrypted, salt);

console.log(decryptedContent === demoContent ? 'SUCCESS' : 'FAIL');
