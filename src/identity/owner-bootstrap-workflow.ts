import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { EncryptedFileRecoveryCustodySink } from '@/identity/encrypted-file-recovery-custody';
import { FileBootstrapAuditWriter } from '@/identity/file-bootstrap-audit-writer';
import { FileOwnerBootstrapStore } from '@/identity/file-owner-bootstrap-store';
import {
  LocalOwnerSecurityProvider,
  type OwnerCeremonyAuthorizer,
} from '@/identity/local-owner-security-provider';
import { OwnerBootstrapCoordinator } from '@/identity/owner-bootstrap';
import {
  createOwnerBootstrapRequest,
  loadOwnerBootstrapLocalInput,
  type OwnerBootstrapLocalInput,
} from '@/identity/owner-bootstrap-local-input';
import { createKernelRequestContext } from '@/platform/kernel/context';

export interface OwnerBootstrapWorkflowIO {
  write(message: string): void;
  readLine(prompt: string): Promise<string>;
  readSecret(prompt: string): Promise<Buffer>;
  confirm(prompt: string): Promise<boolean>;
}

export interface OwnerBootstrapPreparationOptions {
  outputPath: string;
  constitutionPaths: readonly string[];
  successorTrustPolicyReference: string;
}

export interface OwnerBootstrapExecutionOptions {
  inputPath: string;
  privateDirectory: string;
  recoveryDirectory: string;
}

export async function prepareOwnerBootstrapInput(
  options: OwnerBootstrapPreparationOptions,
  io: OwnerBootstrapWorkflowIO,
  now: () => Date = () => new Date()
): Promise<Readonly<OwnerBootstrapLocalInput>> {
  validatePreparationOptions(options);
  const displayName = (await io.readLine('Owner display name: ')).trim();
  const primaryEmail = (await io.readLine('Owner primary email: ')).trim();
  if (!displayName || !primaryEmail) {
    throw new Error('Owner display name and primary email are required');
  }
  if (!(await io.confirm('Accept the current XAICore Constitution for bootstrap?'))) {
    throw new Error('Constitutional acceptance is required');
  }

  const documentDigest = await digestConstitution(options.constitutionPaths);
  const input: OwnerBootstrapLocalInput = {
    schemaVersion: 1,
    ceremonyId: randomUUID(),
    candidateSubjectId: randomUUID(),
    ownerAccount: { displayName, primaryEmail },
    constitutionalAcceptance: {
      documentId: 'xaicore-constitution',
      version: `sha256-${documentDigest.slice(0, 16)}`,
      documentDigest,
      acceptedAt: now().toISOString(),
    },
    successorTrustPolicyReference: options.successorTrustPolicyReference,
    reason: 'Owner-authorized initial XAICore bootstrap',
  };
  await mkdir(path.dirname(options.outputPath), { recursive: true, mode: 0o700 });
  const handle = await open(options.outputPath, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(input, null, 2), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  io.write(`Prepared local bootstrap input: ${options.outputPath}`);
  return loadOwnerBootstrapLocalInput(options.outputPath);
}

export async function executeOwnerBootstrapWorkflow(
  options: OwnerBootstrapExecutionOptions,
  io: OwnerBootstrapWorkflowIO,
  now: () => Date = () => new Date()
) {
  validateExecutionOptions(options);
  const input = await loadOwnerBootstrapLocalInput(options.inputPath);
  io.write(`Owner: ${input.ownerAccount.displayName} <${input.ownerAccount.primaryEmail}>`);
  io.write(`Constitution: ${input.constitutionalAcceptance.version}`);
  if (!(await io.confirm('Execute the permanent one-time Owner Bootstrap now?'))) {
    throw new Error('Owner Bootstrap execution was not confirmed');
  }

  const passphraseProvider = {
    getRecoveryPassphrase: async () => readConfirmedRecoveryPassphrase(io),
  };
  const custody = new EncryptedFileRecoveryCustodySink(
    options.recoveryDirectory,
    passphraseProvider
  );
  const authorizer: OwnerCeremonyAuthorizer = {
    authorize: async () => true,
  };
  const security = new LocalOwnerSecurityProvider(
    path.join(options.privateDirectory, 'security'),
    authorizer,
    custody
  );
  const store = new FileOwnerBootstrapStore(path.join(options.privateDirectory, 'record'));
  const audit = new FileBootstrapAuditWriter(path.join(options.privateDirectory, 'audit'));
  const context = createKernelRequestContext({
    requestId: randomUUID(),
    correlationId: randomUUID(),
    environment: 'development',
    actor: {
      id: 'local-owner-bootstrap',
      kind: 'service',
      authenticated: true,
    },
    requestedAt: now().toISOString(),
  });
  const coordinator = new OwnerBootstrapCoordinator(store, security, audit, now);
  const result = await coordinator.execute(createOwnerBootstrapRequest(input, context));
  io.write(`Owner Bootstrap completed. Record: ${result.recordId}`);
  return result;
}

async function readConfirmedRecoveryPassphrase(io: OwnerBootstrapWorkflowIO): Promise<Buffer> {
  const first = await io.readSecret('Recovery passphrase: ');
  const confirmation = await io.readSecret('Confirm recovery passphrase: ');
  try {
    if (first.length !== confirmation.length || !timingSafeEqual(first, confirmation)) {
      throw new Error('Recovery passphrases do not match');
    }
    return Buffer.from(first);
  } finally {
    first.fill(0);
    confirmation.fill(0);
  }
}

async function digestConstitution(paths: readonly string[]): Promise<string> {
  const hash = createHash('sha256');
  for (const documentPath of [...paths].sort()) {
    hash.update(path.basename(documentPath), 'utf8');
    hash.update(Buffer.from([0]));
    hash.update(await readFile(documentPath));
    hash.update(Buffer.from([0]));
  }
  return hash.digest('hex');
}

function validatePreparationOptions(options: OwnerBootstrapPreparationOptions): void {
  if (!path.isAbsolute(options.outputPath)) {
    throw new Error('Bootstrap input output path must be absolute');
  }
  if (!options.outputPath.endsWith('.owner-bootstrap.local.json')) {
    throw new Error('Bootstrap input output path has an invalid suffix');
  }
  if (options.constitutionPaths.length === 0) {
    throw new Error('At least one Constitution document is required');
  }
  if (!options.successorTrustPolicyReference.trim()) {
    throw new Error('Successor trust policy reference is required');
  }
}

function validateExecutionOptions(options: OwnerBootstrapExecutionOptions): void {
  for (const [name, value] of Object.entries(options)) {
    if (!path.isAbsolute(value)) {
      throw new Error(`${name} must be an absolute path`);
    }
  }
  if (pathsOverlap(options.privateDirectory, options.recoveryDirectory)) {
    throw new Error('Owner private and recovery directories must be separate');
  }
}

function pathsOverlap(first: string, second: string): boolean {
  const relativeFirst = path.relative(first, second);
  const relativeSecond = path.relative(second, first);
  return (
    relativeFirst === '' ||
    relativeSecond === '' ||
    (!relativeFirst.startsWith('..') && !path.isAbsolute(relativeFirst)) ||
    (!relativeSecond.startsWith('..') && !path.isAbsolute(relativeSecond))
  );
}
