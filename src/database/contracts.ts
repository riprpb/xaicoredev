import type { Prisma } from '@prisma/client';

export interface IdentityPersistenceRecord {
  id: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IdentityRepository {
  findById(
    id: string,
    transaction?: Prisma.TransactionClient
  ): Promise<IdentityPersistenceRecord | undefined>;
  create(record: IdentityPersistenceRecord, transaction: Prisma.TransactionClient): Promise<void>;
  updateStatus(
    id: string,
    status: IdentityPersistenceRecord['status'],
    deletedAt: Date | undefined,
    transaction: Prisma.TransactionClient
  ): Promise<void>;
}

export interface AuditPersistenceRecord {
  id: string;
  correlationId: string;
  integrityHash: string;
  occurredAt: Date;
}

export interface AuditRepository {
  append(record: AuditPersistenceRecord, transaction: Prisma.TransactionClient): Promise<void>;
  listByCorrelationId(correlationId: string): Promise<readonly AuditPersistenceRecord[]>;
}

export interface IdempotencyRepository {
  reserve(
    scope: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
    transaction: Prisma.TransactionClient
  ): Promise<'reserved' | 'existing'>;
  complete(
    scope: string,
    key: string,
    responseReference: string,
    transaction: Prisma.TransactionClient
  ): Promise<void>;
}

export interface DatabaseTransactionRunner {
  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}
