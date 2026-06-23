import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  provisionOwnerCredential,
  type OwnerCredentialRecord,
  type OwnerCredentialWorkflowIO,
} from '@/identity/owner-credential-workflow';
import { verifyLocalPassword, type CompromisedPasswordChecker } from '@/identity/local-credentials';

const directories: string[] = [];
const password = 'synthetic Owner login password';
const checker: CompromisedPasswordChecker = {
  check: async () => ({ compromised: false, source: 'synthetic-test' }),
};

class TestIO implements OwnerCredentialWorkflowIO {
  readonly output: string[] = [];
  identifier = 'Owner.Login@Example.Test';
  confirmed = true;
  secrets = [password, password];

  write(message: string): void {
    this.output.push(message);
  }
  async readLine(): Promise<string> {
    return this.identifier;
  }
  async readSecret(): Promise<Buffer> {
    return Buffer.from(this.secrets.shift() ?? '', 'utf8');
  }
  async confirm(): Promise<boolean> {
    return this.confirmed;
  }
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function workspace(validRecord = true) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-owner-credential-'));
  directories.push(directory);
  const ownerRecordPath = path.join(directory, 'owner-bootstrap.record.json');
  await writeFile(
    ownerRecordPath,
    JSON.stringify(validRecord ? { record: { subjectId: 'owner-subject-test' } } : {}),
    'utf8'
  );
  return {
    ownerRecordPath,
    privateDirectory: path.join(directory, 'credentials'),
  };
}

describe('Owner credential provisioning', () => {
  it('creates one private hash-only credential bound to the immutable Owner', async () => {
    const paths = await workspace();
    const io = new TestIO();
    const credentialPath = await provisionOwnerCredential(paths, io, checker);
    const content = await readFile(credentialPath, 'utf8');
    const record = JSON.parse(content) as OwnerCredentialRecord;

    expect(record).toMatchObject({
      schemaVersion: 1,
      subjectId: 'owner-subject-test',
      loginIdentifierHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      passwordHash: { algorithm: 'scrypt' },
    });
    expect(content).not.toContain('Owner.Login@Example.Test');
    expect(content).not.toContain(password);
    await expect(verifyLocalPassword(password, record.passwordHash)).resolves.toMatchObject({
      valid: true,
    });
    expect(io.output.at(-1)).toContain('MFA enrollment is still required');
  }, 20_000);

  it('requires confirmation and matching hidden password entries', async () => {
    const unconfirmed = await workspace();
    const unconfirmedIO = new TestIO();
    unconfirmedIO.confirmed = false;
    await expect(provisionOwnerCredential(unconfirmed, unconfirmedIO, checker)).rejects.toThrow(
      'not confirmed'
    );

    const mismatch = await workspace();
    const mismatchIO = new TestIO();
    mismatchIO.secrets = [password, 'different synthetic password'];
    await expect(provisionOwnerCredential(mismatch, mismatchIO, checker)).rejects.toThrow(
      'do not match'
    );
  });

  it('rejects invalid paths, records, and identifiers', async () => {
    const io = new TestIO();
    await expect(
      provisionOwnerCredential(
        { ownerRecordPath: 'relative', privateDirectory: 'relative' },
        io,
        checker
      )
    ).rejects.toThrow('absolute');

    const invalidRecord = await workspace(false);
    await expect(provisionOwnerCredential(invalidRecord, io, checker)).rejects.toThrow(
      'record is invalid'
    );

    const missingIdentifier = await workspace();
    const missingIdentifierIO = new TestIO();
    missingIdentifierIO.identifier = ' ';
    await expect(
      provisionOwnerCredential(missingIdentifier, missingIdentifierIO, checker)
    ).rejects.toThrow('identifier is required');
  });
});
