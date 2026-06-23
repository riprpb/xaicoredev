import { Prisma } from '@prisma/client';

export interface IdempotencyMetadata {
  scope: string;
  key: string;
  requestHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export function serializeDecimal(value: Prisma.Decimal): string {
  return value.toFixed();
}

export function parseDecimal(value: string): Prisma.Decimal {
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error('Decimal values require a non-exponential canonical string');
  }
  return new Prisma.Decimal(value);
}

export function serializeUtcTimestamp(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Timestamp is invalid');
  return value.toISOString();
}

export function validateIdempotencyMetadata(metadata: IdempotencyMetadata): void {
  if (!/^[a-z][a-z0-9._-]{2,149}$/.test(metadata.scope)) {
    throw new Error('Idempotency scope is invalid');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$/.test(metadata.key)) {
    throw new Error('Idempotency key is invalid');
  }
  if (!/^[0-9a-f]{64}$/.test(metadata.requestHash)) {
    throw new Error('Idempotency request hash must be SHA-256');
  }
  if (
    Number.isNaN(metadata.createdAt.getTime()) ||
    Number.isNaN(metadata.expiresAt.getTime()) ||
    metadata.expiresAt <= metadata.createdAt
  ) {
    throw new Error('Idempotency expiry must follow creation');
  }
}

export function requireSoftDelete(
  status: IdentityPersistenceStatus,
  deletedAt: Date | undefined
): void {
  if ((status === 'DELETED') !== (deletedAt !== undefined)) {
    throw new Error('Deleted identity status and timestamp must change together');
  }
  if (deletedAt && Number.isNaN(deletedAt.getTime())) {
    throw new Error('Soft-delete timestamp is invalid');
  }
}

type IdentityPersistenceStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'DELETED';
