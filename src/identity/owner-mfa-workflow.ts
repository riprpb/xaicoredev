import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OwnerCredentialRecord } from '@/identity/owner-credential-workflow';
import { verifyLocalPassword } from '@/identity/local-credentials';
import {
  createTotpProvisioningUri,
  decodeBase32,
  encodeBase32,
  generateTotpSecret,
  verifyTotp,
} from '@/identity/totp';

const MFA_KDF = Object.freeze({ cost: 2 ** 17, blockSize: 8, parallelization: 1 });
const MFA_MAXIMUM_MEMORY = 256 * 1024 * 1024;

export interface OwnerMfaWorkflowIO {
  readLine(prompt: string): Promise<string>;
  readSecret(prompt: string): Promise<Buffer>;
  confirm(prompt: string): Promise<boolean>;
  write(message: string): void;
}

export interface EncryptedOwnerTotpFactor {
  schemaVersion: 1;
  factorId: string;
  subjectId: string;
  factorType: 'totp';
  algorithm: 'aes-256-gcm';
  kdf: 'scrypt';
  kdfSalt: string;
  initializationVector: string;
  authenticationTag: string;
  encryptedSecret: string;
  enrolledAt: string;
  verifiedAt: string;
}

export interface OwnerMfaEnrollmentOptions {
  credentialPath: string;
  privateDirectory: string;
  accountLabel: string;
}

export async function enrollOwnerTotp(
  options: OwnerMfaEnrollmentOptions,
  io: OwnerMfaWorkflowIO,
  now: () => Date = () => new Date()
): Promise<string> {
  validateOptions(options);
  const credential = await loadCredential(options.credentialPath);
  if (!(await io.confirm('Enroll a create-once TOTP factor for the Owner?'))) {
    throw new Error('Owner MFA enrollment was not confirmed');
  }
  const password = await io.readSecret('Owner login password: ');
  try {
    const verification = await verifyLocalPassword(
      password.toString('utf8'),
      credential.passwordHash
    );
    if (!verification.valid) throw new Error('Owner credential verification failed');

    const secret = generateTotpSecret();
    io.write('Sensitive TOTP enrollment material follows. Do not copy it into chat or logs.');
    io.write(createTotpProvisioningUri(secret, options.accountLabel));
    io.write(`Manual TOTP secret: ${secret}`);
    const code = (await io.readLine('Current six-digit authenticator code: ')).trim();
    const verifiedAt = now();
    if (!verifyTotp(secret, code, verifiedAt)) {
      throw new Error('Owner TOTP verification failed');
    }

    const factorId = randomUUID();
    const encrypted = await encryptSecret(
      decodeBase32(secret),
      password,
      `${credential.subjectId}:${factorId}`
    );
    const record: EncryptedOwnerTotpFactor = {
      schemaVersion: 1,
      factorId,
      subjectId: credential.subjectId,
      factorType: 'totp',
      algorithm: 'aes-256-gcm',
      kdf: 'scrypt',
      ...encrypted,
      enrolledAt: verifiedAt.toISOString(),
      verifiedAt: verifiedAt.toISOString(),
    };
    await mkdir(options.privateDirectory, { recursive: true, mode: 0o700 });
    const factorPath = path.join(options.privateDirectory, 'owner-local-totp.json');
    const handle = await open(factorPath, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(record), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    io.write('Owner TOTP factor enrolled and encrypted locally.');
    return factorPath;
  } finally {
    password.fill(0);
  }
}

export async function verifyOwnerTotpFactor(
  credentialPath: string,
  factorPath: string,
  password: Readonly<Buffer>,
  code: string,
  at: Date = new Date()
): Promise<boolean> {
  const credential = await loadCredential(credentialPath);
  const passwordVerification = await verifyLocalPassword(
    password.toString('utf8'),
    credential.passwordHash
  );
  if (!passwordVerification.valid) return false;
  const factor = JSON.parse(await readFile(factorPath, 'utf8')) as EncryptedOwnerTotpFactor;
  if (
    factor.schemaVersion !== 1 ||
    factor.factorType !== 'totp' ||
    factor.subjectId !== credential.subjectId
  ) {
    return false;
  }
  let secret: Buffer;
  try {
    secret = await decryptSecret(factor, password, `${credential.subjectId}:${factor.factorId}`);
  } catch {
    return false;
  }
  try {
    return verifyTotp(encodeBase32(secret), code, at);
  } finally {
    secret.fill(0);
  }
}

async function encryptSecret(secret: Buffer, password: Readonly<Buffer>, aad: string) {
  const kdfSalt = randomBytes(16);
  const key = await deriveMfaKey(password, kdfSalt);
  const initializationVector = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, initializationVector);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const encryptedSecret = Buffer.concat([cipher.update(secret), cipher.final()]);
    return {
      kdfSalt: kdfSalt.toString('base64url'),
      initializationVector: initializationVector.toString('base64url'),
      authenticationTag: cipher.getAuthTag().toString('base64url'),
      encryptedSecret: encryptedSecret.toString('base64url'),
    };
  } finally {
    key.fill(0);
    secret.fill(0);
  }
}

async function decryptSecret(
  factor: EncryptedOwnerTotpFactor,
  password: Readonly<Buffer>,
  aad: string
): Promise<Buffer> {
  const key = await deriveMfaKey(password, Buffer.from(factor.kdfSalt, 'base64url'));
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(factor.initializationVector, 'base64url')
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(factor.authenticationTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(factor.encryptedSecret, 'base64url')),
      decipher.final(),
    ]);
  } finally {
    key.fill(0);
  }
}

function deriveMfaKey(password: Readonly<Buffer>, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      {
        N: MFA_KDF.cost,
        r: MFA_KDF.blockSize,
        p: MFA_KDF.parallelization,
        maxmem: MFA_MAXIMUM_MEMORY,
      },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

async function loadCredential(credentialPath: string): Promise<OwnerCredentialRecord> {
  const credential = JSON.parse(await readFile(credentialPath, 'utf8')) as OwnerCredentialRecord;
  if (
    credential.schemaVersion !== 1 ||
    !credential.subjectId?.trim() ||
    credential.passwordHash?.algorithm !== 'scrypt'
  ) {
    throw new Error('Owner credential record is invalid');
  }
  return credential;
}

function validateOptions(options: OwnerMfaEnrollmentOptions): void {
  if (!path.isAbsolute(options.credentialPath) || !path.isAbsolute(options.privateDirectory)) {
    throw new Error('Owner MFA paths must be absolute');
  }
  if (!options.accountLabel.trim()) throw new Error('Owner MFA account label is required');
}
