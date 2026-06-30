import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FileOwnerRecoveryWorkflow,
  type SuccessorRecoveryProvisionRequest,
} from '@/identity/owner-recovery-workflow';
import type { SuccessorTrustPolicy } from '@/identity/successor-trust';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';

const directories: string[] = [];
const occurredAt = new Date('2026-06-29T10:00:00.000Z');
const policy: SuccessorTrustPolicy = {
  policyId: 'successor-policy-v1',
  version: 1,
  status: 'active',
  allowedScopes: ['constitutional.continuity'],
  activationPolicyReference: 'activation-policy/v1',
  ownerApprovalRequired: true,
  automaticActivationAllowed: false,
};

class CapturingAudit implements KernelAuditWriter {
  readonly events: AuditEvent[] = [];

  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    this.events.push(event);
  }
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createWorkflow() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'xaicore-owner-recovery-'));
  directories.push(directory);
  const audit = new CapturingAudit();
  const workflow = new FileOwnerRecoveryWorkflow(
    directory,
    audit,
    (() => {
      let value = 0;
      return () => `generated-${++value}`;
    })()
  );
  return { directory, audit, workflow };
}

function createContext() {
  return createKernelRequestContext({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    environment: 'test',
    actor: { id: 'owner-1', kind: 'owner', authenticated: true, sessionId: 'session-1' },
    requestedAt: occurredAt.toISOString(),
  });
}

describe('FileOwnerRecoveryWorkflow', () => {
  it('generates one-time Owner MFA recovery codes, stores only hashes, and restores access once', async () => {
    const { directory, workflow } = await createWorkflow();

    const generated = await workflow.generateRecoveryCodes({
      subjectId: 'owner-1',
      providerId: 'local-owner',
      materialReference: 'private/owner-recovery',
      context: createContext(),
      occurredAt,
    });

    expect(generated.codes).toHaveLength(10);
    expect(new Set(generated.codes).size).toBe(10);

    const stored = await readFile(path.join(directory, 'owner-mfa-recovery.json'), 'utf8');
    for (const code of generated.codes) {
      expect(stored).not.toContain(code);
    }

    const result = await workflow.useRecoveryCode({
      subjectId: 'owner-1',
      recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
      code: generated.codes[0],
      reason: 'Owner lost authenticator device',
      context: createContext(),
      occurredAt,
    });

    expect(result).toEqual(
      expect.objectContaining({
        allowed: true,
        restoredAccess: true,
        authorityChangesAllowed: false,
      })
    );
    const state = await workflow.readRecoveryState();
    expect(state?.codes.filter((record) => record.usedAt)).toHaveLength(1);
  });

  it('prevents recovery code replay and denies invalid codes', async () => {
    const { workflow } = await createWorkflow();
    const generated = await workflow.generateRecoveryCodes({
      subjectId: 'owner-1',
      providerId: 'local-owner',
      materialReference: 'private/owner-recovery',
      context: createContext(),
      occurredAt,
    });

    await expect(
      workflow.useRecoveryCode({
        subjectId: 'owner-1',
        recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
        code: generated.codes[0],
        reason: 'Owner lost authenticator device',
        context: createContext(),
        occurredAt,
      })
    ).resolves.toMatchObject({ allowed: true, restoredAccess: true });

    await expect(
      workflow.useRecoveryCode({
        subjectId: 'owner-1',
        recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
        code: generated.codes[0],
        reason: 'Replay attempt',
        context: createContext(),
        occurredAt,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: false,
        restoredAccess: false,
        authorityChangesAllowed: false,
        reason: 'recovery code replay is denied',
      })
    );

    await expect(
      workflow.useRecoveryCode({
        subjectId: 'owner-1',
        recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
        code: 'FFFF-FFFF-FFFF',
        reason: 'Invalid attempt',
        context: createContext(),
        occurredAt,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: false,
        restoredAccess: false,
        authorityChangesAllowed: false,
        reason: 'recovery code is invalid',
      })
    );
  });

  it('requires successful Owner authentication and MFA verification before regeneration', async () => {
    const { workflow } = await createWorkflow();
    await workflow.generateRecoveryCodes({
      subjectId: 'owner-1',
      providerId: 'local-owner',
      materialReference: 'private/owner-recovery',
      context: createContext(),
      occurredAt,
    });

    await expect(
      workflow.regenerateRecoveryCodes({
        subjectId: 'owner-1',
        providerId: 'local-owner',
        materialReference: 'private/owner-recovery',
        context: createContext(),
        occurredAt,
        authenticated: true,
        mfaVerified: false as true,
      })
    ).rejects.toThrow('requires authenticated MFA verification');
  });

  it('stores successor recovery as a pending opaque protected reference and never auto-activates', async () => {
    const { workflow } = await createWorkflow();
    const request: SuccessorRecoveryProvisionRequest = {
      subjectId: 'owner-1',
      successorSubjectId: 'successor-1',
      providerId: 'local-owner',
      materialReference: 'private/successor-recovery',
      protectedReference: 'opaque/successor-packet-ref',
      reason: 'Owner approved constitutional continuity reference',
      policy,
      context: createContext(),
      occurredAt,
    };

    const state = await workflow.provisionSuccessorRecovery(request);

    expect(state.reference).toEqual(
      expect.objectContaining({
        status: 'pending',
        automaticActivationAllowed: false,
        authorityChangesAllowed: false,
        protectedReference: 'opaque/successor-packet-ref',
      })
    );
    expect(state.recoveryMethod.methodType).toBe('successor-recovery-reference');

    await expect(
      workflow.provisionSuccessorRecovery({
        ...request,
        generateCredentials: true,
      })
    ).rejects.toThrow('require explicit Owner approval');
  });

  it('creates audit records for generation, use, denial, regeneration, and successor provisioning', async () => {
    const { audit, workflow } = await createWorkflow();
    const generated = await workflow.generateRecoveryCodes({
      subjectId: 'owner-1',
      providerId: 'local-owner',
      materialReference: 'private/owner-recovery',
      context: createContext(),
      occurredAt,
    });

    await workflow.useRecoveryCode({
      subjectId: 'owner-1',
      recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
      code: generated.codes[0],
      reason: 'Owner lost authenticator device',
      context: createContext(),
      occurredAt,
    });
    await workflow.useRecoveryCode({
      subjectId: 'owner-1',
      recoveryMethodId: generated.recoveryMethod.recoveryMethodId,
      code: 'FFFF-FFFF-FFFF',
      reason: 'Invalid recovery attempt',
      context: createContext(),
      occurredAt,
    });
    await workflow.regenerateRecoveryCodes({
      subjectId: 'owner-1',
      providerId: 'local-owner',
      materialReference: 'private/owner-recovery-2',
      context: createContext(),
      occurredAt,
      authenticated: true,
      mfaVerified: true,
    });
    await workflow.provisionSuccessorRecovery({
      subjectId: 'owner-1',
      successorSubjectId: 'successor-1',
      providerId: 'local-owner',
      materialReference: 'private/successor-recovery',
      protectedReference: 'opaque/successor-packet-ref',
      reason: 'Owner approved constitutional continuity reference',
      policy,
      context: createContext(),
      occurredAt,
    });

    expect(audit.events.map((event) => event.type)).toEqual([
      'owner.recovery-codes.generated',
      'owner.recovery-codes.used',
      'owner.recovery-codes.used',
      'owner.recovery-codes.regenerated',
      'owner.successor-recovery.provisioned',
    ]);
    expect(audit.events.every((event) => event.constitutionalAuthority?.includes('owner'))).toBe(
      true
    );
  });
});
