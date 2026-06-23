import { describe, expect, it } from 'vitest';
import {
  LOCAL_LOGIN_ATTEMPT_POLICY,
  LOCAL_PASSWORD_POLICY,
  LocalPasswordDenylist,
  canAttemptLocalLogin,
  clearLocalLoginFailures,
  createLocalPasswordHash,
  passwordHashNeedsUpgrade,
  recordLocalLoginFailure,
  verifyLocalPassword,
} from '@/identity/local-credentials';

const permittedPassword = 'a local passphrase with sufficient length';
const denylist = new LocalPasswordDenylist([
  LocalPasswordDenylist.fingerprint('a known compromised local password'),
]);

describe('local credentials', () => {
  it('hashes and verifies a local password with the approved scrypt policy', async () => {
    const password = permittedPassword;
    const stored = await createLocalPasswordHash(password, denylist);

    expect(stored).toEqual(
      expect.objectContaining({
        algorithm: 'scrypt',
        policyVersion: 1,
        cost: 2 ** 17,
        blockSize: 8,
        parallelization: 1,
      })
    );
    expect(stored).not.toHaveProperty('password');
    await expect(verifyLocalPassword(password, stored)).resolves.toEqual({
      valid: true,
      needsUpgrade: false,
    });
    await expect(verifyLocalPassword('an incorrect passphrase value', stored)).resolves.toEqual({
      valid: false,
      needsUpgrade: false,
    });
  }, 15_000);

  it('enforces length without composition rules', async () => {
    await expect(createLocalPasswordHash('too short', denylist)).rejects.toThrow(
      'at least 15 characters'
    );
    await expect(createLocalPasswordHash('x'.repeat(129), denylist)).rejects.toThrow(
      'at most 128 characters'
    );
    await expect(
      createLocalPasswordHash('correct horse battery staple', denylist)
    ).resolves.toEqual(expect.objectContaining({ algorithm: 'scrypt' }));
  }, 15_000);

  it('fails closed for malformed or unsupported hashes', async () => {
    const stored = await createLocalPasswordHash('another sufficiently long passphrase', denylist);
    expect(passwordHashNeedsUpgrade({ ...stored, policyVersion: 0 })).toBe(true);
    await expect(
      verifyLocalPassword('another sufficiently long passphrase', {
        ...stored,
        derivedKey: 'malformed',
      })
    ).resolves.toEqual({ valid: false, needsUpgrade: false });
    await expect(verifyLocalPassword('short', { ...stored, policyVersion: 0 })).resolves.toEqual({
      valid: false,
      needsUpgrade: true,
    });
  }, 15_000);

  it('blocks repeated failures and clears state after success', () => {
    const started = new Date('2026-06-22T12:00:00.000Z');
    let state = clearLocalLoginFailures(started);
    for (let index = 0; index < LOCAL_LOGIN_ATTEMPT_POLICY.maximumFailures; index += 1) {
      state = recordLocalLoginFailure(state, started);
    }

    expect(canAttemptLocalLogin(state, started)).toBe(false);
    expect(
      canAttemptLocalLogin(state, new Date(started.getTime() + LOCAL_LOGIN_ATTEMPT_POLICY.blockMs))
    ).toBe(true);
    expect(clearLocalLoginFailures(started)).toEqual({
      failureCount: 0,
      windowStartedAt: started.toISOString(),
    });
  });

  it('resets failures outside the attempt window and rejects malformed blocks', () => {
    const started = new Date('2026-06-22T12:00:00.000Z');
    const state = recordLocalLoginFailure(
      { failureCount: 4, windowStartedAt: 'invalid', blockedUntil: 'invalid' },
      started
    );

    expect(state.failureCount).toBe(1);
    expect(canAttemptLocalLogin({ ...state, blockedUntil: 'invalid' }, started)).toBe(false);
    expect(LOCAL_PASSWORD_POLICY.maximumCharacters).toBeGreaterThanOrEqual(64);
  });

  it('requires valid compromised-password screening before hashing', async () => {
    await expect(
      createLocalPasswordHash('a known compromised local password', denylist)
    ).rejects.toThrow('configured compromised-password source');
    expect(() => new LocalPasswordDenylist([])).toThrow('requires at least one');
    expect(() => new LocalPasswordDenylist(['not-a-fingerprint'])).toThrow('lowercase SHA-256');
    await expect(denylist.check(permittedPassword)).resolves.toEqual({
      compromised: false,
      source: 'local-sha256-denylist',
    });
  });
});
