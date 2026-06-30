import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { RecoveryMethodReference } from '@/identity/authentication-model';
import type { ConstitutionalRole } from '@/identity/model';
import type { SuccessorTrustPolicy } from '@/identity/successor-trust';
import { validateSuccessorTrustPolicy } from '@/identity/successor-trust';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 10;
const RECOVERY_CODE_SALT_BYTES = 16;

export interface OwnerRecoveryCodeRecord {
  recoveryCodeId: string;
  salt: string;
  hash: string;
  usedAt?: string;
}

export interface OwnerMfaRecoveryState {
  schemaVersion: 1;
  subjectId: string;
  recoveryMethod: RecoveryMethodReference;
  generatedAt: string;
  regeneratedAt?: string;
  codes: readonly OwnerRecoveryCodeRecord[];
}

export interface SuccessorRecoveryReference {
  recoveryReferenceId: string;
  subjectId: string;
  successorSubjectId: string;
  policyId: string;
  policyVersion: number;
  protectedReference: string;
  reason: string;
  createdAt: string;
  status: 'pending';
  automaticActivationAllowed: false;
  authorityChangesAllowed: false;
}

export interface SuccessorRecoveryState {
  schemaVersion: 1;
  recoveryMethod: RecoveryMethodReference;
  reference: SuccessorRecoveryReference;
}

export interface RecoveryAuditDetails {
  subjectId: string;
  recoveryMethodId: string;
  codeId?: string;
  successorSubjectId?: string;
  policyId?: string;
  policyVersion?: number;
  protectedReference?: string;
}

export interface OwnerRecoveryGenerationRequest {
  subjectId: string;
  providerId: string;
  materialReference: string;
  context: KernelRequestContext;
  occurredAt?: Date;
}

export interface OwnerRecoveryRegenerationRequest extends OwnerRecoveryGenerationRequest {
  authenticated: true;
  mfaVerified: true;
}

export interface OwnerRecoveryUseRequest {
  subjectId: string;
  recoveryMethodId: string;
  code: string;
  reason: string;
  context: KernelRequestContext;
  occurredAt?: Date;
}

export interface SuccessorRecoveryProvisionRequest {
  subjectId: string;
  successorSubjectId: string;
  providerId: string;
  materialReference: string;
  protectedReference: string;
  reason: string;
  policy: SuccessorTrustPolicy;
  context: KernelRequestContext;
  occurredAt?: Date;
  generateCredentials?: boolean;
}

export interface GeneratedOwnerRecoveryCodes {
  recoveryMethod: RecoveryMethodReference;
  codes: readonly string[];
}

export interface OwnerRecoveryUseResult {
  allowed: boolean;
  authorityChangesAllowed: false;
  restoredAccess: boolean;
  matchedCodeId?: string;
  reason: string;
}

export class FileOwnerRecoveryWorkflow {
  private readonly codesPath: string;
  private readonly successorPath: string;

  constructor(
    private readonly directory: string,
    private readonly audit: KernelAuditWriter,
    private readonly createId: () => string = randomUUID
  ) {
    if (!path.isAbsolute(directory)) {
      throw new Error('Owner recovery directory must be absolute');
    }
    this.codesPath = path.join(directory, 'owner-mfa-recovery.json');
    this.successorPath = path.join(directory, 'owner-successor-recovery.json');
  }

  async generateRecoveryCodes(
    request: OwnerRecoveryGenerationRequest
  ): Promise<GeneratedOwnerRecoveryCodes> {
    const occurredAt = request.occurredAt ?? new Date();
    validateRecoveryGenerationRequest(request, occurredAt);
    const recoveryMethod = createRecoveryMethodReference(
      this.createId(),
      request.subjectId,
      request.providerId,
      request.materialReference,
      occurredAt
    );
    const generated = createRecoveryCodeSet();
    const state: OwnerMfaRecoveryState = {
      schemaVersion: 1,
      subjectId: request.subjectId,
      recoveryMethod,
      generatedAt: occurredAt.toISOString(),
      codes: Object.freeze(generated.records),
    };
    await this.writeJson(this.codesPath, state);
    await this.appendAudit(
      'owner.recovery-codes.generated',
      'generate',
      'succeeded',
      request,
      {
        subjectId: request.subjectId,
        recoveryMethodId: recoveryMethod.recoveryMethodId,
      },
      occurredAt
    );
    return { recoveryMethod, codes: Object.freeze(generated.codes) };
  }

