import { describe, expect, it } from 'vitest';
import {
  isSessionActive,
  revokeSession,
  validateIdentityAggregate,
  type AuthenticatedSession,
  type IdentityAggregate,
  type UserIdentity,
} from '@/identity/authentication-model';

const now = new Date('2026-06-22T12:00:00.000Z');
const identity: UserIdentity = {
  subjectId: 'subject-1',
  status: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-22T00:00:00.000Z',
};
const session: AuthenticatedSession = {
  sessionId: 'session-1',
  subjectId: identity.subjectId,
  status: 'active',
  assurance: 'multi-factor',
  authenticatedAt: '2026-06-22T11:00:00.000Z',
  expiresAt: '2026-06-22T13:00:00.000Z',
};

function createAggregate(): IdentityAggregate {
  return {
    identity,
    credentials: [
      {
        credentialId: 'credential-1',
        subjectId: identity.subjectId,
        providerId: 'provider-pending',
        credentialType: 'provider-neutral',
        status: 'active',
        materialReference: 'credentials/credential-1',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    ],
    providerLinks: [],
    devices: [],
    factors: [
      {
        factorId: 'factor-1',
        subjectId: identity.subjectId,
        providerId: 'provider-pending',
        factorType: 'provider-neutral',
        status: 'active',
        materialReference: 'factors/factor-1',
        enrolledAt: '2026-06-22T00:00:00.000Z',
      },
    ],
    recoveryMethods: [
      {
        recoveryMethodId: 'recovery-1',
        subjectId: identity.subjectId,
        providerId: 'provider-pending',
        methodType: 'provider-neutral',
        status: 'active',
        materialReference: 'recovery/recovery-1',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
    ],
    sessions: [session],
  };
}

describe('provider-neutral authentication model', () => {
  it('accepts a complete aggregate without credential material', () => {
    expect(validateIdentityAggregate(createAggregate())).toEqual({
      valid: true,
      errors: [],
    });
    expect(JSON.stringify(createAggregate())).not.toContain('password');
    expect(JSON.stringify(createAggregate())).not.toContain('token');
  });

  it('fails closed for inactive, mismatched, malformed, and expired sessions', () => {
    expect(isSessionActive(identity, session, now)).toBe(true);
    expect(isSessionActive({ ...identity, status: 'suspended' }, session, now)).toBe(false);
    expect(isSessionActive(identity, { ...session, subjectId: 'other' }, now)).toBe(false);
    expect(isSessionActive(identity, { ...session, expiresAt: 'invalid' }, now)).toBe(false);
    expect(isSessionActive(identity, { ...session, authenticatedAt: 'invalid' }, now)).toBe(false);
    expect(
      isSessionActive(identity, { ...session, authenticatedAt: '2026-06-22T12:30:00.000Z' }, now)
    ).toBe(false);
    expect(isSessionActive(identity, session, new Date('2026-06-22T13:00:00.000Z'))).toBe(false);
  });

  it('revokes sessions immutably with audit correlation metadata', () => {
    const revoked = revokeSession(session, {
      sessionId: session.sessionId,
      actorId: identity.subjectId,
      reason: 'user requested sign-out',
      correlationId: 'correlation-1',
      revokedAt: '2026-06-22T12:00:00.000Z',
    });

    expect(revoked).not.toBe(session);
    expect(revoked).toEqual(
      expect.objectContaining({
        status: 'revoked',
        revocationReason: 'user requested sign-out',
        revocationCorrelationId: 'correlation-1',
      })
    );
    expect(
      revokeSession(revoked, {
        sessionId: revoked.sessionId,
        actorId: identity.subjectId,
        reason: 'repeat request',
        correlationId: 'correlation-2',
        revokedAt: '2026-06-22T12:01:00.000Z',
      })
    ).toBe(revoked);
  });

  it('rejects mismatched records and incomplete security references', () => {
    const aggregate = createAggregate();
    const result = validateIdentityAggregate({
      ...aggregate,
      credentials: [
        {
          ...aggregate.credentials[0],
          subjectId: 'other-subject',
          materialReference: '',
        },
      ],
      factors: [{ ...aggregate.factors[0], factorType: '' }],
      recoveryMethods: [{ ...aggregate.recoveryMethods[0], recoveryMethodId: '' }],
      sessions: [{ ...session, authenticatedAt: 'invalid' }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'identity records must belong to the aggregate subject',
        'credential references require identity and material metadata',
        'MFA factors require identity and material metadata',
        'recovery methods require identity and material metadata',
        'sessions require identity and valid timestamps',
      ])
    );
  });

  it('rejects incomplete revocation requests', () => {
    expect(() =>
      revokeSession(session, {
        sessionId: 'other-session',
        actorId: '',
        reason: '',
        correlationId: '',
        revokedAt: 'invalid',
      })
    ).toThrow('Session revocation target does not match');

    const base = {
      sessionId: session.sessionId,
      actorId: identity.subjectId,
      reason: 'revoke',
      correlationId: 'correlation-1',
      revokedAt: '2026-06-22T12:00:00.000Z',
    };
    expect(() => revokeSession(session, { ...base, actorId: '' })).toThrow(
      'Session revocation actor is required'
    );
    expect(() => revokeSession(session, { ...base, reason: '' })).toThrow(
      'Session revocation reason is required'
    );
    expect(() => revokeSession(session, { ...base, correlationId: '' })).toThrow(
      'Session revocation correlation ID is required'
    );
    expect(() => revokeSession(session, { ...base, revokedAt: 'invalid' })).toThrow(
      'Session revocation timestamp is invalid'
    );
  });

  it('rejects malformed identity timestamps and identifiers', () => {
    const aggregate = createAggregate();
    const result = validateIdentityAggregate({
      ...aggregate,
      identity: {
        ...aggregate.identity,
        subjectId: '',
        createdAt: 'invalid',
        updatedAt: 'invalid',
      },
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'identity subjectId is required',
        'identity createdAt must be a valid timestamp',
        'identity updatedAt must be a valid timestamp',
      ])
    );
  });
});
