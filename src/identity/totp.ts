import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOTP_POLICY = Object.freeze({
  algorithm: 'SHA1' as const,
  digits: 6,
  periodSeconds: 30,
  verificationWindow: 1,
  secretBytes: 20,
});

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(TOTP_POLICY.secretBytes));
}

export function createTotpProvisioningUri(
  secret: string,
  accountLabel: string,
  issuer = 'XAICore'
): string {
  decodeBase32(secret);
  if (!accountLabel.trim() || !issuer.trim())
    throw new Error('TOTP account and issuer are required');
  const label = `${issuer}:${accountLabel}`;
  const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  url.searchParams.set('secret', secret);
  url.searchParams.set('issuer', issuer);
  url.searchParams.set('algorithm', TOTP_POLICY.algorithm);
  url.searchParams.set('digits', String(TOTP_POLICY.digits));
  url.searchParams.set('period', String(TOTP_POLICY.periodSeconds));
  return url.toString();
}

export function generateTotp(
  secret: string,
  at: Date = new Date(),
  digits: number = TOTP_POLICY.digits
): string {
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error('TOTP digits are outside policy');
  }
  const timestamp = at.getTime();
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('TOTP timestamp is invalid');
  const counter = Math.floor(timestamp / 1000 / TOTP_POLICY.periodSeconds);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function verifyTotp(secret: string, code: string, at: Date = new Date()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (
    let offset = -TOTP_POLICY.verificationWindow;
    offset <= TOTP_POLICY.verificationWindow;
    offset += 1
  ) {
    const candidate = generateTotp(
      secret,
      new Date(at.getTime() + offset * TOTP_POLICY.periodSeconds * 1000)
    );
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

export function encodeBase32(value: Readonly<Buffer>): string {
  if (value.length === 0) throw new Error('TOTP secret cannot be empty');
  let bits = 0;
  let bitCount = 0;
  let encoded = '';
  for (const byte of value) {
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      encoded += BASE32_ALPHABET[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }
  if (bitCount > 0) encoded += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  return encoded;
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.trim().toUpperCase().replace(/=+$/, '');
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error('TOTP secret is not valid Base32');
  }
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    bits = (bits << 5) | BASE32_ALPHABET.indexOf(character);
    bitCount += 5;
    if (bitCount >= 8) {
      bytes.push((bits >>> (bitCount - 8)) & 0xff);
      bitCount -= 8;
    }
  }
  return Buffer.from(bytes);
}
