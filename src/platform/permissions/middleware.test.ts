import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createKernelRequestContext } from '@/platform/kernel/context';
import type { KernelPermissionEngine } from '@/platform/permissions/contracts';
import { requireKernelPermission } from '@/platform/permissions/middleware';

const now = '2026-06-22T15:00:00.000Z';

function responseWith(context?: ReturnType<typeof createKernelRequestContext>) {
  const response = {
    locals: context ? { kernelContext: context } : {},
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response as unknown as Response;
}

function authenticatedContext() {
  return createKernelRequestContext({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    environment: 'test',
    actor: { id: 'owner-1', kind: 'owner', authenticated: true },
    requestedAt: now,
  });
}

function engineWith(effect: 'allow' | 'deny'): KernelPermissionEngine {
  return {
    evaluate: vi.fn().mockResolvedValue({
      decisionId: 'decision-1',
      effect,
      reason: 'test decision',
      policyVersion: 'test-v1',
      decidedAt: now,
      constitutionalAuthority: [],
    }),
  };
}

describe('requireKernelPermission', () => {
  it('rejects unauthenticated requests before permission evaluation', async () => {
    const engine = engineWith('allow');
    const response = responseWith();
    const next = vi.fn() as NextFunction;
    const middleware = requireKernelPermission({
      engine,
      permission: () => ({ resource: 'platform.health', action: 'read' }),
    });

    await middleware({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(engine.evaluate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a generic denial and preserves the decision for audit', async () => {
    const response = responseWith(authenticatedContext());
    const next = vi.fn() as NextFunction;
    const middleware = requireKernelPermission({
      engine: engineWith('deny'),
      permission: () => ({ resource: 'platform.policy', action: 'change' }),
    });

    await middleware({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.locals.permissionDecision).toMatchObject({ effect: 'deny' });
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Permission denied' })
    );
  });

  it('continues only after an explicit allow decision', async () => {
    const response = responseWith(authenticatedContext());
    const next = vi.fn() as NextFunction;
    const middleware = requireKernelPermission({
      engine: engineWith('allow'),
      permission: () => ({ resource: 'platform.health', action: 'read' }),
    });

    await middleware({} as Request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('fails closed when policy evaluation throws', async () => {
    const response = responseWith(authenticatedContext());
    const next = vi.fn() as NextFunction;
    const engine: KernelPermissionEngine = {
      evaluate: vi.fn().mockRejectedValue(new Error('private policy failure')),
    };
    const middleware = requireKernelPermission({
      engine,
      permission: () => ({ resource: 'platform.health', action: 'read' }),
    });

    await middleware({} as Request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: 'private policy failure' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
