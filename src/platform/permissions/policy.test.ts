import { describe, expect, it } from 'vitest';
import { createKernelRequestContext } from '@/platform/kernel/context';
import type {
  AuthorizationSubject,
  AuthorizationSubjectResolver,
  PermissionRequest,
} from '@/platform/permissions/contracts';
import { PolicyPermissionEngine } from '@/platform/permissions/policy';

const now = new Date('2026-06-22T15:00:00.000Z');

class StaticSubjectResolver implements AuthorizationSubjectResolver {
  constructor(private readonly subject?: AuthorizationSubject) {}

  async resolve(): Promise<AuthorizationSubject | undefined> {
    return this.subject;
  }
}

function context(kind: 'owner' | 'administrator' | 'service' | 'ai' = 'owner') {
  return createKernelRequestContext({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    environment: 'test',
    actor: { id: 'subject-1', kind, authenticated: true },
    requestedAt: now.toISOString(),
  });
}

function subject(overrides: Partial<AuthorizationSubject> = {}): AuthorizationSubject {
  return {
    subjectId: 'subject-1',
    constitutionalRoles: ['owner'],
    capabilities: [],
    assurance: 'multi-factor',
    reauthenticatedAt: new Date(now.getTime() - 60_000).toISOString(),
    ...overrides,
  };
}

function request(
  resource: string,
  action: string,
  capability: string,
  attributes: Readonly<Record<string, unknown>> = {}
): PermissionRequest {
  return { resource, action, attributes: { capability, ...attributes } };
}

function engine(resolved?: AuthorizationSubject): PolicyPermissionEngine {
  return new PolicyPermissionEngine(
    new StaticSubjectResolver(resolved),
    () => now,
    () => 'decision-1'
  );
}

describe('PolicyPermissionEngine', () => {
  it('allows explicitly registered reads for active platform authorities', async () => {
    const decision = await engine(
      subject({ constitutionalRoles: ['operational-administrator'] })
    ).evaluate(context('administrator'), request('platform.health', 'read', 'health.read'));

    expect(decision).toMatchObject({
      effect: 'allow',
      decisionId: 'decision-1',
      policyVersion: 'gate1-permissions-v1',
    });
  });

  it('denies unauthenticated, unresolved, mismatched, and unknown subjects by default', async () => {
    const anonymous = createKernelRequestContext({
      requestId: 'request-anonymous',
      correlationId: 'correlation-anonymous',
      environment: 'test',
      actor: { kind: 'anonymous', authenticated: false },
      requestedAt: now.toISOString(),
    });
    const statusRead = request('platform.health', 'read', 'health.read');

    await expect(engine(subject()).evaluate(anonymous, statusRead)).resolves.toMatchObject({
      effect: 'deny',
      reason: 'authenticated actor required',
    });
    await expect(engine().evaluate(context(), statusRead)).resolves.toMatchObject({
      effect: 'deny',
      reason: 'authorization subject unavailable',
    });
    await expect(
      engine(subject({ subjectId: 'different-subject' })).evaluate(context(), statusRead)
    ).resolves.toMatchObject({ effect: 'deny' });
    await expect(
      engine(subject()).evaluate(
        context(),
        request('platform.unknown', 'execute', 'platform.unknown.execute')
      )
    ).resolves.toMatchObject({
      effect: 'deny',
      reason: 'operation is not registered in policy',
    });
  });

  it('requires the exact capability associated with the operation', async () => {
    const decision = await engine(subject()).evaluate(
      context(),
      request('platform.registry', 'read', 'registry.write')
    );

    expect(decision).toMatchObject({
      effect: 'deny',
      reason: 'required capability does not match the operation',
    });
  });

  it('allows services only through explicit capabilities and never lets AI mutate', async () => {
    const serviceDecision = await engine(
      subject({
        constitutionalRoles: [],
        capabilities: ['registry.read'],
        assurance: 'single-factor',
      })
    ).evaluate(context('service'), request('platform.registry', 'list', 'registry.read'));
    const aiDecision = await engine(
      subject({
        constitutionalRoles: [],
        capabilities: ['registry.write'],
        assurance: 'single-factor',
      })
    ).evaluate(context('ai'), request('platform.registry', 'update', 'registry.write'));

    expect(serviceDecision.effect).toBe('allow');
    expect(aiDecision).toMatchObject({
      effect: 'deny',
      reason: 'subject is not authorized by policy',
    });
  });

  it.each([
    ['platform.lifecycle', 'shutdown', 'platform.lifecycle.control'],
    ['platform.lifecycle', 'restart', 'platform.lifecycle.control'],
    ['platform.recovery', 'restore', 'platform.recovery.execute'],
    ['platform.deployment', 'deploy', 'platform.deployment.execute'],
    ['platform.policy', 'change', 'platform.policy.change'],
    ['platform.registry', 'update', 'registry.write'],
    ['platform.feature-flags', 'update', 'feature-flags.write'],
  ])('separates and authorizes Owner-reserved %s %s', async (resource, action, capability) => {
    const decision = await engine(subject()).evaluate(
      context('owner'),
      request(resource, action, capability, { reason: 'Owner-approved test operation' })
    );

    expect(decision.effect).toBe('allow');
  });

  it('requires Owner authority, a reason, MFA, and fresh reauthentication', async () => {
    const privileged = request('platform.lifecycle', 'restart', 'platform.lifecycle.control', {
      reason: 'Controlled maintenance',
    });

    await expect(
      engine(subject({ constitutionalRoles: ['operational-administrator'] })).evaluate(
        context('administrator'),
        privileged
      )
    ).resolves.toMatchObject({ effect: 'deny' });
    await expect(
      engine(subject({ constitutionalRoles: ['owner'] })).evaluate(
        context('administrator'),
        privileged
      )
    ).resolves.toMatchObject({
      effect: 'deny',
      reason: 'active Owner authority is required',
    });
    await expect(
      engine(subject()).evaluate(
        context('owner'),
        request('platform.lifecycle', 'restart', 'platform.lifecycle.control')
      )
    ).resolves.toMatchObject({
      effect: 'deny',
      reason: 'Owner-reserved operations require a reason',
    });
    await expect(
      engine(subject({ assurance: 'single-factor' })).evaluate(context('owner'), privileged)
    ).resolves.toMatchObject({
      effect: 'deny',
      reason: 'Owner-reserved operations require multi-factor assurance',
    });
    await expect(
      engine(
        subject({ reauthenticatedAt: new Date(now.getTime() - 600_000).toISOString() })
      ).evaluate(context('owner'), privileged)
    ).resolves.toMatchObject({
      effect: 'deny',
      reason: 'fresh Owner reauthentication is required',
    });
  });

  it('uses production decision identifiers and timestamps by default', async () => {
    const decision = await new PolicyPermissionEngine(
      new StaticSubjectResolver(subject())
    ).evaluate(context(), request('platform.health', 'read', 'health.read'));

    expect(decision.decisionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(decision.decidedAt))).toBe(false);
  });
});