  async regenerateRecoveryCodes(
    request: OwnerRecoveryRegenerationRequest
  ): Promise<GeneratedOwnerRecoveryCodes> {
    if (request.authenticated !== true || request.mfaVerified !== true) {
      throw new Error('Owner recovery code regeneration requires authenticated MFA verification');
    }
    const previous = await this.readRecoveryState();
    if (!previous || previous.subjectId !== request.subjectId) {
      throw new Error('Existing Owner recovery codes are required for regeneration');
    }
    const occurredAt = request.occurredAt ?? new Date();
    validateRecoveryGenerationRequest(request, occurredAt);
    const generated = createRecoveryCodeSet();
    const recoveryMethod = {
      ...previous.recoveryMethod,
      providerId: request.providerId,
      materialReference: request.materialReference,
      createdAt: previous.recoveryMethod.createdAt,
      status: 'active' as const,
      revokedAt: undefined,
      lastUsedAt: previous.recoveryMethod.lastUsedAt,
    };
    const state: OwnerMfaRecoveryState = {
      schemaVersion: 1,
      subjectId: request.subjectId,
      recoveryMethod,
      generatedAt: previous.generatedAt,
      regeneratedAt: occurredAt.toISOString(),
      codes: Object.freeze(generated.records),
    };
    await this.writeJson(this.codesPath, state);
    await this.appendAudit(
      'owner.recovery-codes.regenerated',
      'regenerate',
      'succeeded',
      request,
      {
        subjectId: request.subjectId,
        recoveryMethodId: recoveryMethod.recoveryMethodId,
      },
      occurredAt
    );
    return { recoveryMethod, codes: Object.freeze(generated.codes) };
  }

  async useRecoveryCode(request: OwnerRecoveryUseRequest): Promise<OwnerRecoveryUseResult> {
    const occurredAt = request.occurredAt ?? new Date();
    const state = await this.readRecoveryState();
    const denied = (reason: string) => ({
      allowed: false,
      authorityChangesAllowed: false as const,
      restoredAccess: false,
      reason,
    });

    if (!state || state.recoveryMethod.status !== 'active') {
      const result = denied('active recovery method is required');
      await this.appendAudit(
        'owner.recovery-codes.used',
        'use',
        'denied',
        request,
        {
          subjectId: request.subjectId,
          recoveryMethodId: request.recoveryMethodId,
        },
        occurredAt
      );
      return result;
    }
    if (
      state.subjectId !== request.subjectId ||
      state.recoveryMethod.recoveryMethodId !== request.recoveryMethodId
    ) {
      const result = denied('recovery method does not match the subject');
      await this.appendAudit(
        'owner.recovery-codes.used',
        'use',
        'denied',
        request,
        {
          subjectId: request.subjectId,
          recoveryMethodId: request.recoveryMethodId,
        },
        occurredAt
      );
      return result;
    }
    if (!request.reason.trim()) {
      const result = denied('recovery reason is required');
      await this.appendAudit(
        'owner.recovery-codes.used',
        'use',
        'denied',
        request,
        {
          subjectId: request.subjectId,
          recoveryMethodId: request.recoveryMethodId,
        },
        occurredAt
      );
      return result;
    }

    const normalizedCode = normalizeRecoveryCode(request.code);
    const matched = state.codes.find((record) => verifyRecoveryCode(normalizedCode, record));
    if (!matched || matched.usedAt) {
      const result = denied(
        matched?.usedAt ? 'recovery code replay is denied' : 'recovery code is invalid'
      );
      await this.appendAudit(
        'owner.recovery-codes.used',
        'use',
        'denied',
        request,
        {
          subjectId: request.subjectId,
          recoveryMethodId: request.recoveryMethodId,
          codeId: matched?.recoveryCodeId,
        },
        occurredAt
      );
      return result;
    }

    const updatedCodes = state.codes.map((record) =>
      record.recoveryCodeId === matched.recoveryCodeId
        ? { ...record, usedAt: occurredAt.toISOString() }
        : record
    );
    const nextState: OwnerMfaRecoveryState = {
      ...state,
      recoveryMethod: {
        ...state.recoveryMethod,
        lastUsedAt: occurredAt.toISOString(),
      },
      codes: Object.freeze(updatedCodes),
    };
    await this.writeJson(this.codesPath, nextState);
    await this.appendAudit(
      'owner.recovery-codes.used',
      'use',
      'succeeded',
      request,
      {
        subjectId: request.subjectId,
        recoveryMethodId: request.recoveryMethodId,
        codeId: matched.recoveryCodeId,
      },
      occurredAt
    );
    return {
      allowed: true,
      authorityChangesAllowed: false,
      restoredAccess: true,
      matchedCodeId: matched.recoveryCodeId,
      reason: 'Owner access restored through one-time MFA recovery code',
    };
  }

  async provisionSuccessorRecovery(
    request: SuccessorRecoveryProvisionRequest
  ): Promise<SuccessorRecoveryState> {
    const occurredAt = request.occurredAt ?? new Date();
    validateSuccessorRecoveryRequest(request, occurredAt);
    const validation = validateSuccessorTrustPolicy(request.policy);
    if (!validation.valid || request.policy.status !== 'active') {
      throw new Error('An active valid successor trust policy is required');
    }
    if (request.policy.automaticActivationAllowed !== false) {
      throw new Error('automatic activation must remain disabled');
    }
    const recoveryMethod = createRecoveryMethodReference(
      this.createId(),
      request.subjectId,
      request.providerId,
      request.materialReference,
      occurredAt,
      'successor-recovery-reference'
    );
    const reference: SuccessorRecoveryReference = {
      recoveryReferenceId: this.createId(),
      subjectId: request.subjectId,
      successorSubjectId: request.successorSubjectId,
      policyId: request.policy.policyId,
      policyVersion: request.policy.version,
      protectedReference: request.protectedReference,
      reason: request.reason,
      createdAt: occurredAt.toISOString(),
      status: 'pending',
      automaticActivationAllowed: false,
      authorityChangesAllowed: false,
    };
    const state: SuccessorRecoveryState = {
      schemaVersion: 1,
      recoveryMethod,
      reference,
    };
    await this.writeJson(this.successorPath, state);
    await this.appendAudit(
      'owner.successor-recovery.provisioned',
      'provision',
      'succeeded',
      request,
      {
        subjectId: request.subjectId,
        recoveryMethodId: recoveryMethod.recoveryMethodId,
        successorSubjectId: request.successorSubjectId,
        policyId: request.policy.policyId,
        policyVersion: request.policy.version,
        protectedReference: request.protectedReference,
      },
      occurredAt
    );
    return state;
  }

