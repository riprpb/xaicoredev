export const KERNEL_ACTOR_KINDS = [
  'owner',
  'successor',
  'administrator',
  'user',
  'service',
  'ai',
  'anonymous',
] as const;

export type KernelActorKind = (typeof KERNEL_ACTOR_KINDS)[number];

export interface KernelActorContext {
  id?: string;
  sessionId?: string;
  kind: KernelActorKind;
  authenticated: boolean;
}

export interface KernelRequestContext {
  requestId: string;
  correlationId: string;
  environment: string;
  actor: KernelActorContext;
  requestedAt: string;
}

export function createKernelRequestContext(
  context: KernelRequestContext
): Readonly<KernelRequestContext> {
  if (!context.requestId.trim()) throw new Error('Kernel request ID is required');
  if (!context.correlationId.trim()) {
    throw new Error('Kernel correlation ID is required');
  }
  if (!context.environment.trim()) {
    throw new Error('Kernel environment is required');
  }
  if (context.actor.authenticated && !context.actor.id?.trim()) {
    throw new Error('Authenticated Kernel actors require an ID');
  }
  if (!context.actor.authenticated && context.actor.kind !== 'anonymous') {
    throw new Error('Unauthenticated Kernel actors must be anonymous');
  }
  if (Number.isNaN(Date.parse(context.requestedAt))) {
    throw new Error('Kernel request timestamp must be ISO-8601 compatible');
  }

  return Object.freeze({ ...context, actor: Object.freeze({ ...context.actor }) });
}
