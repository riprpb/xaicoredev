import { describe, expect, it } from 'vitest';
import {
  createPendingSuccessorGrant,
  revokeSuccessorGrant,
  validateSuccessorTrustPolicy,
  type SuccessorTrustPolicy,
} from '@/identity/successor-trust';

const issuedAt = new Date('2026-06-22T12:00:00.000Z');
const policy: SuccessorTrustPolicy = {
  policyId: 'successor-policy-test',
  version: 1,
  status: 'active',
  allowedScopes: ['constitutional.continuity'],
  activationPolicyReference: 'activation-policy/test-v1',
  ownerApprovalRequired: true,
  automaticActivationAllowed: false,
};

describe('successor trust framework', () => {
  it('creates only pending grants under an active approved policy', () => {
    const grant = createPendingSuccessorGrant(
      policy,
      {
        subjectId: 'successor-subject-test',
        grantedByAuthorityId: 'owner-authority-test',
        scopes: ['constitutional.continuity'],
        expiresAt: '2027-06-22T12:00:00.000Z',
        integrityProofReference: 'integrity/successor-test',
      },
      issuedAt
    );

    expect(grant.status).toBe('pending');
    expect(grant.activationPolicyId).toBe(policy.activationPolicyReference);
    expect(Object.isFrozen(grant)).toBe(true);
    expect(Object.isFrozen(grant.scopes)).toBe(true);
  });

  it('requires Owner approval and prohibits automatic activation in policy', () => {
    expect(validateSuccessorTrustPolicy(policy)).toEqual({ valid: true, errors: [] });
    expect(
      validateSuccessorTrustPolicy({
        ...policy,
        policyId: '',
        version: 0,
        allowedScopes: ['', ''],
        activationPolicyReference: '',
        ownerApprovalRequired: false as true,
        automaticActivationAllowed: true as false,
      }).errors
    ).toEqual(
      expect.arrayContaining([
        'policyId is required',
        'version must be a positive integer',
        'at least one non-empty allowed scope is required',
        'allowed scopes must be unique',
        'activationPolicyReference is required',
        'Owner approval must be required',
        'automatic activation must remain disabled',
      ])
    );
  });

  it('rejects invalid policy, identity, scope, integrity, and expiry', () => {
    const base = {
      subjectId: 'successor-subject-test',
      grantedByAuthorityId: 'owner-authority-test',
      scopes: ['constitutional.continuity'],
      integrityProofReference: 'integrity/successor-test',
    };
    expect(() =>
      createPendingSuccessorGrant({ ...policy, status: 'retired' }, base, issuedAt)
    ).toThrow('active valid successor trust policy');
    expect(() =>
      createPendingSuccessorGrant({ ...policy, activationPolicyReference: '' }, base, issuedAt)
    ).toThrow('active valid successor trust policy');
    expect(() =>
      createPendingSuccessorGrant({ ...policy }, { ...base, subjectId: '' }, issuedAt)
    ).toThrow('subject and granting Owner authority');
    expect(() =>
      createPendingSuccessorGrant(
        policy,
        { ...base, subjectId: base.grantedByAuthorityId },
        issuedAt
      )
    ).toThrow('cannot be self-granted');
    expect(() =>
      createPendingSuccessorGrant(policy, { ...base, scopes: ['unapproved'] }, issuedAt)
    ).toThrow('scopes must be allowed');
    expect(() =>
      createPendingSuccessorGrant(policy, { ...base, integrityProofReference: '' }, issuedAt)
    ).toThrow('integrity reference is required');
    expect(() =>
      createPendingSuccessorGrant(policy, { ...base, expiresAt: 'invalid' }, issuedAt)
    ).toThrow('valid future timestamp');
  });

  it('revokes grants immutably and idempotently', () => {
    const grant = createPendingSuccessorGrant(
      policy,
      {
        subjectId: 'successor-subject-test',
        grantedByAuthorityId: 'owner-authority-test',
        scopes: ['constitutional.continuity'],
        integrityProofReference: 'integrity/successor-test',
      },
      issuedAt
    );
    const revoked = revokeSuccessorGrant(grant, new Date('2026-06-22T13:00:00.000Z'));
    expect(revoked).toEqual(expect.objectContaining({ status: 'revoked', version: 2 }));
    expect(revokeSuccessorGrant(revoked)).toBe(revoked);
    expect(() => revokeSuccessorGrant(grant, new Date('2026-06-22T11:00:00.000Z'))).toThrow(
      'cannot predate issuance'
    );
  });
});
