export type TrustVerdict =
  | 'verified-safe'
  | 'low-risk'
  | 'unknown'
  | 'suspicious'
  | 'malicious'

export interface TrustIngressObject {
  id: string
  source: string
  mediaType: string
  sizeBytes?: number
  checksum?: string
  metadata: Readonly<Record<string, string>>
}

export interface TrustSignal {
  providerId: string
  category: string
  score: number
  confidence: number
  reason: string
}

export interface TrustAssessment {
  objectId: string
  verdict: TrustVerdict
  score: number
  signals: readonly TrustSignal[]
  assessedAt: string
  policyVersion: string
}

export interface TrustScannerProvider {
  id: string
  supportedMediaTypes: readonly string[]
  scan(object: TrustIngressObject): Promise<readonly TrustSignal[]>
}

export interface TrustRiskScorer {
  assess(
    object: TrustIngressObject,
    signals: readonly TrustSignal[],
  ): Promise<TrustAssessment>
}

export interface QuarantineContract {
  quarantine(object: TrustIngressObject, assessment: TrustAssessment): Promise<void>
  release(objectId: string, actorId: string, reason: string): Promise<void>
}

export interface TrustAuditContract {
  recordIngress(object: TrustIngressObject, correlationId: string): Promise<void>
  recordAssessment(
    assessment: TrustAssessment,
    correlationId: string,
  ): Promise<void>
}

export interface TrustGateway {
  inspect(
    object: TrustIngressObject,
    correlationId: string,
  ): Promise<TrustAssessment>
}
