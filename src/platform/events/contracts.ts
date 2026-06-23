import type { KernelRequestContext } from '@/platform/kernel/context';

export interface PlatformEvent<TPayload = unknown> {
  id: string;
  type: string;
  source: string;
  occurredAt: string;
  context: KernelRequestContext;
  payload: TPayload;
}

export interface KernelEventPublisher {
  publish<TPayload>(event: PlatformEvent<TPayload>): Promise<void>;
}

export interface KernelEventSubscriber<TPayload = unknown> {
  eventTypes: readonly string[];
  handle(event: PlatformEvent<TPayload>): Promise<void>;
}

export interface KernelEventRouter extends KernelEventPublisher {
  subscribe(subscriber: KernelEventSubscriber): void;
}
