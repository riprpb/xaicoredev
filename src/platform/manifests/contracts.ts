import type { HealthContract } from '@/platform/contracts/health'
import type { LifecycleContract } from '@/platform/lifecycle/contracts'

export const COMPONENT_KINDS = [
  'ai',
  'service',
  'module',
  'plugin',
  'infrastructure',
] as const

export type ComponentKind = (typeof COMPONENT_KINDS)[number]
export type DependencyRequirement = 'required' | 'optional'

export interface ComponentDependency {
  id: string
  kind: ComponentKind
  requirement: DependencyRequirement
  versionRange: string
  capabilities?: readonly string[]
}

export interface ComponentEndpointManifest {
  health: string
  readiness: string
  liveness: string
  metrics?: string
}

export interface ComponentManifest {
  schemaVersion: '1.0'
  id: string
  displayName: string
  version: string
  kind: ComponentKind
  description: string
  owner: string
  status: 'experimental' | 'active' | 'deprecated' | 'retired'
  capabilities: readonly string[]
  permissions: readonly string[]
  dependencies: readonly ComponentDependency[]
  endpoints: ComponentEndpointManifest
  configurationKeys: readonly string[]
  featureFlag?: string
  documentation: string
}

export interface ManagedComponent {
  manifest: ComponentManifest
  health: HealthContract
  lifecycle: LifecycleContract
}
