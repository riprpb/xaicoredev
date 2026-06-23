import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EncryptedFileRecoveryCustodySink,
  decryptEncryptedRecoveryPackage,
  type RecoveryPassphraseProvider,
} from '@/identity/encrypted-file-recovery-custody';

const directories: string[] = [];
const passphraseText = 'synthetic recovery passphrase value';

class TestPassphraseProvider implements RecoveryPassphraseProvider {
  value = passphraseText;
  issued?: Buffer;

  async getRecoveryPassphrase(): Promise<Buffer> {
    this.issued = Buffer.from(this.value, 'utf8');
    return this.issued;
  }
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createSink() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-custody-test-'));
  directories.push(directory);
  const passphrases = new TestPassphraseProvider();
  const sink = new EncryptedFileRecoveryCustodySink(directory, passphrases);
  return { directory, passphrases, sink };
}

describe('EncryptedFileRecoveryCustodySink', () => {
  it('requires an absolute recovery directory', () => {
    expect(
      () => new EncryptedFileRecoveryCustodySink('relative', new TestPassphraseProvider())
    ).toThrow('must be absolute');
  });

  it('stores and verifies a separately encrypted recovery package', async () => {
    const { directory, passphrases, sink } = await createSink();
    const recoverySecret = Buffer.alloc(32, 7);
    const receipt = await sink.storeRecoverySecret(
      'bundle-test-1',
      'owner-identifier-test',
      recoverySecret
    );

    expect(receipt.confirmed).toBe(true);
    expect(receipt.recoveryKeyReference).not.toContain(recoverySecret.toString('base64url'));
    expect(passphrases.issued?.every((byte) => byte === 0)).toBe(true);
    const decrypted = await decryptEncryptedRecoveryPackage(
      path.join(directory, 'owner-recovery.package'),
      Buffer.from(passphraseText, 'utf8')
    );
    expect(decrypted).toEqual({
      bundleId: 'bundle-test-1',
      cryptographicOwnerIdentifier: 'owner-identifier-test',
      recoverySecret,
    });
    decrypted.recoverySecret.fill(0);
  }, 15_000);

  it('rejects incorrect passphrases and package overwrite', async () => {
    const { directory, sink } = await createSink();
    await sink.storeRecoverySecret('bundle-test-1', 'owner-identifier-test', Buffer.alloc(32, 7));
    await expect(
      decryptEncryptedRecoveryPackage(
        path.join(directory, 'owner-recovery.package'),
        Buffer.from('incorrect recovery passphrase', 'utf8')
      )
    ).rejects.toThrow();
    await expect(
      sink.storeRecoverySecret('bundle-test-2', 'owner-identifier-test', Buffer.alloc(32, 8))
    ).rejects.toThrow('already exists');
  }, 15_000);

  it('rejects weak passphrases before writing custody material', async () => {
    const { passphrases, sink } = await createSink();
    passphrases.value = 'short';
    await expect(
      sink.storeRecoverySecret('bundle-test-1', 'owner-identifier-test', Buffer.alloc(32, 7))
    ).rejects.toThrow('outside policy');
    expect(passphrases.issued?.every((byte) => byte === 0)).toBe(true);
  });

  it('removes a provisioned recovery package when custody is revoked', async () => {
    const { directory, sink } = await createSink();
    const receipt = await sink.storeRecoverySecret(
      'bundle-test-1',
      'owner-identifier-test',
      Buffer.alloc(32, 7)
    );
    await sink.revokeRecoveryCustody(receipt.recoveryKeyReference);
    await expect(
      decryptEncryptedRecoveryPackage(
        path.join(directory, 'owner-recovery.package'),
        Buffer.from(passphraseText, 'utf8')
      )
    ).rejects.toThrow();
    await expect(sink.revokeRecoveryCustody('unknown-reference')).resolves.toBeUndefined();
  }, 15_000);
});
