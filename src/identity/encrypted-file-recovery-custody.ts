import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { access, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  OwnerRecoveryCustodyReceipt,
  OwnerRecoveryCustodySink,
} from '@/identity/local-owner-security-provider';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SCRYPT_COST = 2 ** 17;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAXIMUM_MEMORY = 256 * 1024 * 1024;

interface EncryptedRecoveryPackage {
  schemaVersion: 1;
  packageId: string;
  bundleId: string;
  cryptographicOwnerIdentifier: string;
  encryptionSalt: string;
  initializationVector: string;
  authenticationTag: string;
  encryptedRecoverySecret: string;
}

export interface RecoveryPassphraseProvider {
  getRecoveryPassphrase(): Promise<Buffer>;
}

export interface DecryptedRecoveryPackage {
  bundleId: string;
  cryptographicOwnerIdentifier: string;
  recoverySecret: Buffer;
}

export class EncryptedFileRecoveryCustodySink implements OwnerRecoveryCustodySink {
  private readonly packagePath: string;
  private readonly provisioned = new Map<string, string>();

  constructor(
    private readonly directory: string,
    private readonly passphraseProvider: RecoveryPassphraseProvider
  ) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Owner recovery custody directory must be absolute');
    }
    this.packagePath = path.join(directory, 'owner-recovery.package');
  }

  async storeRecoverySecret(
    bundleId: string,
    cryptographicOwnerIdentifier: string,
    recoverySecret: Readonly<Buffer>
  ): Promise<OwnerRecoveryCustodyReceipt> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (await exists(this.packagePath)) {
      throw new Error('Owner recovery package already exists');
    }

    const passphrase = await this.passphraseProvider.getRecoveryPassphrase();
    let packageWritten = false;
    try {
      validatePassphrase(passphrase);
      const recoveryPackage = await encryptRecoveryPackage(
        bundleId,
        cryptographicOwnerIdentifier,
        recoverySecret,
        passphrase
      );
      const serialized = JSON.stringify(recoveryPackage);
      const handle = await open(this.packagePath, 'wx', 0o600);
      try {
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
        packageWritten = true;
      } finally {
        await handle.close();
      }

      const verification = await decryptEncryptedRecoveryPackage(this.packagePath, passphrase);
      const verified = timingSafeEqual(Buffer.from(recoverySecret), verification.recoverySecret);
      verification.recoverySecret.fill(0);
      if (!verified) throw new Error('Owner recovery package verification failed');

      const recoveryKeyReference = createHash('sha256').update(serialized).digest('base64url');
      this.provisioned.set(recoveryKeyReference, this.packagePath);
      return { confirmed: true, recoveryKeyReference };
    } catch (error) {
      if (packageWritten) {
        try {
          await unlink(this.packagePath);
        } catch {
          // Preserve the original custody failure.
        }
      }
      throw error;
    } finally {
      passphrase.fill(0);
    }
  }

  async revokeRecoveryCustody(recoveryKeyReference: string): Promise<void> {
    const packagePath = this.provisioned.get(recoveryKeyReference);
    if (!packagePath) return;
    await Promise.allSettled([unlink(packagePath)]);
    this.provisioned.delete(recoveryKeyReference);
  }
}

export async function decryptEncryptedRecoveryPackage(
  packagePath: string,
  passphrase: Readonly<Buffer>
): Promise<DecryptedRecoveryPackage> {
  validatePassphrase(passphrase);
  const recoveryPackage = JSON.parse(
    await readFile(packagePath, 'utf8')
  ) as EncryptedRecoveryPackage;
  if (recoveryPackage.schemaVersion !== 1) {
    throw new Error('Owner recovery package schema is unsupported');
  }

  const salt = decode(recoveryPackage.encryptionSalt);
  const iv = decode(recoveryPackage.initializationVector);
  const tag = decode(recoveryPackage.authenticationTag);
  const encrypted = decode(recoveryPackage.encryptedRecoverySecret);
  const key = await deriveKey(passphrase, salt);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(recoveryPackage.packageId, 'utf8'));
    decipher.setAuthTag(tag);
    return {
      bundleId: recoveryPackage.bundleId,
      cryptographicOwnerIdentifier: recoveryPackage.cryptographicOwnerIdentifier,
      recoverySecret: Buffer.concat([decipher.update(encrypted), decipher.final()]),
    };
  } finally {
    key.fill(0);
  }
}

async function encryptRecoveryPackage(
  bundleId: string,
  cryptographicOwnerIdentifier: string,
  recoverySecret: Readonly<Buffer>,
  passphrase: Readonly<Buffer>
): Promise<EncryptedRecoveryPackage> {
  const packageId = randomUUID();
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(packageId, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(Buffer.from(recoverySecret)), cipher.final()]);
    return {
      schemaVersion: 1,
      packageId,
      bundleId,
      cryptographicOwnerIdentifier,
      encryptionSalt: salt.toString('base64url'),
      initializationVector: iv.toString('base64url'),
      authenticationTag: cipher.getAuthTag().toString('base64url'),
      encryptedRecoverySecret: encrypted.toString('base64url'),
    };
  } finally {
    key.fill(0);
  }
}

function deriveKey(passphrase: Readonly<Buffer>, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase,
      salt,
      KEY_BYTES,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAXIMUM_MEMORY,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      }
    );
  });
}

function validatePassphrase(passphrase: Readonly<Buffer>): void {
  if (passphrase.length < 15 || passphrase.length > 1024) {
    throw new Error('Owner recovery passphrase length is outside policy');
  }
}

function decode(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.toString('base64url') !== value) {
    throw new Error('Owner recovery package contains invalid encoding');
  }
  return decoded;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
