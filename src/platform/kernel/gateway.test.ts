import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import { InMemoryKernelEventRouter } from '@/platform/events/router';
import { createKernelRequestContext } from '@/platform/kernel/context';
import type { KernelComponentPort } from '@/platform/kernel/contracts';
import { DefaultKernelGateway } from '@/platform/kernel/gateway';
import type { KernelPermissionEngine } from '@/platform/permissions/contracts';

const now = new Date('2026-06-22T20:00:00.000Z');

class AuditCapture implements KernelAuditWriter {
  readonly events: AuditEvent[] = [];
  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    this.events.push(event);
  }
}

function permissions(effect: 'allow' | 'deny'): KernelPermissionEngine {
  return {
    evaluate: vi.fn().mockResolvedValue({
      decisionId: 'decision-1',
      effect,
      reason: `synthetic ${effect}`,
      policyVersion: 'test-v1',
      decidedAt: now.toISOString(),
      constitutionalAuthority: effect === 'allow' ? ['owner'] : [],
    }),
  };
}

function context() {
  return createKernelRequestContext({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    environment: 'test',
    actor: { id: 'owner-1', kind: 'owner', authenticated: true },
    requestedAt: now.toISOString(),
  });
}

function createGateway(effect: 'allow' | 'deny' = 'allow') {
  const audit = new AuditCapture();
  const events = new InMemoryKernelEventRouter();
  const observed: string[] = [];
  events.subscribe({
    eventTypes: [
      'kernel.operation.requested',
      'kernel.permission.evaluated',
      'kernel.operation.succeeded',
      'kernel.operation.failed',
    ],
    handle: async (event) => {
      observed.push(event.type);
    },
  });
  return {
    gateway: new DefaultKernelGateway(
      permissions(effect),
      audit,
      events,
      () => now,
      (() => {
        let id = 0;
        return () => `event-${++id}`;
      })()
    ),
    audit,
    observed,
  };
}

describe('DefaultKernelGateway', () => {
  it('routes allowed operations and correlates success audit and events', async () => {
    const { gateway, audit, observed } = createGateway();
    const handle = vi.fn().mockResolvedValue({ registered: true });
    gateway.register({
      componentId: 'platform.registry',
      capabilities: ['registry.write'],
      handle,
    });

    const result = await gateway.execute({
      context: context(),
      target: 'platform.registry',
      capability: 'registry.write',
      action: 'register',
      payload: { componentId: 'test.service', reason: 'Owner-approved registration' },
    });

    expect(result).toMatchObject({ accepted: true, result: { registered: true } });
    expect(handle).toHaveBeenCalledOnce();
    expect(audit.events).toEqual([
      expect.objectContaining({
        outcome: 'succeeded',
        reason: 'Owner-approved registration',
        permissionDecisionId: 'decision-1',
      }),
    ]);
    expect(observed).toEqual([
      'kernel.operation.requested',
      'kernel.permission.evaluated',
      'kernel.operation.succeeded',
    ]);
  });

  it('does not route denied operations', async () => {
    const { gateway, audit } = createGateway('deny');
    const port: KernelComponentPort = {
      componentId: 'platform.registry',
      capabilities: ['registry.write'],
      handle: vi.fn(),
    };
    gateway.register(port);

    const result = await gateway.execute({
      context: context(),
      target: 'platform.registry',
      capability: 'registry.write',
      action: 'update',
    });

    expect(result.accepted).toBe(false);
    expect(port.handle).not.toHaveBeenCalled();
    expect(audit.events).toEqual([]);
  });

  it('fails closed for missing capabilities and component failures', async () => {
    const unavailable = createGateway();
    unavailable.gateway.register({
      componentId: 'platform.registry',
      capabilities: ['registry.read'],
      handle: vi.fn(),
    });
    await expect(
      unavailable.gateway.execute({
        context: context(),
        target: 'platform.registry',
        capability: 'registry.write',
        action: 'register',
      })
    ).resolves.toMatchObject({ accepted: false, message: 'Operation unavailable' });
    expect(unavailable.audit.events[0]).toMatchObject({ outcome: 'failed' });

    const failed = createGateway();
    failed.gateway.register({
      componentId: 'platform.registry',
      capabilities: ['registry.read'],
      handle: vi.fn().mockRejectedValue(new Error('private repository failure')),
    });
    await expect(
      failed.gateway.read({
        context: context(),
        target: 'platform.registry',
        capability: 'registry.read',
        action: 'list',
      })
    ).resolves.toMatchObject({ accepted: false, message: 'Operation failed' });
    expect(failed.observed).toContain('kernel.operation.failed');
  });

  it('rejects invalid and duplicate component registration', () => {
    const { gateway } = createGateway();
    expect(() => gateway.register({ componentId: '', capabilities: [], handle: vi.fn() })).toThrow(
      'invalid'
    );
    const port: KernelComponentPort = {
      componentId: 'platform.registry',
      capabilities: ['registry.read'],
      handle: vi.fn(),
    };
    gateway.register(port);
    expect(() => gateway.register(port)).toThrow('already registered');
  });

  it('uses production IDs, timestamps, fallback reasons, and non-Error failure metadata', async () => {
    const audit = new AuditCapture();
    const events = new InMemoryKernelEventRouter();
    const observed: unknown[] = [];
    events.subscribe({
      eventTypes: ['kernel.operation.failed'],
      handle: async (event) => {
        observed.push(event.payload);
      },
    });
    const gateway = new DefaultKernelGateway(permissions('allow'), audit, events);
    gateway.register({
      componentId: 'platform.registry',
      capabilities: ['registry.read'],
      handle: vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce('synthetic string failure'),
    });

    await expect(
      gateway.execute({
        context: context(),
        target: 'platform.registry',
        capability: 'registry.read',
        action: 'read',
        payload: {},
      })
    ).resolves.toMatchObject({ accepted: true });
    await expect(
      gateway.execute({
        context: context(),
        target: 'platform.registry',
        capability: 'registry.read',
        action: 'read',
        payload: {},
      })
    ).resolves.toMatchObject({ accepted: false });

    expect(audit.events[0]).toMatchObject({
      reason: 'Kernel operation completed under explicit policy',
    });
    expect(audit.events[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(observed).toEqual([expect.objectContaining({ errorType: 'UnknownError' })]);
  });
});
