import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileOwnerBootstrapStore } from '@/identity/file-owner-bootstrap-store';
import type { ImmutableOwnerRecord, OwnerBootstrapAuditDetails } from '@/identity/owner-bootstrap';
import type { AuditEvent } from '@/platform/audit/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';

const temporaryDirectories: string[] = [];
const establishedAt = '2026-06-22T12:00:00.000Z';
const record: ImmutableOwnerRecord = {
  recordId: 'record-test-1',
  subjectId: 'owner-subject-test',
  cryptographicOwnerIdentifier: 'owner-identifier-test',
  constitutionalAcceptance: {
    documentId: 'xaicore-constitution',
    version: '1',
    documentDigest: 'digest-test',
    acceptedAt: establishedAt,
  },
  recoveryKeyReference: 'recovery-reference-test',
  successorTrustPolicyReference: 'successor-policy-test',
  ownershipIntegrityReference: 'integrity-reference-test',
  establishedAt,
  ceremonyId: 'ceremony-test-1',
  version: 1,
};
const audit: AuditEvent<OwnerBootstrapAuditDetails> = {
  id: 'audit-test-1',
  type: 'owner.bootstrap.completed',
  action: 'owner.bootstrap',
  target: 'constitutional-owner',
  outcome: 'succeeded',
  reason: 'synthetic store test',
  occurredAt: establishedAt,
  context: createKernelRequestContext({
    requestId: 'request-test-1',
    correlationId: 'correlation-test-1',
    environment: 'test',
    actor: { id: 'store-test', kind: 'service', authenticated: true },
    requestedAt: establishedAt,
  }),
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createStore(): Promise<FileOwnerBootstrapStore> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-bootstrap-test-'));
  temporaryDirectories.push(directory);
  return new FileOwnerBootstrapStore(directory);
}

describe('FileOwnerBootstrapStore', () => {
  it('requires an explicit absolute private storage directory', () => {
    expect(() => new FileOwnerBootstrapStore('relative/private')).toThrow('must be absolute');
  });

  it('atomically persists one record and completion audit envelope', async () => {
    const store = await createStore();
    expect(await store.reserve(record.ceremonyId)).toBe(true);

    await store.commit(record.ceremonyId, record, audit);

    await expect(store.readEnvelope()).resolves.toEqual({
      schemaVersion: 1,
      record,
      completionAudit: audit,
    });
    expect(await store.reserve('another-ceremony')).toBe(false);
  });

  it('allows only one active reservation', async () => {
    const store = await createStore();
    expect(await store.reserve(record.ceremonyId)).toBe(true);
    expect(await store.reserve('another-ceremony')).toBe(false);
    await expect(store.commit('another-ceremony', record, audit)).rejects.toThrow(
      'does not match ceremony'
    );
    await expect(store.abort('another-ceremony')).rejects.toThrow('belongs to another ceremony');
  });

  it('aborts a matching reservation without creating a record', async () => {
    const store = await createStore();
    expect(await store.readEnvelope()).toBeUndefined();
    await expect(store.abort(record.ceremonyId)).resolves.toBeUndefined();
    expect(await store.reserve(record.ceremonyId)).toBe(true);
    await store.abort(record.ceremonyId);
    expect(await store.reserve('replacement-ceremony')).toBe(true);
  });
});
