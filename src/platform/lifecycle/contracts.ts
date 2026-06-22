export const PLATFORM_LIFECYCLE_STATES = [
  'provisioning',
  'initializing',
  'running',
  'busy',
  'idle',
  'sleeping',
  'maintenance',
  'updating',
  'restarting',
  'recovery',
  'shutdown',
  'offline',
  'deprecated',
  'removed',
] as const

export type PlatformLifecycleState = (typeof PLATFORM_LIFECYCLE_STATES)[number]

export interface LifecycleTransitionRequest {
  componentId: string
  from: PlatformLifecycleState
  to: PlatformLifecycleState
  requestedBy: string
  reason: string
  correlationId: string
}

export interface LifecycleTransitionResult extends LifecycleTransitionRequest {
  accepted: boolean
  occurredAt: string
  message?: string
}

export interface LifecycleContract {
  getState(): Promise<PlatformLifecycleState>
  requestTransition(
    request: LifecycleTransitionRequest,
  ): Promise<LifecycleTransitionResult>
}
