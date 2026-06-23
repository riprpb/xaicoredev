import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const LOCAL_PASSWORD_POLICY = {
  version: 1,
  algorithm: 'scrypt',
  minimumCharacters: 15,
  maximumCharacters: 128,
  saltBytes: 16,
  derivedKeyBytes: 32,
  cost: 2 ** 17,
  blockSize: 8,
  parallelization: 1,
  maximumMemoryBytes: 256 * 1024 * 1024,
} as const;

export const LOCAL_LOGIN_ATTEMPT_POLICY = {
  maximumFailures: 5,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
} as const;

export interface LocalPasswordHash {
  algorithm: 'scrypt';
  policyVersion: number;
  salt: string;
  derivedKey: string;
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
}

export interface PasswordVerificationResult {
  valid: boolean;
  needsUpgrade: boolean;
}

export interface LoginAttemptState {
  failureCount: number;
  windowStartedAt: string;
  blockedUntil?: string;
}

export interface CompromisedPasswordCheck {
  compromised: boolean;
  source: string;
}

export interface CompromisedPasswordChecker {
  check(password: string): Promise<CompromisedPasswordCheck>;
}

export class LocalPasswordDenylist implements CompromisedPasswordChecker {
  private readonly fingerprints: ReadonlySet<string>;

  constructor(fingerprints: readonly string[]) {
    if (fingerprints.length === 0) {
      throw new Error('Local password denylist requires at least one fingerprint');
    }
    if (fingerprints.some((fingerprint) => !/^[a-f0-9]{64}$/.test(fingerprint))) {
      throw new Error('Password denylist fingerprints must be lowercase SHA-256 values');
    }
    this.fingerprints = new Set(fingerprints);
  }

  async check(password: string): Promise<CompromisedPasswordCheck> {
    return {
      compromised: this.fingerprints.has(fingerprintPassword(password)),
      source: 'local-sha256-denylist',
    };
  }

  static fingerprint(password: string): string {
    return fingerprintPassword(password);
  }
}

export async function createLocalPasswordHash(
  password: string,
  compromisedPasswordChecker: CompromisedPasswordChecker
): Promise<LocalPasswordHash> {
  validatePassword(password);
  const check = await compromisedPasswordChecker.check(password);
  if (check.compromised) {
    throw new Error('Password is present in the configured compromised-password source');
  }
  const salt = randomBytes(LOCAL_PASSWORD_POLICY.saltBytes);
  const derivedKey = await deriveKey(password, salt);
  return {
    algorithm: LOCAL_PASSWORD_POLICY.algorithm,
    policyVersion: LOCAL_PASSWORD_POLICY.version,
    salt: salt.toString('base64url'),
    derivedKey: derivedKey.toString('base64url'),
    cost: LOCAL_PASSWORD_POLICY.cost,
    blockSize: LOCAL_PASSWORD_POLICY.blockSize,
    parallelization: LOCAL_PASSWORD_POLICY.parallelization,
    keyLength: LOCAL_PASSWORD_POLICY.derivedKeyBytes,
  };
}

export async function verifyLocalPassword(
  password: string,
  stored: LocalPasswordHash
): Promise<PasswordVerificationResult> {
  if (!isSupportedHash(stored) || !isPasswordLengthAllowed(password)) {
    return { valid: false, needsUpgrade: passwordHashNeedsUpgrade(stored) };
  }
  const salt = decodeExactBase64Url(stored.salt, LOCAL_PASSWORD_POLICY.saltBytes);
  const expected = decodeExactBase64Url(stored.derivedKey, stored.keyLength);
  if (!salt || !expected) {
    return { valid: false, needsUpgrade: passwordHashNeedsUpgrade(stored) };
  }
  const actual = await deriveKey(password, salt);
  return {
    valid: timingSafeEqual(actual, expected),
    needsUpgrade: passwordHashNeedsUpgrade(stored),
  };
}

export function passwordHashNeedsUpgrade(stored: LocalPasswordHash): boolean {
  return (
    stored.algorithm !== LOCAL_PASSWORD_POLICY.algorithm ||
    stored.policyVersion !== LOCAL_PASSWORD_POLICY.version ||
    stored.cost !== LOCAL_PASSWORD_POLICY.cost ||
    stored.blockSize !== LOCAL_PASSWORD_POLICY.blockSize ||
    stored.parallelization !== LOCAL_PASSWORD_POLICY.parallelization ||
    stored.keyLength !== LOCAL_PASSWORD_POLICY.derivedKeyBytes
  );
}

export function canAttemptLocalLogin(
  state: LoginAttemptState | undefined,
  at: Date = new Date()
): boolean {
  if (!state?.blockedUntil) return true;
  const blockedUntil = Date.parse(state.blockedUntil);
  return !Number.isNaN(blockedUntil) && blockedUntil <= at.getTime();
}

export function recordLocalLoginFailure(
  state: LoginAttemptState | undefined,
  at: Date = new Date()
): LoginAttemptState {
  const windowStartedAt = state ? Date.parse(state.windowStartedAt) : Number.NaN;
  const withinWindow =
    !Number.isNaN(windowStartedAt) &&
    at.getTime() - windowStartedAt < LOCAL_LOGIN_ATTEMPT_POLICY.windowMs;
  const failureCount = withinWindow ? (state?.failureCount ?? 0) + 1 : 1;
  return {
    failureCount,
    windowStartedAt: withinWindow ? (state?.windowStartedAt ?? at.toISOString()) : at.toISOString(),
    blockedUntil:
      failureCount >= LOCAL_LOGIN_ATTEMPT_POLICY.maximumFailures
        ? new Date(at.getTime() + LOCAL_LOGIN_ATTEMPT_POLICY.blockMs).toISOString()
        : undefined,
  };
}

export function clearLocalLoginFailures(at: Date = new Date()): LoginAttemptState {
  return { failureCount: 0, windowStartedAt: at.toISOString() };
}

function validatePassword(password: string): void {
  const characters = Array.from(password).length;
  if (characters < LOCAL_PASSWORD_POLICY.minimumCharacters) {
    throw new Error(
      `Local passwords require at least ${LOCAL_PASSWORD_POLICY.minimumCharacters} characters`
    );
  }
  if (characters > LOCAL_PASSWORD_POLICY.maximumCharacters) {
    throw new Error(
      `Local passwords allow at most ${LOCAL_PASSWORD_POLICY.maximumCharacters} characters`
    );
  }
}

function isPasswordLengthAllowed(password: string): boolean {
  const characters = Array.from(password).length;
  return (
    characters >= LOCAL_PASSWORD_POLICY.minimumCharacters &&
    characters <= LOCAL_PASSWORD_POLICY.maximumCharacters
  );
}

function isSupportedHash(stored: LocalPasswordHash): boolean {
  return (
    !passwordHashNeedsUpgrade(stored) && stored.salt.length > 0 && stored.derivedKey.length > 0
  );
}

function decodeExactBase64Url(value: string, expectedBytes: number): Buffer | undefined {
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length !== expectedBytes || decoded.toString('base64url') !== value) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      LOCAL_PASSWORD_POLICY.derivedKeyBytes,
      {
        N: LOCAL_PASSWORD_POLICY.cost,
        r: LOCAL_PASSWORD_POLICY.blockSize,
        p: LOCAL_PASSWORD_POLICY.parallelization,
        maxmem: LOCAL_PASSWORD_POLICY.maximumMemoryBytes,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

function fingerprintPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}
