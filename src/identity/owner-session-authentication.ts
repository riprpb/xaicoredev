import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticationAssurance } from '@/identity/authentication-model';
import type { ConstitutionalRole } from '@/identity/model';
import { createKernelRequestContext, type KernelRequestContext } from '@/platform/kernel/context';
import type { AuthorizationSubject } from '@/platform/permissions/contracts';

export interface OwnerSessionEvidence {
  sessionId: string;
  subjectId: string;
  status: 'active' | 'revoked' | 'expired';
  assurance: AuthenticationAssurance;
  constitutionalRoles: readonly ConstitutionalRole[];
  capabilities: readonly string[];
  authenticatedAt: string;
  reauthenticatedAt?: string;
  expiresAt: string;
}

export interface OwnerSessionVerifier {
  verifyTokenHash(tokenHash: string, at: Date): Promise<OwnerSessionEvidence | undefined>;
}

export interface OwnerAuthenticationRequest {
  sessionToken: string;
  environment: string;
  requestId?: string;
  correlationId?: string;
  requestedAt?: Date;
}

export interface AuthenticatedOwnerSession {
  context: KernelRequestContext;
  subject: AuthorizationSubject;
}

export class OwnerSessionAuthenticationService {
  constructor(
    private readonly verifier: OwnerSessionVerifier,
    private readonly createId: () => string = randomUUID
  ) {}

  async authenticate(
    request: OwnerAuthenticationRequest
  ): Promise<AuthenticatedOwnerSession | undefined> {
    if (!request.sessionToken || !request.environment.trim()) return undefined;
    const requestedAt = request.requestedAt ?? new Date();
    const evidence = await this.verifier.verifyTokenHash(
      hashToken(request.sessionToken),
      requestedAt
    );
    if (!isValidOwnerEvidence(evidence, requestedAt)) return undefined;
    return {
      context: createKernelRequestContext({
        requestId: request.requestId ?? this.createId(),
        correlationId: request.correlationId ?? this.createId(),
        environment: request.environment,
        actor: {
          id: evidence.subjectId,
          sessionId: evidence.sessionId,
          kind: 'owner',
          authenticated: true,
        },
        requestedAt: requestedAt.toISOString(),
      }),
      subject: {
        subjectId: evidence.subjectId,
        constitutionalRoles: evidence.constitutionalRoles,
        capabilities: evidence.capabilities,
        assurance: evidence.assurance,
        reauthenticatedAt: evidence.reauthenticatedAt,
      },
    };
  }
}

function isValidOwnerEvidence(
  evidence: OwnerSessionEvidence | undefined,
  at: Date
): evidence is OwnerSessionEvidence {
  if (!evidence || evidence.status !== 'active') return false;
  if (!evidence.constitutionalRoles.includes('owner')) return false;
  if (evidence.assurance === 'single-factor') return false;
  const authenticatedAt = Date.parse(evidence.authenticatedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  return (
    !Number.isNaN(authenticatedAt) &&
    !Number.isNaN(expiresAt) &&
    authenticatedAt <= at.getTime() &&
    expiresAt > at.getTime()
  );
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
