import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { access, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  OwnerBootstrapRequest,
  OwnerBootstrapSecurityProvider,
  OwnerSecurityArtifactReferences,
} from '@/identity/owner-bootstrap';

const RECOVERY_SECRET_BYTES = 32;
const ENCRYPTION_SALT_BYTES = 16;
const AES_GCM_IV_BYTES = 12;

interface LocalOwnerSecurityBundle {
  schemaVersion: 1;
  bundleId: string;
  cryptographicOwnerIdentifier: string;
  publicKey: string;
  encryptionSalt: string;
  initializationVector: string;
  authenticationTag: string;
  encryptedPrivateKey: string;
}

export interface OwnerCeremonyAuthorizer {
  authorize(request: OwnerBootstrapRequest): Promise<boolean>;
}

export interface OwnerRecoveryCustodyReceipt {
  confirmed: boolean;
  recoveryKeyReference: string;
}

export interface OwnerRecoveryCustodySink {
  storeRecoverySecret(
    bundleId: string,
    cryptographicOwnerIdentifier: string,
    recoverySecret: Readonly<Buffer>
  ): Promise<OwnerRecoveryCustodyReceipt>;
  revokeRecoveryCustody(recoveryKeyReference: string): Promise<void>;
}

export interface DecryptedOwnerSecurityBundle {
  cryptographicOwnerIdentifier: string;
  publicKeyDer: Buffer;
  privateKeyPem: string;
}

export class LocalOwnerSecurityProvider implements OwnerBootstrapSecurityProvider {
  private readonly bundlePath: string;
  private readonly provisioned = new Map<
    string,
    { bundlePath: string; recoveryKeyReference: string }
  >();

  constructor(
    private readonly directory: string,
    private readonly authorizer: OwnerCeremonyAuthorizer,
    private readonly custodySink: OwnerRecoveryCustodySink
  ) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Owner security directory must be absolute');
    }
    this.bundlePath = path.join(directory, 'owner-security.bundle');
  }

  async authorizeCeremony(request: OwnerBootstrapRequest): Promise<boolean> {
    return this.authorizer.authorize(request);
  }

  async provisionOwnerSecurityArtifacts(
    ceremonyId: string,
    subjectId: string
  ): Promise<OwnerSecurityArtifactReferences> {
    void ceremonyId;
    void subjectId;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (await exists(this.bundlePath)) {
      throw new Error('Owner security bundle already exists');
    }

    const recoverySecret = randomBytes(RECOVERY_SECRET_BYTES);
    let recoveryKeyReference: string | undefined;
    let bundleWritten = false;
    try {
      const { privateKey, publicKey } = generateKeyPairSync('ed25519');
      const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const cryptographicOwnerIdentifier = createHash('sha256')
        .update(publicKeyDer)
        .digest('base64url');
      const bundle = encryptBundle(
        randomUUID(),
        cryptographicOwnerIdentifier,
        Buffer.from(publicKeyDer),
        privateKeyPem,
        recoverySecret
      );
      const serialized = JSON.stringify(bundle);
      const handle = await open(this.bundlePath, 'wx', 0o600);
      try {
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
        bundleWritten = true;
      } finally {
        await handle.close();
      }

      const receipt = await this.custodySink.storeRecoverySecret(
        bundle.bundleId,
        cryptographicOwnerIdentifier,
        recoverySecret
      );
      if (!receipt.confirmed || !receipt.recoveryKeyReference.trim()) {
        throw new Error('Owner recovery custody was not confirmed');
      }
      recoveryKeyReference = receipt.recoveryKeyReference;
      const ownershipIntegrityReference = createHash('sha256')
        .update(serialized)
        .digest('base64url');
      this.provisioned.set(ownershipIntegrityReference, {
        bundlePath: this.bundlePath,
        recoveryKeyReference,
      });
      return {
        cryptographicOwnerIdentifier,
        recoveryKeyReference,
        ownershipIntegrityReference,
      };
    } catch (error) {
      if (bundleWritten) {
        try {
          await unlink(this.bundlePath);
        } catch {
          // Best-effort cleanup; preserve the provisioning failure.
        }
      }
      if (recoveryKeyReference) {
        try {
          await this.custodySink.revokeRecoveryCustody(recoveryKeyReference);
        } catch {
          // Best-effort cleanup; preserve the provisioning failure.
        }
      }
      throw error;
    } finally {
      recoverySecret.fill(0);
    }
  }

  async revokeProvisionedArtifacts(artifacts: OwnerSecurityArtifactReferences): Promise<void> {
    const provisioned = this.provisioned.get(artifacts.ownershipIntegrityReference);
    if (!provisioned) return;
    await Promise.allSettled([
      unlink(provisioned.bundlePath),
      this.custodySink.revokeRecoveryCustody(provisioned.recoveryKeyReference),
    ]);
    this.provisioned.delete(artifacts.ownershipIntegrityReference);
  }
}

export async function decryptLocalOwnerSecurityBundle(
  bundlePath: string,
  recoverySecret: Readonly<Buffer>
): Promise<DecryptedOwnerSecurityBundle> {
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as LocalOwnerSecurityBundle;
  if (bundle.schemaVersion !== 1) {
    throw new Error('Owner security bundle schema is unsupported');
  }
  const salt = decode(bundle.encryptionSalt);
  const iv = decode(bundle.initializationVector);
  const tag = decode(bundle.authenticationTag);
  const encrypted = decode(bundle.encryptedPrivateKey);
  const key = deriveEncryptionKey(recoverySecret, salt, bundle.bundleId);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(bundle.bundleId, 'utf8'));
    decipher.setAuthTag(tag);
    const privateKeyPem = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8'
    );
    return {
      cryptographicOwnerIdentifier: bundle.cryptographicOwnerIdentifier,
      publicKeyDer: decode(bundle.publicKey),
      privateKeyPem,
    };
  } finally {
    key.fill(0);
  }
}

function encryptBundle(
  bundleId: string,
  cryptographicOwnerIdentifier: string,
  publicKeyDer: Buffer,
  privateKeyPem: string,
  recoverySecret: Readonly<Buffer>
): LocalOwnerSecurityBundle {
  const salt = randomBytes(ENCRYPTION_SALT_BYTES);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const key = deriveEncryptionKey(recoverySecret, salt, bundleId);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(bundleId, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
    return {
      schemaVersion: 1,
      bundleId,
      cryptographicOwnerIdentifier,
      publicKey: publicKeyDer.toString('base64url'),
      encryptionSalt: salt.toString('base64url'),
      initializationVector: iv.toString('base64url'),
      authenticationTag: cipher.getAuthTag().toString('base64url'),
      encryptedPrivateKey: encrypted.toString('base64url'),
    };
  } finally {
    key.fill(0);
  }
}

function deriveEncryptionKey(
  recoverySecret: Readonly<Buffer>,
  salt: Buffer,
  bundleId: string
): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      recoverySecret,
      salt,
      Buffer.from(`xaicore-owner-security:${bundleId}`, 'utf8'),
      32
    )
  );
}

function decode(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.toString('base64url') !== value) {
    throw new Error('Owner security bundle contains invalid encoding');
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
