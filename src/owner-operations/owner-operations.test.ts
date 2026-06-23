import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '@/config/environment';
import { OwnerOperationsService } from '@/owner-operations/service';
import type { KernelAuditReader } from '@/platform/audit/contracts';
import type { KernelGateway, KernelOperationResult } from '@/platform/kernel/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import { createApp, type AppObservability } from '@/server/app';

const servers: Server[] = [];
const context = createKernelRequestContext({
  requestId: 'request-1',
  correlationId: 'correlation-1',
  environment: 'test',
  actor: { id: 'owner-1', kind: 'owner', authenticated: true },
  requestedAt: '2026-06-22T20:00:00.000Z',
});
const config: ServerConfig = {
  environment: 'test',
  host: '127.0.0.1',
  port: 3000,
  allowedOrigins: ['http://localhost:5173'],
  apiRateLimit: 100,
  apiRateWindowMs: 60_000,
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
  );
});

function result<T>(value: T): KernelOperationResult<T> {
  return {
    requestId: 'request-1',
    correlationId: 'correlation-1',
    accepted: true,
    permission: {
      decisionId: 'decision-1',
      effect: 'allow',
      reason: 'synthetic allow',
      policyVersion: 'test-v1',
      decidedAt: '2026-06-22T20:00:00.000Z',
      constitutionalAuthority: ['owner'],
    },
    result: value,
  };
}

function services() {
  const kernel: KernelGateway = {
    register: vi.fn(),
    read: vi.fn(async (request) => {
      if (request.target === 'platform.registry') return result([]);
      if (request.target === 'platform.feature-flags') return result([]);
      return result({ status: 'healthy' });
    }) as unknown as KernelGateway['read'],
    execute: vi.fn().mockResolvedValue(
      result({
        name: 'test.flag',
        enabled: true,
        source: 'persistent-registry',
        reason: 'Owner-approved test',
      })
    ),
  };
  const audit: KernelAuditReader = {
    get: vi.fn(),
    listByCorrelationId: vi.fn().mockResolvedValue([
      {
        id: 'audit-1',
        type: 'kernel.operation.succeeded',
        action: 'update',
        target: 'platform.feature-flags',
        outcome: 'succeeded',
        reason: 'Owner-approved test',
        occurredAt: '2026-06-22T20:00:00.000Z',
        context,
      },
    ]),
  };
  return { kernel, audit, operations: new OwnerOperationsService(kernel, audit) };
}

async function start(ownerOperations: AppObservability['ownerOperations']) {
  const server = createApp(config, { ownerOperations, logSink: { write: vi.fn() } }).listen(
    0,
    '127.0.0.1'
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('Owner Operations Slice', () => {
  it('aggregates Kernel-managed status and correlated flag audit evidence', async () => {
    const { kernel, operations } = services();
    await expect(operations.getStatus(context)).resolves.toMatchObject({
      available: true,
      registry: [],
      featureFlags: [],
    });
    await expect(
      operations.updateFeatureFlag(context, 'test.flag', true, 'Owner-approved test')
    ).resolves.toMatchObject({
      operation: { accepted: true },
      audit: [{ id: 'audit-1' }],
    });
    expect(kernel.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'platform.feature-flags',
        payload: expect.objectContaining({ reason: 'Owner-approved test' }),
      })
    );
    await expect(operations.updateFeatureFlag(context, 'test.flag', true, '')).rejects.toThrow(
      'reason'
    );
  });

  it('mounts only with an authenticator and enforces authentication, CSRF, and reason', async () => {
    const { operations } = services();
    const authenticate = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ context, csrfToken: 'csrf-test-token' });
    const baseUrl = await start({ operations, authenticator: { authenticate } });

    expect((await fetch(`${baseUrl}/api/owner/status`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/owner/status`)).status).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/owner/feature-flags/test.flag`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: true, reason: 'Owner-approved test' }),
        })
      ).status
    ).toBe(403);
    expect(
      (
        await fetch(`${baseUrl}/api/owner/feature-flags/test.flag`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-wrong-toke' },
          body: JSON.stringify({ enabled: true, reason: 'Owner-approved test' }),
        })
      ).status
    ).toBe(403);
    expect(
      (
        await fetch(`${baseUrl}/api/owner/feature-flags/test.flag`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-test-token' },
          body: JSON.stringify({ enabled: 'yes', reason: '' }),
        })
      ).status
    ).toBe(400);
    expect(
      (
        await fetch(`${baseUrl}/api/owner/feature-flags/test.flag`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-csrf-token': 'csrf-test-token' },
          body: JSON.stringify({ enabled: true, reason: 'Owner-approved test' }),
        })
      ).status
    ).toBe(200);
  });

  it('reports degraded Kernel reads without inventing status data', async () => {
    const denied = result<unknown>(undefined);
    denied.accepted = false;
    const kernel: KernelGateway = {
      register: vi.fn(),
      read: vi.fn().mockResolvedValue(denied) as unknown as KernelGateway['read'],
      execute: vi.fn(),
    };
    const audit: KernelAuditReader = { get: vi.fn(), listByCorrelationId: vi.fn() };
    const operations = new OwnerOperationsService(kernel, audit);

    await expect(operations.getStatus(context)).resolves.toMatchObject({
      available: false,
      registry: [],
      featureFlags: [],
    });
  });

  it('forwards authentication and operation failures to the generic HTTP boundary', async () => {
    const first = services();
    const authenticationFailure = await start({
      operations: first.operations,
      authenticator: { authenticate: vi.fn().mockRejectedValue(new Error('private auth error')) },
    });
    expect((await fetch(`${authenticationFailure}/api/owner/status`)).status).toBe(500);

    const second = services();
    (second.kernel.read as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('private status error')
    );
    const statusFailure = await start({
      operations: second.operations,
      authenticator: { authenticate: vi.fn().mockResolvedValue({ context, csrfToken: 'token' }) },
    });
    expect((await fetch(`${statusFailure}/api/owner/status`)).status).toBe(500);

    const third = services();
    (third.kernel.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('private mutation error')
    );
    const mutationFailure = await start({
      operations: third.operations,
      authenticator: { authenticate: vi.fn().mockResolvedValue({ context, csrfToken: 'token' }) },
    });
    expect(
      (
        await fetch(`${mutationFailure}/api/owner/feature-flags/test.flag`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'x-csrf-token': 'token' },
          body: JSON.stringify({ enabled: true, reason: 'Owner-approved test' }),
        })
      ).status
    ).toBe(500);
  });
});
