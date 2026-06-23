import { describe, expect, it } from 'vitest';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import {
  OwnerBootstrapCoordinator,
  type ImmutableOwnerRecord,
  type OwnerBootstrapAuditDetails,
  type OwnerBootstrapRequest,
  type OwnerBootstrapSecurityProvider,
  type OwnerBootstrapStore,
  type OwnerSecurityArtifactReferences,
} from '@/identity/owner-bootstrap';

const occurredAt = '2026-06-22T12:00:00.000Z';
const request: OwnerBootstrapRequest = {
  ceremonyId: 'ceremony-test-1',
  candidateSubjectId: 'owner-subject-test',
  constitutionalAcceptance: {
    documentId: 'xaicore-constitution',
    version: '1',
    documentDigest: 'digest-reference-test',
    acceptedAt: occurredAt,
  },
  successorTrustPolicyReference: 'successor-policy/test-v1',
  reason: 'synthetic bootstrap test',
  context: createKernelRequestContext({
    requestId: 'request-bootstrap-test',
    correlationId: 'correlation-bootstrap-test',
    environment: 'test',
    actor: { id: 'bootstrap-test-runner', kind: 'service', authenticated: true },
    requestedAt: occurredAt,
  }),
};

class TestAudit implements KernelAuditWriter {
  readonly events: AuditEvent[] = [];

  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    this.events.push(event);
  }
}

class TestStore implements OwnerBootstrapStore {
  reserved = false;
  record?: ImmutableOwnerRecord;
  completionAudit?: AuditEvent<OwnerBootstrapAuditDetails>;
  failCommit = false;

  async reserve(): Promise<boolean> {
    if (this.reserved || this.record) return false;
    this.reserved = true;
    return true;
  }

  async commit(
    _ceremonyId: string,
    record: ImmutableOwnerRecord,
    auditEvent: AuditEvent<OwnerBootstrapAuditDetails>
  ): Promise<void> {
    if (this.failCommit) throw new Error('synthetic commit failure');
    if (!this.reserved || this.record) throw new Error('invalid test store state');
    this.record = record;
    this.completionAudit = auditEvent;
    this.reserved = false;
  }

  async abort(): Promise<void> {
    this.reserved = false;
  }
}

class TestSecurityProvider implements OwnerBootstrapSecurityProvider {
  authorized = true;
  revoked = false;
  artifacts: OwnerSecurityArtifactReferences = {
    cryptographicOwnerIdentifier: 'owner-identifier-test',
    recoveryKeyReference: 'recovery-reference-test',
    ownershipIntegrityReference: 'integrity-reference-test',
  };

  async authorizeCeremony(): Promise<boolean> {
    return this.authorized;
  }

  async provisionOwnerSecurityArtifacts(): Promise<OwnerSecurityArtifactReferences> {
    return this.artifacts;
  }

  async revokeProvisionedArtifacts(): Promise<void> {
    this.revoked = true;
  }
}

function createCoordinator() {
  const store = new TestStore();
  const security = new TestSecurityProvider();
  const audit = new TestAudit();
  const coordinator = new OwnerBootstrapCoordinator(
    store,
    security,
    audit,
    () => new Date(occurredAt)
  );
  return { store, security, audit, coordinator };
}

describe('Owner Bootstrap ceremony design', () => {
  it('commits one immutable ownership record with a sanitized audit event', async () => {
    const { store, coordinator } = createCoordinator();

    const result = await coordinator.execute(request);

    expect(Object.isFrozen(store.record)).toBe(true);
    expect(Object.isFrozen(store.record?.constitutionalAcceptance)).toBe(true);
    expect(store.record).toEqual(
      expect.objectContaining({
        subjectId: request.candidateSubjectId,
        version: 1,
        cryptographicOwnerIdentifier: 'owner-identifier-test',
      })
    );
    expect(store.completionAudit).toEqual(
      expect.objectContaining({
        id: result.auditEventId,
        type: 'owner.bootstrap.completed',
        outcome: 'succeeded',
      })
    );
    expect(JSON.stringify(store.completionAudit)).not.toContain('recovery-reference-test');
  });

  it('permanently rejects recreation after establishment', async () => {
    const { coordinator, audit } = createCoordinator();
    await coordinator.execute(request);

    await expect(
      coordinator.execute({ ...request, ceremonyId: 'ceremony-test-2' })
    ).rejects.toThrow('cannot be recreated or replaced');
    expect(audit.events.at(-1)).toEqual(
      expect.objectContaining({ outcome: 'denied', target: 'constitutional-owner' })
    );
  });

  it('rejects invalid and unauthorized ceremonies before provisioning', async () => {
    const invalid = createCoordinator();
    await expect(
      invalid.coordinator.execute({ ...request, candidateSubjectId: '' })
    ).rejects.toThrow('request is invalid');
    expect(invalid.store.reserved).toBe(false);

    const unauthorized = createCoordinator();
    unauthorized.security.authorized = false;
    await expect(unauthorized.coordinator.execute(request)).rejects.toThrow(
      'ceremony is not authorized'
    );
    expect(unauthorized.audit.events[0]).toEqual(expect.objectContaining({ outcome: 'denied' }));
  });

  it('rejects incomplete constitutional and successor ceremony inputs', async () => {
    const { coordinator, audit } = createCoordinator();

    await expect(
      coordinator.execute({
        ...request,
        ceremonyId: '',
        reason: '',
        successorTrustPolicyReference: '',
        constitutionalAcceptance: {
          documentId: '',
          version: '',
          documentDigest: '',
          acceptedAt: 'invalid',
        },
      })
    ).rejects.toThrow('request is invalid');
    expect(audit.events).toHaveLength(1);
  });

  it('uses a valid default clock for denied ceremony audit', async () => {
    const store = new TestStore();
    const security = new TestSecurityProvider();
    const audit = new TestAudit();
    security.authorized = false;
    const coordinator = new OwnerBootstrapCoordinator(store, security, audit);

    await expect(coordinator.execute(request)).rejects.toThrow('not authorized');
    expect(Number.isNaN(Date.parse(audit.events[0]?.occurredAt ?? ''))).toBe(false);
  });

  it('aborts reservation and revokes artifacts when atomic commit fails', async () => {
    const { store, security, audit, coordinator } = createCoordinator();
    store.failCommit = true;

    await expect(coordinator.execute(request)).rejects.toThrow('failed safely');

    expect(store.reserved).toBe(false);
    expect(store.record).toBeUndefined();
    expect(security.revoked).toBe(true);
    expect(audit.events.at(-1)).toEqual(expect.objectContaining({ outcome: 'failed' }));
  });

  it('fails safely when security artifact references are incomplete', async () => {
    const { store, security, coordinator } = createCoordinator();
    security.artifacts = { ...security.artifacts, recoveryKeyReference: '' };

    await expect(coordinator.execute(request)).rejects.toThrow('failed safely');
    expect(store.record).toBeUndefined();
    expect(security.revoked).toBe(true);
  });
});
