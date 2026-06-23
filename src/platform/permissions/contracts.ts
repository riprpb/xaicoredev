import type { KernelRequestContext } from '@/platform/kernel/context';
import type { AuthenticationAssurance } from '@/identity/authentication-model';
import type { ConstitutionalRole } from '@/identity/model';

export interface PermissionRequest {
  resource: string;
  action: string;
  targetId?: string;
  attributes?: Readonly<Record<string, unknown>>;
}

export interface PermissionDecision {
  decisionId: string;
  effect: 'allow' | 'deny';
  reason: string;
  policyVersion: string;
  decidedAt: string;
  constitutionalAuthority: readonly ConstitutionalRole[];
}

export interface AuthorizationSubject {
  subjectId: string;
  constitutionalRoles: readonly ConstitutionalRole[];
  capabilities: readonly string[];
  assurance: AuthenticationAssurance;
  reauthenticatedAt?: string;
}

export interface AuthorizationSubjectResolver {
  resolve(context: KernelRequestContext): Promise<AuthorizationSubject | undefined>;
}

export interface KernelPermissionEngine {
  evaluate(context: KernelRequestContext, request: PermissionRequest): Promise<PermissionDecision>;
}
