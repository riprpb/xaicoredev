export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface DependencyHealth {
  id: string
  required: boolean
  status: HealthStatus
  checkedAt: string
  message?: string
}

export interface ComponentHealth {
  componentId: string
  status: HealthStatus
  version: string
  checkedAt: string
  dependencies: DependencyHealth[]
  details?: Readonly<Record<string, unknown>>
}

export interface HealthContract {
  checkHealth(): Promise<ComponentHealth>
  checkReadiness(): Promise<ComponentHealth>
  checkLiveness(): Promise<ComponentHealth>
}
