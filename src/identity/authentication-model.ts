export type IdentityRecordStatus = 'active' | 'suspended' | 'disabled' | 'deleted';
export type CredentialStatus = 'active' | 'suspended' | 'revoked' | 'expired';
export type SessionStatus = 'active' | 'revoked' | 'expired';
export type DeviceStatus = 'recognized' | 'trusted' | 'revoked';
export type FactorStatus = 'pending' | 'active' | 'revoked';
export type AuthenticationAssurance = 'single-factor' | 'multi-factor' | 'phishing-resistant';

export interface UserIdentity {
  subjectId: string;
  status: IdentityRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialReference {
  credentialId: string;
  subjectId: string;
  providerId: string;
  credentialType: string;
  status: CredentialStatus;
  materialReference: string;
  createdAt: string;
  upgradedAt?: string;
}

export interface IdentityProviderLink {
  linkId: string;
  subjectId: string;
  providerId: string;
  externalSubjectReference: string;
  status: 'active' | 'revoked';
  linkedAt: string;
  revokedAt?: string;
}

export interface DeviceRegistration {
  deviceId: string;
  subjectId: string;
  status: DeviceStatus;
  registeredAt: string;
  lastSeenAt: string;
  revokedAt?: string;
}

export interface MfaFactorReference {
  factorId: string;
  subjectId: string;
  providerId: string;
  factorType: string;
  status: FactorStatus;
  materialReference: string;
  enrolledAt: string;
  verifiedAt?: string;
  revokedAt?: string;
}

export interface RecoveryMethodReference {
  recoveryMethodId: string;
  subjectId: string;
  providerId: string;
  methodType: string;
  status: FactorStatus;
  materialReference: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface AuthenticatedSession {
  sessionId: string;
  subjectId: string;
  status: SessionStatus;
  assurance: AuthenticationAssurance;
  authenticatedAt: string;
  expiresAt: string;
  deviceId?: string;
  providerSessionReference?: string;
  revokedAt?: string;
  revocationReason?: string;
  revocationCorrelationId?: string;
}

export interface SessionRevocationRequest {
  sessionId: string;
  actorId: string;
  reason: string;
  correlationId: string;
  revokedAt: string;
}

export interface IdentityAggregate {
  identity: UserIdentity;
  credentials: readonly CredentialReference[];
  providerLinks: readonly IdentityProviderLink[];
  devices: readonly DeviceRegistration[];
  factors: readonly MfaFactorReference[];
  recoveryMethods: readonly RecoveryMethodReference[];
  sessions: readonly AuthenticatedSession[];
}

export interface IdentityValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function isSessionActive(
  identity: UserIdentity,
  session: AuthenticatedSession,
  at: Date = new Date()
): boolean {
  if (identity.status !== 'active' || session.status !== 'active') return false;
  if (identity.subjectId !== session.subjectId) return false;
  const authenticatedAt = Date.parse(session.authenticatedAt);
  const expiresAt = Date.parse(session.expiresAt);
  if (Number.isNaN(authenticatedAt) || Number.isNaN(expiresAt)) return false;
  return authenticatedAt <= at.getTime() && expiresAt > at.getTime();
}

export function revokeSession(
  session: AuthenticatedSession,
  request: SessionRevocationRequest
): AuthenticatedSession {
  if (request.sessionId !== session.sessionId) {
    throw new Error('Session revocation target does not match');
  }
  if (!request.actorId.trim()) throw new Error('Session revocation actor is required');
  if (!request.reason.trim()) throw new Error('Session revocation reason is required');
  if (!request.correlationId.trim()) {
    throw new Error('Session revocation correlation ID is required');
  }
  if (Number.isNaN(Date.parse(request.revokedAt))) {
    throw new Error('Session revocation timestamp is invalid');
  }
  if (session.status === 'revoked') return session;

  return {
    ...session,
    status: 'revoked',
    revokedAt: request.revokedAt,
    revocationReason: request.reason,
    revocationCorrelationId: request.correlationId,
  };
}

export function validateIdentityAggregate(aggregate: IdentityAggregate): IdentityValidationResult {
  const errors: string[] = [];
  const subjectId = aggregate.identity.subjectId;
  if (!subjectId.trim()) errors.push('identity subjectId is required');
  if (!isTimestamp(aggregate.identity.createdAt)) {
    errors.push('identity createdAt must be a valid timestamp');
  }
  if (!isTimestamp(aggregate.identity.updatedAt)) {
    errors.push('identity updatedAt must be a valid timestamp');
  }

  const records = [
    ...aggregate.credentials,
    ...aggregate.providerLinks,
    ...aggregate.devices,
    ...aggregate.factors,
    ...aggregate.recoveryMethods,
    ...aggregate.sessions,
  ];
  if (records.some((record) => record.subjectId !== subjectId)) {
    errors.push('identity records must belong to the aggregate subject');
  }
  if (
    aggregate.credentials.some(
      (credential) =>
        !credential.credentialId.trim() ||
        !credential.providerId.trim() ||
        !credential.credentialType.trim() ||
        !credential.materialReference.trim()
    )
  ) {
    errors.push('credential references require identity and material metadata');
  }
  if (
    aggregate.factors.some(
      (factor) =>
        !factor.factorId.trim() ||
        !factor.providerId.trim() ||
        !factor.factorType.trim() ||
        !factor.materialReference.trim()
    )
  ) {
    errors.push('MFA factors require identity and material metadata');
  }
  if (
    aggregate.recoveryMethods.some(
      (method) =>
        !method.recoveryMethodId.trim() ||
        !method.providerId.trim() ||
        !method.methodType.trim() ||
        !method.materialReference.trim()
    )
  ) {
    errors.push('recovery methods require identity and material metadata');
  }
  if (
    aggregate.sessions.some(
      (session) =>
        !session.sessionId.trim() ||
        !isTimestamp(session.authenticatedAt) ||
        !isTimestamp(session.expiresAt)
    )
  ) {
    errors.push('sessions require identity and valid timestamps');
  }

  return { valid: errors.length === 0, errors };
}

function isTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
