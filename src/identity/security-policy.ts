import type {
  AuthenticationAssurance,
  RecoveryMethodReference,
} from '@/identity/authentication-model';
import type { ConstitutionalRole } from '@/identity/model';

export interface AuthenticationPolicyRequest {
  constitutionalRoles: readonly ConstitutionalRole[];
  privileged: boolean;
  currentAssurance: AuthenticationAssurance;
}

export interface AuthenticationPolicyDecision {
  allowed: boolean;
  requiredAssurance: AuthenticationAssurance;
  reason: string;
}

export interface AccountRecoveryRequest {
  subjectId: string;
  recoveryMethodId: string;
  reason: string;
  correlationId: string;
  requestedAt: string;
}

export interface AccountRecoveryDecision {
  allowed: boolean;
  reason: string;
  authorityChangesAllowed: false;
}

const ASSURANCE_LEVELS: Readonly<Record<AuthenticationAssurance, number>> = {
  'single-factor': 1,
  'multi-factor': 2,
  'phishing-resistant': 3,
};

export function evaluateAuthenticationAssurance(
  request: AuthenticationPolicyRequest
): AuthenticationPolicyDecision {
  const constitutional = request.constitutionalRoles.length > 0;
  const requiredAssurance: AuthenticationAssurance =
    constitutional || request.privileged ? 'multi-factor' : 'single-factor';
  const allowed = ASSURANCE_LEVELS[request.currentAssurance] >= ASSURANCE_LEVELS[requiredAssurance];
  return {
    allowed,
    requiredAssurance,
    reason: allowed ? 'required assurance satisfied' : 'additional assurance required',
  };
}

export function evaluateAccountRecovery(
  request: AccountRecoveryRequest,
  method: RecoveryMethodReference | undefined
): AccountRecoveryDecision {
  if (!method || method.status !== 'active') {
    return deniedRecovery('active recovery method is required');
  }
  if (
    method.subjectId !== request.subjectId ||
    method.recoveryMethodId !== request.recoveryMethodId
  ) {
    return deniedRecovery('recovery method does not match the subject');
  }
  if (!request.reason.trim() || !request.correlationId.trim()) {
    return deniedRecovery('recovery reason and correlation ID are required');
  }
  if (Number.isNaN(Date.parse(request.requestedAt))) {
    return deniedRecovery('recovery request timestamp is invalid');
  }
  return {
    allowed: true,
    reason: 'recovery request may proceed through Kernel authorization and audit',
    authorityChangesAllowed: false,
  };
}

function deniedRecovery(reason: string): AccountRecoveryDecision {
  return { allowed: false, reason, authorityChangesAllowed: false };
}
