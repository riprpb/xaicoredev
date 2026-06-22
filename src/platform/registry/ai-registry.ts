import type { ComponentHealth } from '@/platform/contracts/health'
import type { ComponentDependency } from '@/platform/manifests/contracts'
import type { PlatformLifecycleState } from '@/platform/lifecycle/contracts'
import type { ComponentManifest } from '@/platform/manifests/contracts'
import { validateComponentManifest } from '@/platform/manifests/validation'

export interface AIBrainAssignment {
  brainId: string
  permissions: readonly string[]
  required: boolean
}

export interface AIManifest extends ComponentManifest {
  kind: 'ai'
  classification: string
  purpose: string
  limitations: readonly string[]
  brains: readonly AIBrainAssignment[]
  providerCapabilities: readonly string[]
}

export type AIRegistrationStatus =
  | 'submitted'
  | 'validating'
  | 'rejected'
  | 'registered'
  | 'disabled'
  | 'removed'

export interface AIRegistrationRecord {
  manifest: AIManifest
  status: AIRegistrationStatus
  lifecycleState: PlatformLifecycleState
  registeredAt?: string
  updatedAt: string
  validationErrors: readonly string[]
  health?: ComponentHealth
}

export interface AIRegistryQuery {
  status?: AIRegistrationStatus
  capability?: string
  dependency?: Pick<ComponentDependency, 'id' | 'kind'>
}

export interface AIRegistry {
  register(manifest: AIManifest): Promise<AIRegistrationRecord>
  get(id: string): Promise<AIRegistrationRecord | undefined>
  list(query?: AIRegistryQuery): Promise<readonly AIRegistrationRecord[]>
  updateHealth(id: string, health: ComponentHealth): Promise<void>
  disable(id: string, reason: string, actorId: string): Promise<void>
  remove(id: string, reason: string, actorId: string): Promise<void>
}

export function validateAIManifest(manifest: AIManifest): readonly string[] {
  const errors = [...validateComponentManifest(manifest).errors]
  if (!manifest.purpose.trim()) errors.push('purpose is required')
  if (!manifest.classification.trim()) errors.push('classification is required')
  if (manifest.limitations.length === 0) {
    errors.push('at least one limitation must be declared')
  }
  const brainIds = new Set<string>()
  for (const brain of manifest.brains) {
    if (brainIds.has(brain.brainId)) {
      errors.push(`brain ${brain.brainId} is assigned more than once`)
    }
    brainIds.add(brain.brainId)
  }
  return errors
}

export class InMemoryAIRegistry implements AIRegistry {
  private readonly records = new Map<string, AIRegistrationRecord>()

  async register(manifest: AIManifest): Promise<AIRegistrationRecord> {
    if (this.records.has(manifest.id)) {
      throw new Error(`AI ${manifest.id} is already registered`)
    }
    const errors = validateAIManifest(manifest)
    const now = new Date().toISOString()
    const record: AIRegistrationRecord = {
      manifest,
      status: errors.length === 0 ? 'registered' : 'rejected',
      lifecycleState: errors.length === 0 ? 'offline' : 'removed',
      registeredAt: errors.length === 0 ? now : undefined,
      updatedAt: now,
      validationErrors: errors,
    }
    this.records.set(manifest.id, record)
    return record
  }

  async get(id: string): Promise<AIRegistrationRecord | undefined> {
    return this.records.get(id)
  }

  async list(query: AIRegistryQuery = {}): Promise<readonly AIRegistrationRecord[]> {
    return [...this.records.values()].filter((record) => {
      if (query.status && record.status !== query.status) return false
      if (
        query.capability &&
        !record.manifest.capabilities.includes(query.capability)
      ) {
        return false
      }
      if (
        query.dependency &&
        !record.manifest.dependencies.some(
          (dependency) =>
            dependency.id === query.dependency?.id &&
            dependency.kind === query.dependency.kind,
        )
      ) {
        return false
      }
      return true
    })
  }

  async updateHealth(id: string, health: ComponentHealth): Promise<void> {
    const record = this.requireRecord(id)
    this.records.set(id, { ...record, health, updatedAt: new Date().toISOString() })
  }

  async disable(id: string, reason: string, actorId: string): Promise<void> {
    void reason
    void actorId
    const record = this.requireRecord(id)
    this.records.set(id, {
      ...record,
      status: 'disabled',
      lifecycleState: 'shutdown',
      updatedAt: new Date().toISOString(),
    })
  }

  async remove(id: string, reason: string, actorId: string): Promise<void> {
    void reason
    void actorId
    const record = this.requireRecord(id)
    this.records.set(id, {
      ...record,
      status: 'removed',
      lifecycleState: 'removed',
      updatedAt: new Date().toISOString(),
    })
  }

  private requireRecord(id: string): AIRegistrationRecord {
    const record = this.records.get(id)
    if (!record) throw new Error(`AI ${id} is not registered`)
    return record
  }
}
