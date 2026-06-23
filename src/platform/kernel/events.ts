import type { PlatformEvent } from '@/platform/events/contracts';

export const KERNEL_EVENT_TYPES = [
  'kernel.operation.requested',
  'kernel.permission.evaluated',
  'kernel.operation.succeeded',
  'kernel.operation.failed',
  'kernel.lifecycle.requested',
  'kernel.lifecycle.completed',
] as const;

export type KernelEventType = (typeof KERNEL_EVENT_TYPES)[number];

export interface KernelEvent<TPayload = unknown> extends PlatformEvent<TPayload> {
  type: KernelEventType;
  source: 'system.kernel';
}
