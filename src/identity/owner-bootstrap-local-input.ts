import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ConstitutionalAcceptanceRecord,
  OwnerBootstrapRequest,
} from '@/identity/owner-bootstrap';
import type { KernelRequestContext } from '@/platform/kernel/context';

const MAXIMUM_INPUT_BYTES = 64 * 1024;

export interface LocalOwnerAccountInput {
  displayName: string;
  primaryEmail: string;
}

export interface OwnerBootstrapLocalInput {
  schemaVersion: 1;
  ceremonyId: string;
  candidateSubjectId: string;
  ownerAccount: LocalOwnerAccountInput;
  constitutionalAcceptance: ConstitutionalAcceptanceRecord;
  successorTrustPolicyReference: string;
  reason: string;
}

export async function loadOwnerBootstrapLocalInput(
  filePath: string
): Promise<Readonly<OwnerBootstrapLocalInput>> {
  if (!path.isAbsolute(filePath)) {
    throw new Error('Owner Bootstrap input path must be absolute');
  }
  if (!filePath.endsWith('.owner-bootstrap.local.json')) {
    throw new Error('Owner Bootstrap input must use the protected local filename suffix');
  }

  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error('Owner Bootstrap input must be a regular non-symlink file');
  }
  if (metadata.size > MAXIMUM_INPUT_BYTES) {
    throw new Error('Owner Bootstrap input exceeds the maximum allowed size');
  }
  if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
    throw new Error('Owner Bootstrap input permissions are too broad');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    throw new Error('Owner Bootstrap input is not valid JSON');
  }
  const input = validateInput(parsed);
  return Object.freeze({
    ...input,
    ownerAccount: Object.freeze({ ...input.ownerAccount }),
    constitutionalAcceptance: Object.freeze({
      ...input.constitutionalAcceptance,
    }),
  });
}

export function createOwnerBootstrapRequest(
  input: OwnerBootstrapLocalInput,
  context: KernelRequestContext
): OwnerBootstrapRequest {
  return {
    ceremonyId: input.ceremonyId,
    candidateSubjectId: input.candidateSubjectId,
    constitutionalAcceptance: input.constitutionalAcceptance,
    successorTrustPolicyReference: input.successorTrustPolicyReference,
    reason: input.reason,
    context,
  };
}

function validateInput(value: unknown): OwnerBootstrapLocalInput {
  if (!isRecord(value)) throw new Error('Owner Bootstrap input must be an object');
  assertOnlyKeys(value, [
    'schemaVersion',
    'ceremonyId',
    'candidateSubjectId',
    'ownerAccount',
    'constitutionalAcceptance',
    'successorTrustPolicyReference',
    'reason',
  ]);
  if (value.schemaVersion !== 1) {
    throw new Error('Owner Bootstrap input schema version is unsupported');
  }
  if (!isRecord(value.ownerAccount)) {
    throw new Error('Owner Bootstrap ownerAccount is required');
  }
  assertOnlyKeys(value.ownerAccount, ['displayName', 'primaryEmail']);
  if (!isRecord(value.constitutionalAcceptance)) {
    throw new Error('Owner Bootstrap constitutionalAcceptance is required');
  }
  assertOnlyKeys(value.constitutionalAcceptance, [
    'documentId',
    'version',
    'documentDigest',
    'acceptedAt',
  ]);

  const input = value as unknown as OwnerBootstrapLocalInput;
  requireText(input.ceremonyId, 'ceremonyId');
  requireText(input.candidateSubjectId, 'candidateSubjectId');
  requireText(input.ownerAccount.displayName, 'ownerAccount.displayName');
  if (
    typeof input.ownerAccount.primaryEmail !== 'string' ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.ownerAccount.primaryEmail)
  ) {
    throw new Error('Owner Bootstrap ownerAccount.primaryEmail is invalid');
  }
  requireText(input.constitutionalAcceptance.documentId, 'constitutionalAcceptance.documentId');
  requireText(input.constitutionalAcceptance.version, 'constitutionalAcceptance.version');
  requireText(
    input.constitutionalAcceptance.documentDigest,
    'constitutionalAcceptance.documentDigest'
  );
  if (Number.isNaN(Date.parse(input.constitutionalAcceptance.acceptedAt))) {
    throw new Error('Owner Bootstrap constitutionalAcceptance.acceptedAt is invalid');
  }
  requireText(input.successorTrustPolicyReference, 'successorTrustPolicyReference');
  requireText(input.reason, 'reason');
  return input;
}

function assertOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[]
): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error('Owner Bootstrap input contains unsupported fields');
  }
}

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Owner Bootstrap ${field} is required`);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
