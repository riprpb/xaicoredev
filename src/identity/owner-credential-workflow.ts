import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createLocalPasswordHash,
  type CompromisedPasswordChecker,
  type LocalPasswordHash,
} from '@/identity/local-credentials';

export interface OwnerCredentialWorkflowIO {
  readLine(prompt: string): Promise<string>;
  readSecret(prompt: string): Promise<Buffer>;
  confirm(prompt: string): Promise<boolean>;
  write(message: string): void;
}

export interface OwnerCredentialRecord {
  schemaVersion: 1;
  subjectId: string;
  loginIdentifierHash: string;
  passwordHash: LocalPasswordHash;
  createdAt: string;
}

export interface OwnerCredentialProvisioningOptions {
  ownerRecordPath: string;
  privateDirectory: string;
}

export async function provisionOwnerCredential(
  options: OwnerCredentialProvisioningOptions,
  io: OwnerCredentialWorkflowIO,
  compromisedPasswords: CompromisedPasswordChecker,
  now: () => Date = () => new Date()
): Promise<string> {
  validatePaths(options);
  const subjectId = await loadOwnerSubjectId(options.ownerRecordPath);
  const loginIdentifier = normalizeIdentifier(await io.readLine('Owner login identifier: '));
  if (!loginIdentifier) throw new Error('Owner login identifier is required');
  if (!(await io.confirm('Provision the create-once local Owner credential?'))) {
    throw new Error('Owner credential provisioning was not confirmed');
  }
  const first = await io.readSecret('Owner login password: ');
  const confirmation = await io.readSecret('Confirm Owner login password: ');
  try {
    if (first.length !== confirmation.length || !timingSafeEqual(first, confirmation)) {
      throw new Error('Owner login passwords do not match');
    }
    const record: OwnerCredentialRecord = {
      schemaVersion: 1,
      subjectId,
      loginIdentifierHash: createHash('sha256').update(loginIdentifier, 'utf8').digest('hex'),
      passwordHash: await createLocalPasswordHash(first.toString('utf8'), compromisedPasswords),
      createdAt: now().toISOString(),
    };
    await mkdir(options.privateDirectory, { recursive: true, mode: 0o700 });
    const credentialPath = path.join(options.privateDirectory, 'owner-local-credential.json');
    const handle = await open(credentialPath, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(record), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    io.write('Owner local credential provisioned. MFA enrollment is still required.');
    return credentialPath;
  } finally {
    first.fill(0);
    confirmation.fill(0);
  }
}

async function loadOwnerSubjectId(ownerRecordPath: string): Promise<string> {
  const envelope = JSON.parse(await readFile(ownerRecordPath, 'utf8')) as {
    record?: { subjectId?: unknown };
  };
  const subjectId = envelope.record?.subjectId;
  if (typeof subjectId !== 'string' || !subjectId.trim()) {
    throw new Error('Immutable Owner record is invalid');
  }
  return subjectId;
}

function validatePaths(options: OwnerCredentialProvisioningOptions): void {
  if (!path.isAbsolute(options.ownerRecordPath) || !path.isAbsolute(options.privateDirectory)) {
    throw new Error('Owner credential paths must be absolute');
  }
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}
