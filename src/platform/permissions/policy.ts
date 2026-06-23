import { randomUUID } from 'node:crypto';
import type { AuthenticationAssurance } from '@/identity/authentication-model';
import type { ConstitutionalRole } from '@/identity/model';
import type { KernelActorKind, KernelRequestContext } from '@/platform/kernel/context';
import type {
  AuthorizationSubject,
  AuthorizationSubjectResolver,
  KernelPermissionEngine,
  PermissionDecision,
  PermissionRequest,
} from '@/platform/permissions/contracts';

export const PERMISSION_POLICY_VERSION = 'gate1-permissions-v1';
export const OWNER_REAUTHENTICATION_MAX_AGE_MS = 5 * 60 * 1000;

interface PermissionRule {
  resource: string;
  actions: readonly string[];
  capability: string;
  roles: readonly ConstitutionalRole[];
  capabilityActorKinds: readonly KernelActorKind[];
  privileged?: boolean;
}

export const PERMISSION_MATRIX: readonly PermissionRule[] = Object.freeze([
  readRule('platform.health', ['read', 'list', 'inspect', 'report'], 'health.read'),
  readRule('platform.manifests', ['read', 'list', 'inspect'], 'manifests.read'),
  readRule('platform.registry', ['read', 'list', 'inspect'], 'registry.read'),
  readRule('platform.feature-flags', ['read', 'list', 'inspect'], 'feature-flags.read'),
  readRule('platform.audit', ['read', 'list', 'inspect'], 'audit.read'),
  readRule('platform.repository', ['inspect'], 'repository.status.read'),
  readRule('platform.architecture', ['inspect', 'report'], 'architecture.read'),
  readRule('platform.logs', ['summarize'], 'logs.summary.read'),
  readRule('platform.configuration', ['read', 'inspect'], 'configuration.read'),
  readRule('platform.memory', ['read', 'list', 'inspect'], 'memory.read'),
  ownerReservedRule('platform.registry', ['register', 'update', 'unregister'], 'registry.write'),
  ownerReservedRule('platform.feature-flags', ['register', 'update'], 'feature-flags.write'),
  ownerReservedRule('platform.lifecycle', ['shutdown', 'restart'], 'platform.lifecycle.control'),
  ownerReservedRule('platform.recovery', ['restore'], 'platform.recovery.execute'),
  ownerReservedRule('platform.deployment', ['deploy'], 'platform.deployment.execute'),
  ownerReservedRule('platform.policy', ['change'], 'platform.policy.change'),
]);

export class PolicyPermissionEngine implements KernelPermissionEngine {
  constructor(
    private readonly subjects: AuthorizationSubjectResolver,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  async evaluate(
    context: KernelRequestContext,
    request: PermissionRequest
  ): Promise<PermissionDecision> {
    const decidedAt = this.now();
    if (!context.actor.authenticated || !context.actor.id) {
      return this.deny('authenticated actor required', decidedAt);
    }
    const subject = await this.subjects.resolve(context);
    if (!subject || subject.subjectId !== context.actor.id) {
      return this.deny('authorization subject unavailable', decidedAt);
    }
    const rule = PERMISSION_MATRIX.find(
      (candidate) =>
        candidate.resource === request.resource && candidate.actions.includes(request.action)
    );
    if (!rule) {
      return this.deny(
        'operation is not registered in policy',
        decidedAt,
        subject.constitutionalRoles
      );
    }

    const capability = readStringAttribute(request, 'capability');
    if (capability !== rule.capability) {
      return this.deny(
        'required capability does not match the operation',
        decidedAt,
        subject.constitutionalRoles
      );
    }

    const hasRole = rule.roles.some((role) => subject.constitutionalRoles.includes(role));
    const hasCapability =
      rule.capabilityActorKinds.includes(context.actor.kind) &&
      subject.capabilities.includes(rule.capability);
    if (!hasRole && !hasCapability) {
      return this.deny(
        'subject is not authorized by policy',
        decidedAt,
        subject.constitutionalRoles
      );
    }
    if (rule.privileged) {
      const privilegedDenial = validateOwnerReservedRequest(context, request, subject, decidedAt);
      if (privilegedDenial) {
        return this.deny(privilegedDenial, decidedAt, subject.constitutionalRoles);
      }
    }
    return this.allow('explicit policy rule satisfied', decidedAt, subject.constitutionalRoles);
  }

  private allow(
    reason: string,
    at: Date,
    authority: readonly ConstitutionalRole[] = []
  ): PermissionDecision {
    return this.decision('allow', reason, at, authority);
  }

  private deny(
    reason: string,
    at: Date,
    authority: readonly ConstitutionalRole[] = []
  ): PermissionDecision {
    return this.decision('deny', reason, at, authority);
  }

  private decision(
    effect: PermissionDecision['effect'],
    reason: string,
    at: Date,
    authority: readonly ConstitutionalRole[]
  ): PermissionDecision {
    return Object.freeze({
      decisionId: this.createId(),
      effect,
      reason,
      policyVersion: PERMISSION_POLICY_VERSION,
      decidedAt: at.toISOString(),
      constitutionalAuthority: [...authority],
    });
  }
}

function readRule(
  resource: string,
  actions: readonly string[],
  capability: string
): PermissionRule {
  return {
    resource,
    actions,
    capability,
    roles: ['owner', 'operational-administrator'],
    capabilityActorKinds: ['service', 'ai', 'user'],
  };
}

function ownerReservedRule(
  resource: string,
  actions: readonly string[],
  capability: string
): PermissionRule {
  return {
    resource,
    actions,
    capability,
    roles: ['owner'],
    capabilityActorKinds: [],
    privileged: true,
  };
}

function validateOwnerReservedRequest(
  context: KernelRequestContext,
  request: PermissionRequest,
  subject: AuthorizationSubject,
  now: Date
): string | undefined {
  if (context.actor.kind !== 'owner' || !subject.constitutionalRoles.includes('owner')) {
    return 'active Owner authority is required';
  }
  if (!readStringAttribute(request, 'reason')?.trim()) {
    return 'Owner-reserved operations require a reason';
  }
  if (!meetsAssurance(subject.assurance, 'multi-factor')) {
    return 'Owner-reserved operations require multi-factor assurance';
  }
  const reauthenticatedAt = Date.parse(subject.reauthenticatedAt ?? '');
  const age = now.getTime() - reauthenticatedAt;
  if (Number.isNaN(reauthenticatedAt) || age < 0 || age > OWNER_REAUTHENTICATION_MAX_AGE_MS) {
    return 'fresh Owner reauthentication is required';
  }
  return undefined;
}

function readStringAttribute(request: PermissionRequest, name: string): string | undefined {
  const value = request.attributes?.[name];
  return typeof value === 'string' ? value : undefined;
}

const ASSURANCE_LEVEL: Readonly<Record<AuthenticationAssurance, number>> = {
  'single-factor': 1,
  'multi-factor': 2,
  'phishing-resistant': 3,
};

function meetsAssurance(
  actual: AuthenticationAssurance,
  required: AuthenticationAssurance
): boolean {
  return ASSURANCE_LEVEL[actual] >= ASSURANCE_LEVEL[required];
}
