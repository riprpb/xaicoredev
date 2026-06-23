import { describe, expect, it } from 'vitest';
import {
  getActiveEntitlementCapabilities,
  hasConstitutionalRole,
  validateSuccessorTrustGrant,
  type ConstitutionalIdentityProfile,
  type SuccessorTrustGrant,
} from '@/identity/model';

const now = new Date('2026-06-22T12:00:00.000Z');

describe('constitutional identity model', () => {
  it('does not derive constitutional authority from product entitlements', () => {
    const profile: ConstitutionalIdentityProfile = {
      subjectId: 'subject-1',
      authorityAssignments: [],
      productEntitlements: [
        {
          entitlementId: 'entitlement-1',
          subjectId: 'subject-1',
          productId: 'xaicore-pro',
          planId: 'enterprise',
          capabilities: ['owner', 'platform.admin', 'reports.read'],
          status: 'active',
          grantedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    };

    expect(hasConstitutionalRole(profile, 'owner', now)).toBe(false);
    expect(getActiveEntitlementCapabilities(profile, now)).toContain('owner');

    expect(
      getActiveEntitlementCapabilities(
        {
          ...profile,
          productEntitlements: [
            { ...profile.productEntitlements[0], subjectId: 'other-subject' },
            { ...profile.productEntitlements[0], status: 'suspended' },
            {
              ...profile.productEntitlements[0],
              expiresAt: '2026-06-22T12:00:00.000Z',
            },
          ],
        },
        now
      )
    ).toEqual([]);
  });

  it('recognizes only active, unexpired authority assignments', () => {
    const profile: ConstitutionalIdentityProfile = {
      subjectId: 'subject-1',
      authorityAssignments: [
        {
          assignmentId: 'authority-1',
          subjectId: 'subject-1',
          role: 'operational-administrator',
          status: 'active',
          grantedByAuthorityId: 'authority-owner',
          grantedAt: '2026-06-01T00:00:00.000Z',
          expiresAt: '2026-07-01T00:00:00.000Z',
          version: 1,
        },
      ],
      productEntitlements: [],
    };

    expect(hasConstitutionalRole(profile, 'operational-administrator', now)).toBe(true);
    expect(
      hasConstitutionalRole(
        profile,
        'operational-administrator',
        new Date('2026-07-01T00:00:00.000Z')
      )
    ).toBe(false);

    expect(
      hasConstitutionalRole(
        {
          ...profile,
          authorityAssignments: [{ ...profile.authorityAssignments[0], expiresAt: 'invalid' }],
        },
        'operational-administrator',
        now
      )
    ).toBe(false);
  });

  it('validates opaque, versioned successor trust grants', () => {
    const grant: SuccessorTrustGrant = {
      grantId: 'successor-grant-1',
      subjectId: 'subject-successor',
      grantedByAuthorityId: 'authority-owner',
      scopes: ['constitutional.continuity'],
      activationPolicyId: 'policy/successor-activation-v1',
      status: 'pending',
      issuedAt: '2026-06-22T12:00:00.000Z',
      version: 1,
      integrityProofReference: 'integrity/successor-grant-1',
    };

    expect(validateSuccessorTrustGrant(grant)).toEqual({ valid: true, errors: [] });
    expect(
      validateSuccessorTrustGrant({
        ...grant,
        grantedByAuthorityId: grant.subjectId,
        integrityProofReference: '',
      }).errors
    ).toEqual(
      expect.arrayContaining([
        'successor authority cannot be self-granted',
        'integrityProofReference is required',
      ])
    );
  });

  it('rejects incomplete, malformed, and inconsistent successor grants', () => {
    const result = validateSuccessorTrustGrant({
      grantId: '',
      subjectId: '',
      grantedByAuthorityId: '',
      scopes: [],
      activationPolicyId: '',
      status: 'revoked',
      issuedAt: 'invalid',
      expiresAt: 'invalid',
      revokedAt: undefined,
      version: 0,
      integrityProofReference: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'grantId is required',
        'subjectId is required',
        'grantedByAuthorityId is required',
        'at least one non-empty scope is required',
        'activationPolicyId is required',
        'version must be a positive integer',
        'integrityProofReference is required',
        'issuedAt must be a valid timestamp',
        'expiresAt must be a valid timestamp',
        'revoked grants require revokedAt',
      ])
    );

    expect(
      validateSuccessorTrustGrant({
        grantId: 'grant-1',
        subjectId: 'successor-1',
        grantedByAuthorityId: 'authority-owner',
        scopes: [''],
        activationPolicyId: 'policy-1',
        status: 'revoked',
        issuedAt: '2026-06-22T12:00:00.000Z',
        revokedAt: 'invalid',
        version: 1,
        integrityProofReference: 'integrity-1',
      }).errors
    ).toContain('revokedAt must be a valid timestamp');
  });
});
