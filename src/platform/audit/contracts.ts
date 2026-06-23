import type { KernelRequestContext } from '@/platform/kernel/context';
import type { ConstitutionalRole } from '@/identity/model';

export interface AuditEvent<TDetails = unknown> {
  id: string;
  type: string;
  action: string;
  target: string;
  outcome: 'allowed' | 'denied' | 'succeeded' | 'failed';
  reason: string;
  occurredAt: string;
  context: KernelRequestContext;
  constitutionalAuthority?: readonly ConstitutionalRole[];
  permissionDecisionId?: string;
  details?: TDetails;
  previousEventHash?: string;
  integrityHash?: string;
}

export interface PersistedAuditEvent<TDetails = unknown> extends Omit<
  AuditEvent<TDetails>,
  'constitutionalAuthority' | 'previousEventHash' | 'integrityHash'
> {
  constitutionalAuthority: readonly ConstitutionalRole[];
  previousEventHash: string;
  integrityHash: string;
}

export interface KernelAuditWriter {
  append<TDetails>(event: AuditEvent<TDetails>): Promise<void>;
}

export interface KernelAuditReader {
  get(id: string): Promise<AuditEvent | undefined>;
  listByCorrelationId(correlationId: string): Promise<readonly AuditEvent[]>;
}
