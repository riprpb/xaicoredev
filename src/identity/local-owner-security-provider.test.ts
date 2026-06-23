import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { OwnerBootstrapRequest } from '@/identity/owner-bootstrap';
import {
  LocalOwnerSecurityProvider,
  decryptLocalOwnerSecurityBundle,
  type OwnerCeremonyAuthorizer,
  type OwnerRecoveryCustodyReceipt,
  type OwnerRecoveryCustodySink,
} from '@/identity/local-owner-security-provider';
import { createKernelRequestContext } from '@/platform/kernel/context';

const directories: string[] = [];
const occurredAt = '2026-06-22T12:00:00.000Z';
const request: OwnerBootstrapRequest = {
  ceremonyId: 'ceremony-test-1',
  candidateSubjectId: 'owner-subject-test',
  constitutionalAcceptance: {
    documentId: 'xaicore-constitution',
    version: '1',
    documentDigest: 'digest-test',
    acceptedAt: occurredAt,
  },
  successorTrustPolicyReference: 'successor-policy/test-v1',
  reason: 'synthetic security provider test',
  context: createKernelRequestContext({
    requestId: 'request-test',
    correlationId: 'correlation-test',
    environment: 'test',
    actor: { id: 'security-test', kind: 'service', authenticated: true },
    requestedAt: occurredAt,
  }),
};

class TestAuthorizer implements OwnerCeremonyAuthorizer {
  allowed = true;

  async authorize(): Promise<boolean> {
    return this.allowed;
  }
}

class TestCustodySink implements OwnerRecoveryCustodySink {
  confirmed = true;
  recoverySecret?: Buffer;
  revokedReference?: string;

  async storeRecoverySecret(
    _bundleId: string,
    _cryptographicOwnerIdentifier: string,
    recoverySecret: Readonly<Buffer>
  ): Promise<OwnerRecoveryCustodyReceipt> {
    this.recoverySecret = Buffer.from(recoverySecret);
    return {
      confirmed: this.confirmed,
      recoveryKeyReference: this.confirmed ? 'recovery-custody-test' : '',
    };
  }

  async revokeRecoveryCustody(recoveryKeyReference: string): Promise<void> {
    this.revokedReference = recoveryKeyReference;
    this.recoverySecret?.fill(0);
  }
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createProvider() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-security-test-'));
  directories.push(directory);
  const authorizer = new TestAuthorizer();
  const custody = new TestCustodySink();
  const provider = new LocalOwnerSecurityProvider(directory, authorizer, custody);
  return { directory, authorizer, custody, provider };
}

describe('LocalOwnerSecurityProvider', () => {
  it('requires an absolute private directory', () => {
    expect(
      () => new LocalOwnerSecurityProvider('relative', new TestAuthorizer(), new TestCustodySink())
    ).toThrow('must be absolute');
  });

  it('delegates ceremony authorization', async () => {
    const { authorizer, provider } = await createProvider();
    await expect(provider.authorizeCeremony(request)).resolves.toBe(true);
    authorizer.allowed = false;
    await expect(provider.authorizeCeremony(request)).resolves.toBe(false);
  });

  it('encrypts a recoverable Owner key and returns opaque references', async () => {
    const { directory, custody, provider } = await createProvider();
    const artifacts = await provider.provisionOwnerSecurityArtifacts(
      request.ceremonyId,
      request.candidateSubjectId
    );
    const recoverySecret = custody.recoverySecret;
    expect(recoverySecret).toBeDefined();
    const decrypted = await decryptLocalOwnerSecurityBundle(
      path.join(directory, 'owner-security.bundle'),
      recoverySecret ?? Buffer.alloc(0)
    );

    expect(decrypted.cryptographicOwnerIdentifier).toBe(artifacts.cryptographicOwnerIdentifier);
    const message = Buffer.from('synthetic owner proof');
    const privateKey = createPrivateKey(decrypted.privateKeyPem);
    const publicKey = createPublicKey({
      key: decrypted.publicKeyDer,
      type: 'spki',
      format: 'der',
    });
    const signature = sign(null, message, privateKey);
    expect(verify(null, message, publicKey, signature)).toBe(true);
    expect(JSON.stringify(artifacts)).not.toContain(recoverySecret?.toString('base64url'));
  });

  it('refuses overwrite and removes artifacts when revoked', async () => {
    const { directory, custody, provider } = await createProvider();
    const artifacts = await provider.provisionOwnerSecurityArtifacts(
      request.ceremonyId,
      request.candidateSubjectId
    );
    await expect(
      provider.provisionOwnerSecurityArtifacts('ceremony-test-2', 'owner-test-2')
    ).rejects.toThrow('already exists');

    await provider.revokeProvisionedArtifacts(artifacts);

    expect(custody.revokedReference).toBe(artifacts.recoveryKeyReference);
    await expect(
      decryptLocalOwnerSecurityBundle(
        path.join(directory, 'owner-security.bundle'),
        custody.recoverySecret ?? Buffer.alloc(0)
      )
    ).rejects.toThrow();
  });

  it('removes the encrypted bundle when recovery custody is not confirmed', async () => {
    const { directory, custody, provider } = await createProvider();
    custody.confirmed = false;

    await expect(
      provider.provisionOwnerSecurityArtifacts(request.ceremonyId, request.candidateSubjectId)
    ).rejects.toThrow('custody was not confirmed');
    await expect(
      decryptLocalOwnerSecurityBundle(
        path.join(directory, 'owner-security.bundle'),
        Buffer.alloc(32)
      )
    ).rejects.toThrow();
  });

  it('rejects an incorrect recovery secret', async () => {
    const { directory, provider } = await createProvider();
    await provider.provisionOwnerSecurityArtifacts(request.ceremonyId, request.candidateSubjectId);

    await expect(
      decryptLocalOwnerSecurityBundle(
        path.join(directory, 'owner-security.bundle'),
        Buffer.alloc(32, 1)
      )
    ).rejects.toThrow();
  });

  it('rejects unsupported schemas and invalid bundle encodings', async () => {
    const unsupported = await createProvider();
    await unsupported.provider.provisionOwnerSecurityArtifacts(
      request.ceremonyId,
      request.candidateSubjectId
    );
    const unsupportedPath = path.join(unsupported.directory, 'owner-security.bundle');
    const unsupportedBundle = JSON.parse(await readFile(unsupportedPath, 'utf8')) as {
      schemaVersion: number;
    };
    unsupportedBundle.schemaVersion = 2;
    await writeFile(unsupportedPath, JSON.stringify(unsupportedBundle), 'utf8');
    await expect(
      decryptLocalOwnerSecurityBundle(
        unsupportedPath,
        unsupported.custody.recoverySecret ?? Buffer.alloc(0)
      )
    ).rejects.toThrow('schema is unsupported');

    const invalid = await createProvider();
    await invalid.provider.provisionOwnerSecurityArtifacts(
      request.ceremonyId,
      request.candidateSubjectId
    );
    const invalidPath = path.join(invalid.directory, 'owner-security.bundle');
    const invalidBundle = JSON.parse(await readFile(invalidPath, 'utf8')) as {
      schemaVersion: 1;
      encryptionSalt: string;
    };
    invalidBundle.encryptionSalt = '';
    await writeFile(invalidPath, JSON.stringify(invalidBundle), 'utf8');
    await expect(
      decryptLocalOwnerSecurityBundle(
        invalidPath,
        invalid.custody.recoverySecret ?? Buffer.alloc(0)
      )
    ).rejects.toThrow('invalid encoding');
  });
});
