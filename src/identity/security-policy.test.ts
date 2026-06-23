import { describe, expect, it } from 'vitest';
import type { RecoveryMethodReference } from '@/identity/authentication-model';
import {
  evaluateAccountRecovery,
  evaluateAuthenticationAssurance,
} from '@/identity/security-policy';

const method: RecoveryMethodReference = {
  recoveryMethodId: 'recovery-1',
  subjectId: 'subject-1',
  providerId: 'local',
  methodType: 'local-reference',
  status: 'active',
  materialReference: 'recovery/recovery-1',
  createdAt: '2026-06-22T00:00:00.000Z',
};

describe('identity security policy', () => {
  it('requires MFA for constitutional and privileged requests', () => {
    expect(
      evaluateAuthenticationAssurance({
        constitutionalRoles: ['owner'],
        privileged: false,
        currentAssurance: 'single-factor',
      })
    ).toEqual({
      allowed: false,
      requiredAssurance: 'multi-factor',
      reason: 'additional assurance required',
    });
    expect(
      evaluateAuthenticationAssurance({
        constitutionalRoles: [],
        privileged: true,
        currentAssurance: 'phishing-resistant',
      }).allowed
    ).toBe(true);
  });

  it('allows ordinary requests at single-factor assurance', () => {
    expect(
      evaluateAuthenticationAssurance({
        constitutionalRoles: [],
        privileged: false,
        currentAssurance: 'single-factor',
      })
    ).toEqual({
      allowed: true,
      requiredAssurance: 'single-factor',
      reason: 'required assurance satisfied',
    });
  });

  it('permits matched recovery only through Kernel authorization and audit', () => {
    expect(
      evaluateAccountRecovery(
        {
          subjectId: method.subjectId,
          recoveryMethodId: method.recoveryMethodId,
          reason: 'credential recovery requested',
          correlationId: 'correlation-1',
          requestedAt: '2026-06-22T12:00:00.000Z',
        },
        method
      )
    ).toEqual({
      allowed: true,
      reason: 'recovery request may proceed through Kernel authorization and audit',
      authorityChangesAllowed: false,
    });
  });

  it('denies unavailable, mismatched, unauditable, and malformed recovery', () => {
    const base = {
      subjectId: method.subjectId,
      recoveryMethodId: method.recoveryMethodId,
      reason: 'recovery',
      correlationId: 'correlation-1',
      requestedAt: '2026-06-22T12:00:00.000Z',
    };
    expect(evaluateAccountRecovery(base, undefined).allowed).toBe(false);
    expect(evaluateAccountRecovery({ ...base, subjectId: 'other-subject' }, method).allowed).toBe(
      false
    );
    expect(
      evaluateAccountRecovery({ ...base, reason: '', correlationId: '' }, method).allowed
    ).toBe(false);
    expect(evaluateAccountRecovery({ ...base, requestedAt: 'invalid' }, method).allowed).toBe(
      false
    );
  });
});
