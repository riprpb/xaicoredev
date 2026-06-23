import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  parseDecimal,
  requireSoftDelete,
  serializeDecimal,
  serializeUtcTimestamp,
  validateIdempotencyMetadata,
} from '@/database/policies';

describe('database policies', () => {
  it('serializes Decimal values without binary floats or exponent notation', () => {
    const value = parseDecimal('1234567890.0123456789');
    expect(value).toBeInstanceOf(Prisma.Decimal);
    expect(serializeDecimal(value)).toBe('1234567890.0123456789');
    expect(() => parseDecimal('1e+9')).toThrow('non-exponential');
  });

  it('serializes valid timestamps as UTC', () => {
    expect(serializeUtcTimestamp(new Date('2026-06-22T12:00:00-04:00'))).toBe(
      '2026-06-22T16:00:00.000Z'
    );
    expect(() => serializeUtcTimestamp(new Date('invalid'))).toThrow('invalid');
  });

  it('validates bounded idempotency metadata', () => {
    const createdAt = new Date('2026-06-22T16:00:00.000Z');
    const valid = {
      scope: 'registry.write',
      key: 'request-key-1234',
      requestHash: 'a'.repeat(64),
      createdAt,
      expiresAt: new Date('2026-06-23T16:00:00.000Z'),
    };
    expect(() => validateIdempotencyMetadata(valid)).not.toThrow();
    expect(() => validateIdempotencyMetadata({ ...valid, scope: 'INVALID' })).toThrow('scope');
    expect(() => validateIdempotencyMetadata({ ...valid, key: 'short' })).toThrow('key');
    expect(() => validateIdempotencyMetadata({ ...valid, requestHash: 'invalid' })).toThrow(
      'SHA-256'
    );
    expect(() => validateIdempotencyMetadata({ ...valid, expiresAt: createdAt })).toThrow('expiry');
    expect(() => validateIdempotencyMetadata({ ...valid, createdAt: new Date('invalid') })).toThrow(
      'expiry'
    );
    expect(() => validateIdempotencyMetadata({ ...valid, expiresAt: new Date('invalid') })).toThrow(
      'expiry'
    );
  });

  it('requires identity soft-delete status and time to change together', () => {
    expect(() => requireSoftDelete('DELETED', new Date())).not.toThrow();
    expect(() => requireSoftDelete('ACTIVE', undefined)).not.toThrow();
    expect(() => requireSoftDelete('DELETED', undefined)).toThrow('together');
    expect(() => requireSoftDelete('ACTIVE', new Date())).toThrow('together');
    expect(() => requireSoftDelete('DELETED', new Date('invalid'))).toThrow('invalid');
  });
});
