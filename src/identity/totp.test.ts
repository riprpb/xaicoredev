import { describe, expect, it } from 'vitest';
import {
  createTotpProvisioningUri,
  decodeBase32,
  encodeBase32,
  generateTotp,
  generateTotpSecret,
  verifyTotp,
} from '@/identity/totp';

describe('TOTP', () => {
  it('matches the RFC 6238 SHA-1 vector', () => {
    const secret = encodeBase32(Buffer.from('12345678901234567890', 'ascii'));
    expect(generateTotp(secret, new Date(59_000), 8)).toBe('94287082');
  });

  it('generates and round-trips policy-sized Base32 secrets', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(encodeBase32(decodeBase32(secret))).toBe(secret);
  });

  it('verifies current and adjacent time windows but rejects malformed codes', () => {
    const secret = encodeBase32(Buffer.from('12345678901234567890', 'ascii'));
    const now = new Date('2026-06-22T20:00:00.000Z');
    const previous = generateTotp(secret, new Date(now.getTime() - 30_000));
    expect(verifyTotp(secret, previous, now)).toBe(true);
    expect(verifyTotp(secret, '000000', now)).toBe(false);
    expect(verifyTotp(secret, 'invalid', now)).toBe(false);
  });

  it('creates an authenticator provisioning URI without accepting invalid metadata', () => {
    const secret = encodeBase32(Buffer.from('12345678901234567890', 'ascii'));
    const uri = new URL(createTotpProvisioningUri(secret, 'Owner'));
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.searchParams.get('secret')).toBe(secret);
    expect(uri.searchParams.get('issuer')).toBe('XAICore');
    expect(() => createTotpProvisioningUri(secret, '')).toThrow('required');
    expect(() => decodeBase32('not valid!')).toThrow('Base32');
    expect(() => encodeBase32(Buffer.alloc(0))).toThrow('empty');
    expect(() => generateTotp(secret, new Date(), 5)).toThrow('digits');
    expect(() => generateTotp(secret, new Date('invalid'))).toThrow('timestamp');
  });
});
