import { randomUUID } from 'node:crypto';
import type { AuditEvent, KernelAuditWriter } from '@/platform/audit/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';

export interface ConstitutionalAcceptanceRecord {
  documentId: string;
  version: string;
  documentDigest: string;
  acceptedAt: string;
}

export interface OwnerBootstrapRequest {
  ceremonyId: string;
  candidateSubjectId: string;
  constitutionalAcceptance: ConstitutionalAcceptanceRecord;
  successorTrustPolicyReference: string;
  reason: string;
  context: KernelRequestContext;
}

export interface OwnerSecurityArtifactReferences {
  cryptographicOwnerIdentifier: string;
  recoveryKeyReference: string;
  ownershipIntegrityReference: string;
}

export interface ImmutableOwnerRecord {
  recordId: string;
  subjectId: string;
  cryptographicOwnerIdentifier: string;
  constitutionalAcceptance: ConstitutionalAcceptanceRecord;
  recoveryKeyReference: string;
  successorTrustPolicyReference: string;
  ownershipIntegrityReference: string;
  establishedAt: string;
  ceremonyId: string;
  version: 1;
}

export interface OwnerBootstrapResult {
  recordId: string;
  establishedAt: string;
  auditEventId: string;
}

export interface OwnerBootstrapSecurityProvider {
  authorizeCeremony(request: OwnerBootstrapRequest): Promise<boolean>;
  provisionOwnerSecurityArtifacts(
    ceremonyId: string,
    subjectId: string
  ): Promise<OwnerSecurityArtifactReferences>;
  revokeProvisionedArtifacts(artifacts: OwnerSecurityArtifactReferences): Promise<void>;
}

export interface OwnerBootstrapStore {
  reserve(ceremonyId: string): Promise<boolean>;
  commit(
    ceremonyId: string,
    record: ImmutableOwnerRecord,
    auditEvent: AuditEvent<OwnerBootstrapAuditDetails>
  ): Promise<void>;
  abort(ceremonyId: string): Promise<void>;
}

export interface OwnerBootstrapAuditDetails {
  recordId?: string;
  constitutionalVersion?: string;
}

export class OwnerBootstrapCoordinator {
  constructor(
    private readonly store: OwnerBootstrapStore,
    private readonly securityProvider: OwnerBootstrapSecurityProvider,
    private readonly audit: KernelAuditWriter,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(request: OwnerBootstrapRequest): Promise<OwnerBootstrapResult> {
    const validationErrors = validateRequest(request);
    if (validationErrors.length > 0) {
      await this.audit.append(
        createAttemptAudit(request, 'denied', 'bootstrap request validation failed', this.now())
      );
      throw new Error('Owner bootstrap request is invalid');
    }
    if (!(await this.securityProvider.authorizeCeremony(request))) {
      await this.audit.append(
        createAttemptAudit(request, 'denied', 'bootstrap ceremony authorization denied', this.now())
      );
      throw new Error('Owner bootstrap ceremony is not authorized');
    }
    if (!(await this.store.reserve(request.ceremonyId))) {
      await this.audit.append(
        createAttemptAudit(
          request,
          'denied',
          'owner bootstrap is established or already in progress',
          this.now()
        )
      );
      throw new Error('Owner bootstrap cannot be recreated or replaced');
    }

    let artifacts: OwnerSecurityArtifactReferences | undefined;
    try {
      artifacts = await this.securityProvider.provisionOwnerSecurityArtifacts(
        request.ceremonyId,
        request.candidateSubjectId
      );
      validateArtifactReferences(artifacts);
      const establishedAt = this.now().toISOString();
      const record = Object.freeze<ImmutableOwnerRecord>({
        recordId: randomUUID(),
        subjectId: request.candidateSubjectId,
        cryptographicOwnerIdentifier: artifacts.cryptographicOwnerIdentifier,
        constitutionalAcceptance: Object.freeze({
          ...request.constitutionalAcceptance,
        }),
        recoveryKeyReference: artifacts.recoveryKeyReference,
        successorTrustPolicyReference: request.successorTrustPolicyReference,
        ownershipIntegrityReference: artifacts.ownershipIntegrityReference,
        establishedAt,
        ceremonyId: request.ceremonyId,
        version: 1,
      });
      const auditEvent = createCompletionAudit(request, record);
      await this.store.commit(request.ceremonyId, record, auditEvent);
      return {
        recordId: record.recordId,
        establishedAt,
        auditEventId: auditEvent.id,
      };
    } catch {
      await Promise.allSettled([
        this.store.abort(request.ceremonyId),
        artifacts ? this.securityProvider.revokeProvisionedArtifacts(artifacts) : Promise.resolve(),
        this.audit.append(
          createAttemptAudit(request, 'failed', 'bootstrap ceremony failed', this.now())
        ),
      ]);
      throw new Error('Owner bootstrap ceremony failed safely');
    }
  }
}

function validateRequest(request: OwnerBootstrapRequest): string[] {
  const errors: string[] = [];
  if (!request.ceremonyId.trim()) errors.push('ceremonyId');
  if (!request.candidateSubjectId.trim()) errors.push('candidateSubjectId');
  if (!request.reason.trim()) errors.push('reason');
  if (!request.successorTrustPolicyReference.trim()) {
    errors.push('successorTrustPolicyReference');
  }
  const acceptance = request.constitutionalAcceptance;
  if (!acceptance.documentId.trim()) errors.push('constitutional documentId');
  if (!acceptance.version.trim()) errors.push('constitutional version');
  if (!acceptance.documentDigest.trim()) errors.push('constitutional documentDigest');
  if (Number.isNaN(Date.parse(acceptance.acceptedAt))) {
    errors.push('constitutional acceptedAt');
  }
  return errors;
}

function validateArtifactReferences(artifacts: OwnerSecurityArtifactReferences): void {
  if (
    !artifacts.cryptographicOwnerIdentifier.trim() ||
    !artifacts.recoveryKeyReference.trim() ||
    !artifacts.ownershipIntegrityReference.trim()
  ) {
    throw new Error('Owner security artifact references are incomplete');
  }
}

function createAttemptAudit(
  request: OwnerBootstrapRequest,
  outcome: 'denied' | 'failed',
  reason: string,
  occurredAt: Date
): AuditEvent<OwnerBootstrapAuditDetails> {
  return {
    id: randomUUID(),
    type: 'owner.bootstrap.attempted',
    action: 'owner.bootstrap',
    target: 'constitutional-owner',
    outcome,
    reason,
    occurredAt: occurredAt.toISOString(),
    context: request.context,
  };
}

function createCompletionAudit(
  request: OwnerBootstrapRequest,
  record: ImmutableOwnerRecord
): AuditEvent<OwnerBootstrapAuditDetails> {
  return {
    id: randomUUID(),
    type: 'owner.bootstrap.completed',
    action: 'owner.bootstrap',
    target: 'constitutional-owner',
    outcome: 'succeeded',
    reason: request.reason,
    occurredAt: record.establishedAt,
    context: request.context,
    details: {
      recordId: record.recordId,
      constitutionalVersion: record.constitutionalAcceptance.version,
    },
  };
}
