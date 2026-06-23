import { describe, expect, it, vi } from 'vitest';
import {
  OwnerSessionAuthenticationService,
  type OwnerSessionEvidence,
  type OwnerSessionVerifier,
} from '@/identity/owner-session-authentication';

const now = new Date('2026-06-22T20:00:00.000Z');
const evidence: OwnerSessionEvidence = {
  sessionId: 'session-1',
  subjectId: 'owner-1',
  status: 'active',
  assurance: 'multi-factor',
  constitutionalRoles: ['owner'],
  capabilities: [],
  authenticatedAt: '2026-06-22T19:00:00.000Z',
  reauthenticatedAt: '2026-06-22T19:59:00.000Z',
  expiresAt: '2026-06-22T21:00:00.000Z',
};

function verifier(result?: OwnerSessionEvidence): OwnerSessionVerifier {
  return { verifyTokenHash: vi.fn().mockResolvedValue(result) };
}

describe('OwnerSessionAuthenticationService', () => {
  it('creates an Owner Kernel context from verified MFA session evidence', async () => {
    const sessionVerifier = verifier(evidence);
    const authentication = new OwnerSessionAuthenticationService(
      sessionVerifier,
      (() => {
        let id = 0;
        return () => `generated-${++id}`;
      })()
    );

    const result = await authentication.authenticate({
      sessionToken: 'opaque-session-token',
      environment: 'test',
      requestedAt: now,
    });

    expect(result).toMatchObject({
      context: {
        requestId: 'generated-1',
        correlationId: 'generated-2',
        actor: { id: 'owner-1', sessionId: 'session-1', kind: 'owner' },
      },
      subject: {
        assurance: 'multi-factor',
        constitutionalRoles: ['owner'],
      },
    });
    expect(sessionVerifier.verifyTokenHash).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
      now
    );
    expect(sessionVerifier.verifyTokenHash).not.toHaveBeenCalledWith(
      'opaque-session-token',
      expect.anything()
    );
  });

  it.each([
    undefined,
    { ...evidence, status: 'revoked' as const },
    { ...evidence, constitutionalRoles: [] },
    { ...evidence, assurance: 'single-factor' as const },
    { ...evidence, authenticatedAt: 'invalid' },
    { ...evidence, expiresAt: now.toISOString() },
  ])('rejects invalid Owner session evidence', async (invalidEvidence) => {
    const authentication = new OwnerSessionAuthenticationService(verifier(invalidEvidence));
    await expect(
      authentication.authenticate({
        sessionToken: 'opaque-session-token',
        environment: 'test',
        requestedAt: now,
      })
    ).resolves.toBeUndefined();
  });

  it('rejects empty tokens and environments before session lookup', async () => {
    const sessionVerifier = verifier(evidence);
    const authentication = new OwnerSessionAuthenticationService(sessionVerifier);
    await expect(
      authentication.authenticate({ sessionToken: '', environment: 'test' })
    ).resolves.toBeUndefined();
    await expect(
      authentication.authenticate({ sessionToken: 'token', environment: '' })
    ).resolves.toBeUndefined();
    expect(sessionVerifier.verifyTokenHash).not.toHaveBeenCalled();
  });
});
