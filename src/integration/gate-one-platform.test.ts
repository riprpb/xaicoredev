import { describe, expect, it } from 'vitest';
import {
  OwnerSessionAuthenticationService,
  type OwnerSessionEvidence,
} from '@/identity/owner-session-authentication';
import { OwnerOperationsService } from '@/owner-operations/service';
import { AuditedPermissionEngine } from '@/platform/audit/audited-permission-engine';
import type { AuditEvent, KernelAuditReader, KernelAuditWriter } from '@/platform/audit/contracts';
import { InMemoryKernelEventRouter } from '@/platform/events/router';
import { DefaultHaleyCoreMonitor } from '@/platform/haley-core/service';
import type { KernelComponentPort, KernelOperationRequest } from '@/platform/kernel/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import { DefaultKernelGateway } from '@/platform/kernel/gateway';
import type { BrainContract, MemoryRegistry } from '@/platform/memory/contracts';
import { MemoryFoundationService } from '@/platform/memory/service';
import type {
  AuthorizationSubject,
  AuthorizationSubjectResolver,
} from '@/platform/permissions/contracts';
import { PolicyPermissionEngine } from '@/platform/permissions/policy';

const now = new Date('2026-06-22T20:00:00.000Z');

class AuditMemory implements KernelAuditWriter, KernelAuditReader {
  readonly events: AuditEvent[] = [];
  async append<TDetails>(event: AuditEvent<TDetails>): Promise<void> {
    this.events.push(event);
  }
  async get(id: string): Promise<AuditEvent | undefined> {
    return this.events.find((event) => event.id === id);
  }
  async listByCorrelationId(correlationId: string): Promise<readonly AuditEvent[]> {
    return this.events.filter((event) => event.context.correlationId === correlationId);
  }
}

class StaticPort implements KernelComponentPort {
  constructor(
    readonly componentId: string,
    readonly capabilities: readonly string[],
    private readonly handler: (request: KernelOperationRequest) => unknown
  ) {}
  async handle<TResult = unknown>(request: KernelOperationRequest): Promise<TResult> {
    return this.handler(request) as TResult;
  }
}

describe('Gate 1 integrated platform validation', () => {
  it('operates Kernel, Registry, Memory, Haley, Owner auth, permissions, and audit together', async () => {
    const ownerEvidence: OwnerSessionEvidence = {
      sessionId: 'session-owner',
      subjectId: 'owner-subject',
      status: 'active',
      assurance: 'multi-factor',
      constitutionalRoles: ['owner'],
      capabilities: [],
      authenticatedAt: '2026-06-22T19:00:00.000Z',
      reauthenticatedAt: '2026-06-22T19:59:00.000Z',
      expiresAt: '2026-06-22T21:00:00.000Z',
    };
    const authentication = new OwnerSessionAuthenticationService(
      { verifyTokenHash: async () => ownerEvidence },
      () => 'generated-id'
    );
    const owner = await authentication.authenticate({
      sessionToken: 'synthetic-owner-session',
      environment: 'test',
      requestId: 'owner-request',
      correlationId: 'integration-correlation',
      requestedAt: now,
    });
    expect(owner).toBeDefined();
    if (!owner) throw new Error('Synthetic Owner authentication failed');

    const haleySubject: AuthorizationSubject = {
      subjectId: 'haley.core',
      constitutionalRoles: [],
      capabilities: [
        'manifests.read',
        'registry.read',
        'feature-flags.read',
        'health.read',
        'repository.status.read',
        'architecture.read',
        'logs.summary.read',
        'configuration.read',
      ],
      assurance: 'single-factor',
    };
    const subjects: AuthorizationSubjectResolver = {
      resolve: async (context) =>
        context.actor.id === owner.subject.subjectId ? owner.subject : haleySubject,
    };
    const audit = new AuditMemory();
    const permission = new AuditedPermissionEngine(
      new PolicyPermissionEngine(
        subjects,
        () => now,
        () => crypto.randomUUID()
      ),
      audit,
      () => crypto.randomUUID()
    );
    const kernel = new DefaultKernelGateway(
      permission,
      audit,
      new InMemoryKernelEventRouter(),
      () => now,
      () => crypto.randomUUID()
    );

    const brain: BrainContract = {
      id: 'platform-memory',
      name: 'Platform Memory',
      description: 'Foundation metadata only.',
      schemaVersion: '1.0',
      retentionPolicyId: 'test-retention',
      encryptionPolicyId: 'test-encryption',
      supportedOperations: ['read'],
    };
    const memoryRegistry: MemoryRegistry = {
      registerBrain: async () => undefined,
      getBrain: async (id) => (id === brain.id ? brain : undefined),
      listBrains: async () => [brain],
      getPermissions: async () => [],
    };
    kernel.register(new MemoryFoundationService(memoryRegistry));
    kernel.register(new StaticPort('platform.registry', ['registry.read'], () => []));
    kernel.register(
      new StaticPort(
        'platform.feature-flags',
        ['feature-flags.read', 'feature-flags.write'],
        (request) =>
          request.action === 'update'
            ? {
                name: (request.payload as { name: string }).name,
                enabled: (request.payload as { enabled: boolean }).enabled,
                source: 'synthetic-integration',
                reason: (request.payload as { reason: string }).reason,
              }
            : []
      )
    );
    kernel.register(
      new StaticPort('platform.health', ['health.read'], () => [
        {
          componentId: 'xaicore-api',
          status: 'healthy',
          version: '1.0.0',
          checkedAt: now.toISOString(),
          dependencies: [],
        },
      ])
    );
    for (const [target, capability, value] of [
      ['platform.manifests', 'manifests.read', []],
      ['platform.repository', 'repository.status.read', { revision: 'test', clean: true }],
      ['platform.architecture', 'architecture.read', { componentIds: [], warnings: [] }],
      [
        'platform.logs',
        'logs.summary.read',
        { windowStartedAt: now.toISOString(), windowEndedAt: now.toISOString(), counts: {} },
      ],
      [
        'platform.configuration',
        'configuration.read',
        { environment: 'test', valid: true, descriptorCount: 1, issues: [] },
      ],
    ] as const) {
      kernel.register(new StaticPort(target, [capability], () => value));
    }

    await expect(
      kernel.read<readonly BrainContract[]>({
        context: owner.context,
        target: 'platform.memory',
        capability: 'memory.read',
        action: 'list',
      })
    ).resolves.toMatchObject({ accepted: true, result: [brain] });

    const haleyContext = createKernelRequestContext({
      requestId: 'haley-request',
      correlationId: 'haley-correlation',
      environment: 'test',
      actor: { id: 'haley.core', kind: 'service', authenticated: true },
      requestedAt: now.toISOString(),
    });
    await expect(
      new DefaultHaleyCoreMonitor(kernel, () => now).inspect(haleyContext)
    ).resolves.toMatchObject({ status: 'healthy', diagnostics: [] });

    const ownerOperations = new OwnerOperationsService(kernel, audit);
    await expect(ownerOperations.getStatus(owner.context)).resolves.toMatchObject({
      available: true,
    });
    await expect(
      ownerOperations.updateFeatureFlag(
        owner.context,
        'test.flag',
        true,
        'Owner-approved reversible integration action'
      )
    ).resolves.toMatchObject({ operation: { accepted: true } });

    expect(audit.events.some((event) => event.type === 'kernel.permission.evaluated')).toBe(true);
    expect(audit.events.some((event) => event.type === 'kernel.operation.succeeded')).toBe(true);
  });
});
