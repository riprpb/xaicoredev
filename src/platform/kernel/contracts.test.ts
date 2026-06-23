import { describe, expect, it } from 'vitest';
import { toPermissionRequest } from '@/platform/kernel/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';

const requestedAt = '2026-06-22T12:00:00.000Z';

describe('Kernel foundation contracts', () => {
  it('creates an immutable authenticated request context', () => {
    const context = createKernelRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      environment: 'test',
      actor: { id: 'owner-1', kind: 'owner', authenticated: true },
      requestedAt,
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.actor)).toBe(true);
  });

  it('rejects actor context that bypasses authentication', () => {
    expect(() =>
      createKernelRequestContext({
        requestId: 'request-1',
        correlationId: 'correlation-1',
        environment: 'test',
        actor: { id: 'service-1', kind: 'service', authenticated: false },
        requestedAt,
      })
    ).toThrow('Unauthenticated Kernel actors must be anonymous');
  });

  it('maps every operation to a permission evaluation request', () => {
    const context = createKernelRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      environment: 'test',
      actor: { id: 'service-1', kind: 'service', authenticated: true },
      requestedAt,
    });

    expect(
      toPermissionRequest({
        context,
        target: 'platform.registry',
        capability: 'registry.read',
        action: 'list',
      })
    ).toEqual({
      resource: 'platform.registry',
      action: 'list',
      attributes: { capability: 'registry.read' },
    });
  });

  it('maps Kernel-managed reads to permission evaluation', () => {
    const context = createKernelRequestContext({
      requestId: 'request-2',
      correlationId: 'correlation-2',
      environment: 'test',
      actor: { id: 'haley.core', kind: 'service', authenticated: true },
      requestedAt,
    });

    expect(
      toPermissionRequest({
        context,
        target: 'platform.health',
        capability: 'health.read',
        action: 'list',
      })
    ).toEqual({
      resource: 'platform.health',
      action: 'list',
      attributes: { capability: 'health.read' },
    });
  });
});
