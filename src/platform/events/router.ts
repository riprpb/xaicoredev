import type {
  KernelEventRouter,
  KernelEventSubscriber,
  PlatformEvent,
} from '@/platform/events/contracts';

export class InMemoryKernelEventRouter implements KernelEventRouter {
  private readonly subscribers = new Set<KernelEventSubscriber>();

  subscribe(subscriber: KernelEventSubscriber): void {
    this.subscribers.add(subscriber);
  }

  async publish<TPayload>(event: PlatformEvent<TPayload>): Promise<void> {
    const matches = [...this.subscribers].filter((subscriber) =>
      subscriber.eventTypes.includes(event.type)
    );
    await Promise.all(matches.map((subscriber) => subscriber.handle(event)));
  }
}
