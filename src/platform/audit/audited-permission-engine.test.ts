import { describe, expect, it, vi } from 'vitest';
import { AuditedPermissionEngine } from '@/platform/audit/audited-permission-engine';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import type { KernelPermissionEngine } from '@/platform/permissions/contracts';

const occurredAt = '2026-06-22T16:00:00.000Z';

function context() {
  return createKernelRequestContext({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    environment: 'test',
    actor: { id: 'owner-1', kind: 'owner', authenticated: true },
    requestedAt: occurredAt,
  });
}

function permission(effect: 'allow' | 'deny'): KernelPermissionEngine {
  return {
    evaluate: vi.fn().mockResolvedValue({
      decisionId: 'decision-1',
      effect,
      reason: `synthetic ${effect}`,
      policyVersion: 'policy-v1',
      decidedAt: occurredAt,
      constitutionalAuthority: ['owner'],
    }),
  };
}

class CapturingAudit implements KernelAuditWriter {
  readonly events: AuditEvent[] = [];

  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    this.events.push(event);
  }
}

describe('AuditedPermissionEngine', () => {
  it.each([
    ['allow', 'allowed'],
    ['deny', 'denied'],
  ] as const)('persists %s decisions with correlation and authority', async (effect, outcome) => {
    const audit = new CapturingAudit();
    const engine = new AuditedPermissionEngine(permission(effect), audit, () => 'audit-1');

    const decision = await engine.evaluate(context(), {
      resource: 'platform.health',
      action: 'read',
      targetId: 'status-1',
      attributes: { capability: 'health.read' },
    });

    expect(decision.effect).toBe(effect);
    expect(audit.events).toEqual([
      expect.objectContaining({
        id: 'audit-1',
        outcome,
        permissionDecisionId: 'decision-1',
        constitutionalAuthority: ['owner'],
        context: expect.objectContaining({ correlationId: 'correlation-1' }),
        details: {
          policyVersion: 'policy-v1',
          capability: 'health.read',
          targetId: 'status-1',
        },
      }),
    ]);
  });

  it('fails closed when the decision cannot be audited', async () => {
    const audit: KernelAuditWriter = {
      append: vi.fn().mockRejectedValue(new Error('audit unavailable')),
    };
    const engine = new AuditedPermissionEngine(permission('allow'), audit);

    await expect(
      engine.evaluate(context(), { resource: 'platform.health', action: 'read' })
    ).rejects.toThrow('audit unavailable');
  });
});
