import { randomUUID } from 'node:crypto';
import type { SuccessorTrustGrant } from '@/identity/model';

export interface SuccessorTrustPolicy {
  policyId: string;
  version: number;
  status: 'active' | 'retired';
  allowedScopes: readonly string[];
  activationPolicyReference: string;
  ownerApprovalRequired: true;
  automaticActivationAllowed: false;
}

export interface PendingSuccessorGrantRequest {
  subjectId: string;
  grantedByAuthorityId: string;
  scopes: readonly string[];
  expiresAt?: string;
  integrityProofReference: string;
}

export interface SuccessorTrustPolicyValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function validateSuccessorTrustPolicy(
  policy: SuccessorTrustPolicy
): SuccessorTrustPolicyValidationResult {
  const errors: string[] = [];
  if (!policy.policyId.trim()) errors.push('policyId is required');
  if (!Number.isSafeInteger(policy.version) || policy.version <= 0) {
    errors.push('version must be a positive integer');
  }
  if (policy.allowedScopes.length === 0 || policy.allowedScopes.some((scope) => !scope.trim())) {
    errors.push('at least one non-empty allowed scope is required');
  }
  if (new Set(policy.allowedScopes).size !== policy.allowedScopes.length) {
    errors.push('allowed scopes must be unique');
  }
  if (!policy.activationPolicyReference.trim()) {
    errors.push('activationPolicyReference is required');
  }
  if (policy.ownerApprovalRequired !== true) {
    errors.push('Owner approval must be required');
  }
  if (policy.automaticActivationAllowed !== false) {
    errors.push('automatic activation must remain disabled');
  }
  return { valid: errors.length === 0, errors };
}

export function createPendingSuccessorGrant(
  policy: SuccessorTrustPolicy,
  request: PendingSuccessorGrantRequest,
  issuedAt: Date = new Date()
): SuccessorTrustGrant {
  const policyValidation = validateSuccessorTrustPolicy(policy);
  if (!policyValidation.valid || policy.status !== 'active') {
    throw new Error('An active valid successor trust policy is required');
  }
  if (!request.subjectId.trim() || !request.grantedByAuthorityId.trim()) {
    throw new Error('Successor subject and granting Owner authority are required');
  }
  if (request.subjectId === request.grantedByAuthorityId) {
    throw new Error('Successor authority cannot be self-granted');
  }
  if (
    request.scopes.length === 0 ||
    request.scopes.some((scope) => !policy.allowedScopes.includes(scope))
  ) {
    throw new Error('Successor grant scopes must be allowed by policy');
  }
  if (!request.integrityProofReference.trim()) {
    throw new Error('Successor grant integrity reference is required');
  }
  if (request.expiresAt) {
    const expiry = Date.parse(request.expiresAt);
    if (Number.isNaN(expiry) || expiry <= issuedAt.getTime()) {
      throw new Error('Successor grant expiry must be a valid future timestamp');
    }
  }

  return Object.freeze({
    grantId: randomUUID(),
    subjectId: request.subjectId,
    grantedByAuthorityId: request.grantedByAuthorityId,
    scopes: Object.freeze([...request.scopes]),
    activationPolicyId: policy.activationPolicyReference,
    status: 'pending',
    issuedAt: issuedAt.toISOString(),
    expiresAt: request.expiresAt,
    version: 1,
    integrityProofReference: request.integrityProofReference,
  });
}

export function revokeSuccessorGrant(
  grant: SuccessorTrustGrant,
  revokedAt: Date = new Date()
): SuccessorTrustGrant {
  if (grant.status === 'revoked') return grant;
  if (revokedAt.getTime() < Date.parse(grant.issuedAt)) {
    throw new Error('Successor grant revocation cannot predate issuance');
  }
  return Object.freeze({
    ...grant,
    status: 'revoked',
    revokedAt: revokedAt.toISOString(),
    version: grant.version + 1,
  });
}
