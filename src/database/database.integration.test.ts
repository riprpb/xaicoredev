import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runDatabaseTests = process.env.DATABASE_INTEGRATION === 'true';

describe.runIf(runDatabaseTests)('PostgreSQL foundation migration', () => {
  const database = new PrismaClient();

  beforeAll(async () => database.$connect());
  afterAll(async () => database.$disconnect());

  it('enforces transactions, one Owner bootstrap, and append-only audit', async () => {
    const rollbackIdentityId = randomUUID();
    await expect(
      database.$transaction(async (transaction) => {
        await transaction.identity.create({
          data: { id: rollbackIdentityId, status: 'ACTIVE' },
        });
        throw new Error('synthetic rollback');
      })
    ).rejects.toThrow('synthetic rollback');
    await expect(database.identity.count({ where: { id: rollbackIdentityId } })).resolves.toBe(0);

    const ownerIdentity = await database.identity.create({ data: { status: 'ACTIVE' } });
    const ownerRecord = await database.ownerBootstrapRecord.create({
      data: {
        id: randomUUID(),
        identityId: ownerIdentity.id,
        ceremonyId: randomUUID(),
        cryptographicOwnerIdentifier: `owner://${randomUUID()}`,
        constitutionalDocumentId: 'xaicore-constitution',
        constitutionalVersion: 'synthetic-v1',
        constitutionalDigest: 'a'.repeat(64),
        constitutionalAcceptedAt: new Date(),
        recoveryKeyReference: `recovery://${randomUUID()}`,
        successorTrustPolicyReference: 'successor-policy/test-v1',
        ownershipIntegrityReference: `integrity://${randomUUID()}`,
        establishedAt: new Date(),
      },
    });
    const secondIdentity = await database.identity.create({ data: { status: 'ACTIVE' } });
    await expect(
      database.ownerBootstrapRecord.create({
        data: {
          id: randomUUID(),
          identityId: secondIdentity.id,
          ceremonyId: randomUUID(),
          cryptographicOwnerIdentifier: `owner://${randomUUID()}`,
          constitutionalDocumentId: 'xaicore-constitution',
          constitutionalVersion: 'synthetic-v1',
          constitutionalDigest: 'b'.repeat(64),
          constitutionalAcceptedAt: new Date(),
          recoveryKeyReference: `recovery://${randomUUID()}`,
          successorTrustPolicyReference: 'successor-policy/test-v1',
          ownershipIntegrityReference: `integrity://${randomUUID()}`,
          establishedAt: new Date(),
        },
      })
    ).rejects.toThrow();
    await expect(
      database.ownerBootstrapRecord.update({
        where: { id: ownerRecord.id },
        data: { constitutionalVersion: 'modified' },
      })
    ).rejects.toThrow();

    const audit = await database.auditRecord.create({
      data: {
        id: randomUUID(),
        type: 'database.integration.verified',
        action: 'verify',
        target: 'database.foundation',
        outcome: 'SUCCEEDED',
        reason: 'synthetic migration verification',
        actorKind: 'service',
        constitutionalAuthority: [],
        requestId: randomUUID(),
        correlationId: randomUUID(),
        environment: 'test',
        occurredAt: new Date(),
        previousEventHash: '0'.repeat(64),
        integrityHash: createHash('sha256').update(randomUUID()).digest('hex'),
      },
    });
    await expect(
      database.auditRecord.update({
        where: { id: audit.id },
        data: { reason: 'modified' },
      })
    ).rejects.toThrow();

    const aiManifest = await database.platformManifestRecord.create({
      data: {
        componentId: 'synthetic.ai',
        componentKind: 'AI',
        version: '1.0.0',
        status: 'EXPERIMENTAL',
        manifest: { id: 'synthetic.ai', kind: 'ai', version: '1.0.0' },
        manifestDigest: createHash('sha256').update('synthetic.ai').digest('hex'),
      },
    });
    await expect(
      database.platformRegistryRecord.create({
        data: {
          componentId: 'synthetic.ai',
          componentKind: 'AI',
          activeManifestId: aiManifest.id,
          lifecycleState: 'RUNNING',
          executionEnabled: true,
          reason: 'invalid AI activation test',
        },
      })
    ).rejects.toThrow();
    await expect(
      database.platformRegistryRecord.create({
        data: {
          componentId: 'synthetic.ai',
          componentKind: 'AI',
          activeManifestId: aiManifest.id,
          lifecycleState: 'OFFLINE',
          executionEnabled: false,
          reason: 'Gate 1 offline registration',
        },
      })
    ).resolves.toMatchObject({ lifecycleState: 'OFFLINE', executionEnabled: false });
    await expect(
      database.platformManifestRecord.update({
        where: { id: aiManifest.id },
        data: { status: 'ACTIVE' },
      })
    ).rejects.toThrow();

    const serviceManifest = await database.platformManifestRecord.create({
      data: {
        componentId: 'synthetic.service',
        componentKind: 'SERVICE',
        version: '1.0.0',
        status: 'ACTIVE',
        manifest: { id: 'synthetic.service', kind: 'service', version: '1.0.0' },
        manifestDigest: createHash('sha256').update('synthetic.service').digest('hex'),
      },
    });
    const serviceRegistration = await database.platformRegistryRecord.create({
      data: {
        componentId: 'synthetic.service',
        componentKind: 'SERVICE',
        activeManifestId: serviceManifest.id,
        lifecycleState: 'OFFLINE',
        executionEnabled: false,
        reason: 'Feature Flag owner registration',
      },
    });
    await expect(
      database.featureFlagDefinition.create({
        data: {
          name: 'synthetic.invalid-default',
          registryRecordId: serviceRegistration.id,
          description: 'Invalid secure default test.',
          secureDefault: true,
        },
      })
    ).rejects.toThrow();
    const flag = await database.featureFlagDefinition.create({
      data: {
        name: 'synthetic.flag',
        registryRecordId: serviceRegistration.id,
        description: 'Synthetic registered Feature Flag.',
        secureDefault: false,
      },
    });
    await expect(
      database.featureFlagValue.create({
        data: {
          definitionId: flag.id,
          environment: 'test',
          enabled: true,
          reason: 'Synthetic reversible integration action',
        },
      })
    ).resolves.toMatchObject({ enabled: true, version: 1 });
  });
});