  async readRecoveryState(): Promise<OwnerMfaRecoveryState | undefined> {
    return this.readJson<OwnerMfaRecoveryState>(this.codesPath);
  }

  async readSuccessorRecoveryState(): Promise<SuccessorRecoveryState | undefined> {
    return this.readJson<SuccessorRecoveryState>(this.successorPath);
  }

  private async appendAudit(
    type: string,
    action: string,
    outcome: AuditEvent['outcome'],
    request: { context: KernelRequestContext; reason?: string },
    details: RecoveryAuditDetails,
    occurredAt: Date
  ): Promise<void> {
    await this.audit.append({
      id: this.createId(),
      type,
      action,
      target: 'identity.owner-recovery',
      outcome,
      reason: request.reason?.trim() || `${type} ${outcome}`,
      occurredAt: occurredAt.toISOString(),
      context: request.context,
      constitutionalAuthority: ['owner'] satisfies readonly ConstitutionalRole[],
      details,
    });
  }

  private async readJson<T>(filePath: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(filePath, 'utf8')) as T;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  private async writeJson(filePath: string, value: object): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.tmp`;
    const handle = await open(temporaryPath, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, filePath);
  }
}

function createRecoveryMethodReference(
  recoveryMethodId: string,
  subjectId: string,
  providerId: string,
  materialReference: string,
  at: Date,
  methodType = 'owner-mfa-recovery-codes'
): RecoveryMethodReference {
  return {
    recoveryMethodId,
    subjectId,
    providerId,
    methodType,
    status: 'active',
    materialReference,
    createdAt: at.toISOString(),
  };
}

function validateRecoveryGenerationRequest(
  request: OwnerRecoveryGenerationRequest,
  occurredAt: Date
): void {
  if (!request.subjectId.trim()) throw new Error('Owner recovery subject is required');
  if (!request.providerId.trim()) throw new Error('Owner recovery provider is required');
  if (!request.materialReference.trim()) {
    throw new Error('Owner recovery material reference is required');
  }
  if (!request.context.correlationId.trim()) {
    throw new Error('Owner recovery correlation ID is required');
  }
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Owner recovery timestamp is invalid');
  }
}

function validateSuccessorRecoveryRequest(
  request: SuccessorRecoveryProvisionRequest,
  occurredAt: Date
): void {
  validateRecoveryGenerationRequest(request, occurredAt);
  if (!request.successorSubjectId.trim()) {
    throw new Error('Successor recovery subject is required');
  }
  if (request.successorSubjectId === request.subjectId) {
    throw new Error('Successor recovery cannot self-grant authority');
  }
  if (!request.protectedReference.trim()) {
    throw new Error('Successor recovery protected reference is required');
  }
  if (!request.reason.trim()) {
    throw new Error('Successor recovery reason is required');
  }
  if (request.generateCredentials === true) {
    throw new Error('Successor recovery credentials require explicit Owner approval');
  }
}

function createRecoveryCodeSet(): { codes: string[]; records: OwnerRecoveryCodeRecord[] } {
  const codes: string[] = [];
  const records: OwnerRecoveryCodeRecord[] = [];
  while (codes.length < RECOVERY_CODE_COUNT) {
    const code = formatRecoveryCode(randomBytes(RECOVERY_CODE_BYTES));
    if (codes.includes(code)) continue;
    const salt = randomBytes(RECOVERY_CODE_SALT_BYTES);
    codes.push(code);
    records.push({
      recoveryCodeId: randomUUID(),
      salt: salt.toString('base64url'),
      hash: hashRecoveryCode(code, salt),
    });
  }
  return { codes, records };
}

function formatRecoveryCode(bytes: Buffer): string {
  return (
    bytes
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') ?? ''
  );
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase();
}

function hashRecoveryCode(code: string, salt: Buffer): string {
  return createHash('sha256')
    .update(salt)
    .update(normalizeRecoveryCode(code), 'utf8')
    .digest('base64url');
}

function verifyRecoveryCode(code: string, record: OwnerRecoveryCodeRecord): boolean {
  const salt = Buffer.from(record.salt, 'base64url');
  const actual = Buffer.from(record.hash, 'base64url');
  const expected = Buffer.from(hashRecoveryCode(code, salt), 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
