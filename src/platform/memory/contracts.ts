export type MemoryOperation =
  | 'read'
  | 'write'
  | 'append'
  | 'summarize'
  | 'archive'
  | 'restore'
  | 'delete'
  | 'synchronize'
  | 'compress'
  | 'encrypt'

export interface MemoryPermissionContract {
  subjectId: string
  brainId: string
  operations: readonly MemoryOperation[]
  conditions?: Readonly<Record<string, unknown>>
}

export interface MemoryEncryptionContract {
  policyId: string
  algorithm: string
  keyReference: string
  rotationPolicy: string
  encryptedAtRest: boolean
  encryptedInTransit: boolean
}

export interface MemoryVersionContract {
  version: number
  previousVersion?: number
  createdAt: string
  createdBy: string
  checksum: string
}

export interface BrainContract {
  id: string
  name: string
  description: string
  schemaVersion: string
  retentionPolicyId: string
  encryptionPolicyId: string
  supportedOperations: readonly MemoryOperation[]
}

export interface MemoryRouteRequest {
  requestId: string
  subjectId: string
  operation: MemoryOperation
  requestedBrainId?: string
  purpose: string
  correlationId: string
}

export interface MemoryRouteDecision {
  requestId: string
  allowed: boolean
  brainId?: string
  permissionContractId?: string
  reason: string
}

export interface MemoryRouter {
  route(request: MemoryRouteRequest): Promise<MemoryRouteDecision>
}

export interface MemoryRegistry {
  registerBrain(contract: BrainContract): Promise<void>
  getBrain(id: string): Promise<BrainContract | undefined>
  listBrains(): Promise<readonly BrainContract[]>
  getPermissions(subjectId: string): Promise<readonly MemoryPermissionContract[]>
}

export interface MemoryEngine {
  registry: MemoryRegistry
  router: MemoryRouter
  authorize(request: MemoryRouteRequest): Promise<MemoryRouteDecision>
}
