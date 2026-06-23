export const CONSTITUTIONAL_ROLES = [
  'owner',
  'designated-successor',
  'operational-administrator',
] as const;

export type ConstitutionalRole = (typeof CONSTITUTIONAL_ROLES)[number];
export type AuthorityAssignmentStatus = 'active' | 'revoked' | 'expired';
export type EntitlementStatus = 'active' | 'suspended' | 'revoked' | 'expired';

export interface ConstitutionalAuthorityAssignment {
  assignmentId: string;
  subjectId: string;
  role: ConstitutionalRole;
  status: AuthorityAssignmentStatus;
  grantedByAuthorityId: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  version: number;
}

export interface ProductEntitlement {
  entitlementId: string;
  subjectId: string;
  productId: string;
  planId: string;
  capabilities: readonly string[];
  status: EntitlementStatus;
  grantedAt: string;
  expiresAt?: string;
}

export interface ConstitutionalIdentityProfile {
  subjectId: string;
  authorityAssignments: readonly ConstitutionalAuthorityAssignment[];
  productEntitlements: readonly ProductEntitlement[];
}

export interface SuccessorTrustGrant {
  grantId: string;
  subjectId: string;
  grantedByAuthorityId: string;
  scopes: readonly string[];
  activationPolicyId: string;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  version: number;
  integrityProofReference: string;
}

export interface SuccessorGrantValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function hasConstitutionalRole(
  profile: ConstitutionalIdentityProfile,
  role: ConstitutionalRole,
  at: Date = new Date()
): boolean {
  return profile.authorityAssignments.some(
    (assignment) =>
      assignment.subjectId === profile.subjectId &&
      assignment.role === role &&
      assignment.status === 'active' &&
      !isExpired(assignment.expiresAt, at)
  );
}

export function getActiveEntitlementCapabilities(
  profile: ConstitutionalIdentityProfile,
  at: Date = new Date()
): readonly string[] {
  return [
    ...new Set(
      profile.productEntitlements
        .filter(
          (entitlement) =>
            entitlement.subjectId === profile.subjectId &&
            entitlement.status === 'active' &&
            !isExpired(entitlement.expiresAt, at)
        )
        .flatMap((entitlement) => entitlement.capabilities)
    ),
  ];
}

export function validateSuccessorTrustGrant(
  grant: SuccessorTrustGrant
): SuccessorGrantValidationResult {
  const errors: string[] = [];
  if (!grant.grantId.trim()) errors.push('grantId is required');
  if (!grant.subjectId.trim()) errors.push('subjectId is required');
  if (!grant.grantedByAuthorityId.trim()) {
    errors.push('grantedByAuthorityId is required');
  }
  if (grant.subjectId === grant.grantedByAuthorityId) {
    errors.push('successor authority cannot be self-granted');
  }
  if (grant.scopes.length === 0 || grant.scopes.some((scope) => !scope.trim())) {
    errors.push('at least one non-empty scope is required');
  }
  if (!grant.activationPolicyId.trim()) {
    errors.push('activationPolicyId is required');
  }
  if (!Number.isSafeInteger(grant.version) || grant.version <= 0) {
    errors.push('version must be a positive integer');
  }
  if (!grant.integrityProofReference.trim()) {
    errors.push('integrityProofReference is required');
  }
  if (!isTimestamp(grant.issuedAt)) errors.push('issuedAt must be a valid timestamp');
  if (grant.expiresAt && !isTimestamp(grant.expiresAt)) {
    errors.push('expiresAt must be a valid timestamp');
  }
  if (grant.revokedAt && !isTimestamp(grant.revokedAt)) {
    errors.push('revokedAt must be a valid timestamp');
  }
  if (grant.status === 'revoked' && !grant.revokedAt) {
    errors.push('revoked grants require revokedAt');
  }
  return { valid: errors.length === 0, errors };
}

function isExpired(expiresAt: string | undefined, at: Date): boolean {
  if (expiresAt === undefined) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isNaN(expiry) || expiry <= at.getTime();
}

function isTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
