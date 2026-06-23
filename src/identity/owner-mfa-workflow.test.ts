import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { OwnerCredentialRecord } from '@/identity/owner-credential-workflow';
import {
  enrollOwnerTotp,
  verifyOwnerTotpFactor,
  type EncryptedOwnerTotpFactor,
  type OwnerMfaWorkflowIO,
} from '@/identity/owner-mfa-workflow';
import {
  createLocalPasswordHash,
  type CompromisedPasswordChecker,
  type LocalPasswordHash,
} from '@/identity/local-credentials';
import { generateTotp } from '@/identity/totp';

const directories: string[] = [];
const password = 'synthetic Owner login password';
let passwordHash: LocalPasswordHash;

beforeAll(async () => {
  const checker: CompromisedPasswordChecker = {
    check: async () => ({ compromised: false, source: 'synthetic-test' }),
  };
  passwordHash = await createLocalPasswordHash(password, checker);
}, 20_000);

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

class TestIO implements OwnerMfaWorkflowIO {
  readonly output: string[] = [];
  confirmed = true;
  suppliedPassword = password;
  invalidCode = false;

  write(message: string): void {
    this.output.push(message);
  }
  async readLine(): Promise<string> {
    const uri = this.output.find((message) => message.startsWith('otpauth://'));
    if (!uri) throw new Error('Synthetic provisioning URI unavailable');
    const secret = new URL(uri).searchParams.get('secret');
    if (!secret) throw new Error('Synthetic TOTP secret unavailable');
    const code = generateTotp(secret);
    return this.invalidCode ? `${code.slice(0, -1)}${(Number(code.at(-1)) + 1) % 10}` : code;
  }
  async readSecret(): Promise<Buffer> {
    return Buffer.from(this.suppliedPassword, 'utf8');
  }
  async confirm(): Promise<boolean> {
    return this.confirmed;
  }
}

async function workspace(validCredential = true) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-owner-mfa-'));
  directories.push(directory);
  const credentialPath = path.join(directory, 'owner-local-credential.json');
  const credential: OwnerCredentialRecord | object = validCredential
    ? {
        schemaVersion: 1,
        subjectId: 'owner-subject-test',
        loginIdentifierHash: 'a'.repeat(64),
        passwordHash,
        createdAt: new Date().toISOString(),
      }
    : {};
  await writeFile(credentialPath, JSON.stringify(credential), 'utf8');
  return { credentialPath, privateDirectory: path.join(directory, 'mfa') };
}

describe('Owner TOTP enrollment', () => {
  it('verifies the Owner password, TOTP code, and encrypted factor', async () => {
    const paths = await workspace();
    const io = new TestIO();
    const factorPath = await enrollOwnerTotp({ ...paths, accountLabel: 'Synthetic Owner' }, io);
    const factor = JSON.parse(await readFile(factorPath, 'utf8')) as EncryptedOwnerTotpFactor;
    const uri = io.output.find((message) => message.startsWith('otpauth://'))!;
    const code = generateTotp(new URL(uri).searchParams.get('secret')!);

    expect(factor).toMatchObject({
      schemaVersion: 1,
      subjectId: 'owner-subject-test',
      factorType: 'totp',
      algorithm: 'aes-256-gcm',
    });
    expect(JSON.stringify(factor)).not.toContain(new URL(uri).searchParams.get('secret'));
    await expect(
      verifyOwnerTotpFactor(paths.credentialPath, factorPath, Buffer.from(password), code)
    ).resolves.toBe(true);
    await expect(
      verifyOwnerTotpFactor(
        paths.credentialPath,
        factorPath,
        Buffer.from('incorrect synthetic password'),
        code
      )
    ).resolves.toBe(false);
  }, 30_000);

  it('fails without confirmation, a valid credential, password, or TOTP proof', async () => {
    const unconfirmed = await workspace();
    const unconfirmedIO = new TestIO();
    unconfirmedIO.confirmed = false;
    await expect(
      enrollOwnerTotp({ ...unconfirmed, accountLabel: 'Owner' }, unconfirmedIO)
    ).rejects.toThrow('not confirmed');

    const invalidCredential = await workspace(false);
    await expect(
      enrollOwnerTotp({ ...invalidCredential, accountLabel: 'Owner' }, new TestIO())
    ).rejects.toThrow('credential record is invalid');

    const wrongPassword = await workspace();
    const wrongPasswordIO = new TestIO();
    wrongPasswordIO.suppliedPassword = 'incorrect synthetic password';
    await expect(
      enrollOwnerTotp({ ...wrongPassword, accountLabel: 'Owner' }, wrongPasswordIO)
    ).rejects.toThrow('credential verification failed');

    const wrongCode = await workspace();
    const wrongCodeIO = new TestIO();
    wrongCodeIO.invalidCode = true;
    await expect(
      enrollOwnerTotp({ ...wrongCode, accountLabel: 'Owner' }, wrongCodeIO)
    ).rejects.toThrow('TOTP verification failed');
  }, 30_000);

  it('rejects unsafe paths, labels, mismatched subjects, and tampered ciphertext', async () => {
    await expect(
      enrollOwnerTotp(
        { credentialPath: 'relative', privateDirectory: 'relative', accountLabel: 'Owner' },
        new TestIO()
      )
    ).rejects.toThrow('absolute');
    const missingLabel = await workspace();
    await expect(
      enrollOwnerTotp({ ...missingLabel, accountLabel: '' }, new TestIO())
    ).rejects.toThrow('label');

    const paths = await workspace();
    const io = new TestIO();
    const factorPath = await enrollOwnerTotp({ ...paths, accountLabel: 'Owner' }, io);
    const factor = JSON.parse(await readFile(factorPath, 'utf8')) as EncryptedOwnerTotpFactor;
    const uri = io.output.find((message) => message.startsWith('otpauth://'))!;
    const code = generateTotp(new URL(uri).searchParams.get('secret')!);
    await writeFile(factorPath, JSON.stringify({ ...factor, subjectId: 'different' }), 'utf8');
    await expect(
      verifyOwnerTotpFactor(paths.credentialPath, factorPath, Buffer.from(password), code)
    ).resolves.toBe(false);
    await writeFile(factorPath, JSON.stringify({ ...factor, encryptedSecret: 'tampered' }), 'utf8');
    await expect(
      verifyOwnerTotpFactor(paths.credentialPath, factorPath, Buffer.from(password), code)
    ).resolves.toBe(false);
  }, 30_000);
});
