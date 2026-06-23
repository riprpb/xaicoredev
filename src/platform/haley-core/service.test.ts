import { describe, expect, it } from 'vitest';
import { HALEY_CORE_MANIFEST } from '@/platform/haley-core/manifest';
import { DefaultHaleyCoreMonitor } from '@/platform/haley-core/service';
import type {
  KernelOperationResult,
  KernelReadGateway,
  KernelReadRequest,
} from '@/platform/kernel/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import { validateComponentManifest } from '@/platform/manifests/validation';

const checkedAt = '2026-06-22T12:00:00.000Z';
const context = createKernelRequestContext({
  requestId: 'request-1',
  correlationId: 'correlation-1',
  environment: 'test',
  actor: { id: 'haley.core', kind: 'service', authenticated: true },
  requestedAt: checkedAt,
});

const results: Readonly<Record<string, unknown>> = {
  'platform.manifests': [HALEY_CORE_MANIFEST],
  'platform.registry': [{ componentId: 'haley.core', state: 'registered', updatedAt: checkedAt }],
  'platform.feature-flags': [
    { name: 'kernel', enabled: true, source: 'test', reason: 'configured value' },
  ],
  'platform.health': [
    {
      componentId: 'system.kernel',
      status: 'healthy',
      version: '0.1.0',
      checkedAt,
      dependencies: [],
    },
  ],
  'platform.repository': { revision: 'test-revision', branch: 'main', clean: true },
  'platform.architecture': {
    componentIds: ['system.kernel', 'haley.core'],
    warnings: [],
  },
  'platform.logs': {
    windowStartedAt: checkedAt,
    windowEndedAt: checkedAt,
    counts: { error: 0 },
  },
  'platform.configuration': {
    environment: 'test',
    valid: true,
    descriptorCount: 3,
    issues: [],
  },
};

class TestKernelReadGateway implements KernelReadGateway {
  readonly requests: KernelReadRequest[] = [];

  constructor(
    private readonly failingTarget?: string,
    private readonly deniedTarget?: string
  ) {}

  async read<TResult = unknown>(
    request: KernelReadRequest
  ): Promise<KernelOperationResult<TResult>> {
    this.requests.push(request);
    if (request.target === this.failingTarget) {
      throw new Error('sensitive internal failure');
    }
    const denied = request.target === this.deniedTarget;
    return {
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      accepted: !denied,
      permission: {
        decisionId: `decision-${request.target}`,
        effect: denied ? 'deny' : 'allow',
        reason: denied ? 'explicit deny' : 'test policy',
        policyVersion: '1',
        decidedAt: checkedAt,
        constitutionalAuthority: [],
      },
      result: results[request.target] as TResult,
    };
  }
}

describe('Haley Core monitoring foundation', () => {
  it('uses a valid service manifest with read-only Kernel authority', () => {
    expect(validateComponentManifest(HALEY_CORE_MANIFEST).valid).toBe(true);
    expect(HALEY_CORE_MANIFEST.kind).toBe('service');
    expect(HALEY_CORE_MANIFEST.permissions.every((item) => item.endsWith('.read'))).toBe(true);
    expect(HALEY_CORE_MANIFEST.dependencies.map((item) => item.id)).toEqual(['system.kernel']);
  });

  it('aggregates all awareness through the Kernel read gateway', async () => {
    const kernel = new TestKernelReadGateway();
    const monitor = new DefaultHaleyCoreMonitor(kernel, () => new Date(checkedAt));

    const snapshot = await monitor.inspect(context);

    expect(snapshot.status).toBe('healthy');
    expect(snapshot.manifests).toEqual([HALEY_CORE_MANIFEST]);
    expect(snapshot.registrations[0]?.componentId).toBe('haley.core');
    expect(snapshot.featureFlags[0]?.name).toBe('kernel');
    expect(snapshot.repository?.clean).toBe(true);
    expect(snapshot.configuration?.valid).toBe(true);
    expect(snapshot.diagnostics).toEqual([]);
    expect(kernel.requests).toHaveLength(8);
    expect(kernel.requests.every((request) => request.context === context)).toBe(true);
  });

  it('degrades safely without leaking Kernel source errors', async () => {
    const monitor = new DefaultHaleyCoreMonitor(new TestKernelReadGateway('platform.logs'));

    const snapshot = await monitor.inspect(context);

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.logs).toBeUndefined();
    expect(snapshot.diagnostics).toContainEqual({
      source: 'logs',
      status: 'degraded',
      message: 'Kernel-managed awareness source is unavailable',
    });
    expect(JSON.stringify(snapshot)).not.toContain('sensitive internal failure');
  });

  it('does not consume data denied by the Kernel permission decision', async () => {
    const monitor = new DefaultHaleyCoreMonitor(
      new TestKernelReadGateway(undefined, 'platform.configuration')
    );

    const snapshot = await monitor.inspect(context);

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.configuration).toBeUndefined();
    expect(snapshot.diagnostics).toContainEqual({
      source: 'configuration',
      status: 'degraded',
      message: 'Kernel-managed awareness source is unavailable',
    });
  });
});
