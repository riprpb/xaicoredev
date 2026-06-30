import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateOwnerRecoveryCodes, type OwnerRecoveryCliIO } from '@/cli/owner-recovery';
import type { OwnerCredentialRecord } from '@/identity/owner-credential-workflow';
import { enrollOwnerTotp, type OwnerMfaWorkflowIO } from '@/identity/owner-mfa-workflow';
import {
  createLocalPasswordHash,
  type CompromisedPasswordChecker,
} from '@/identity/local-credentials';
import { generateTotp } from '@/identity/totp';
import { FileAuditStore } from '@/platform/audit/file-store';

const directories: string[] = [];
const password = 'synthetic Owner recovery password';

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

class EnrollmentIO implements OwnerMfaWorkflowIO {
  readonly output: string[] = [];

  write(message: string): void {
    this.output.push(message);
  }
  async readLine(): Promise<string> {
    const uri = this.output.find((message) => message.startsWith('otpauth://'));
    if (!uri) throw new Error('Synthetic provisioning URI unavailable');
    return generateTotp(new URL(uri).searchParams.get('secret')!);
  }
  async readSecret(): Promise<Buffer> {
    return Buffer.from(password);
  }
  async confirm(): Promise<boolean> {
    return true;
  }
}

class RecoveryIO implements OwnerRecoveryCliIO {
  readonly output: string[] = [];

  constructor(private readonly code: string) {}

  write(message: string): void {
    this.output.push(message);
  }
  async readLine(): Promise<string> {
    return this.code;
  }
  async readSecret(): Promise<Buffer> {
    return Buffer.from(password);
  }
  async confirm(): Promise<boolean> {
    return true;
  }
}

async function createWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'xaicore-owner-recovery-cli-'));
  directories.push(root);
  const privateDirectory = path.join(root, 'owner');
  const credentialsDirectory = path.join(privateDirectory, 'credentials');
  const credentialPath = path.join(credentialsDirectory, 'owner-local-credential.json');
  await mkdir(credentialsDirectory, { recursive: true });
  const checker: CompromisedPasswordChecker = {
    check: async () => ({ compromised: false, source: 'synthetic-test' }),
  };
  const credential: OwnerCredentialRecord = {
    schemaVersion: 1,
    subjectId: 'owner-subject-test',
    loginIdentifierHash: 'a'.repeat(64),
    passwordHash: await createLocalPasswordHash(password, checker),
    createdAt: new Date().toISOString(),
  };
  await writeFile(credentialPath, JSON.stringify(credential), { encoding: 'utf8', flag: 'wx' });
  const enrollmentIO = new EnrollmentIO();
  const factorPath = await enrollOwnerTotp(
    { credentialPath, privateDirectory: credentialsDirectory, accountLabel: 'Synthetic Owner' },
    enrollmentIO
  );
  const uri = enrollmentIO.output.find((message) => message.startsWith('otpauth://'))!;
  const secret = new URL(uri).searchParams.get('secret')!;
  return { credentialPath, factorPath, privateDirectory, secret };
}

describe('Owner recovery CLI', () => {
  it('requires Owner MFA, displays 10 codes once, stores hashes, and audits generation', async () => {
    const workspace = await createWorkspace();
    const io = new RecoveryIO(generateTotp(workspace.secret));

    await generateOwnerRecoveryCodes(workspace, io);

    const displayedCodes = io.output.filter((line) =>
      /^[A-F0-9]{4}(?:-[A-F0-9]{4}){4}$/.test(line)
    );
    expect(displayedCodes).toHaveLength(10);
    expect(new Set(displayedCodes).size).toBe(10);
    const stored = await readFile(
      path.join(workspace.privateDirectory, 'recovery', 'owner-mfa-recovery.json'),
      'utf8'
    );
    for (const code of displayedCodes) expect(stored).not.toContain(code);
    const state = JSON.parse(stored) as { codes: Array<{ salt: string; hash: string }> };
    expect(state.codes).toHaveLength(10);
    expect(state.codes.every((record) => record.salt && record.hash)).toBe(true);
    const audit = new FileAuditStore(path.join(workspace.privateDirectory, 'audit'));
    expect(await audit.verifyIntegrity()).toBe(true);
  }, 60_000);

  it('does not generate or display codes when MFA verification fails', async () => {
    const workspace = await createWorkspace();
    const io = new RecoveryIO('000000');

    await expect(generateOwnerRecoveryCodes(workspace, io)).rejects.toThrow(
      'authentication or MFA verification failed'
    );
    expect(io.output).toEqual([]);
  }, 60_000);
});
