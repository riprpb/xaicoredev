import type { KernelComponentPort, KernelOperationRequest } from '@/platform/kernel/contracts';
import type { BrainContract, MemoryRegistry } from '@/platform/memory/contracts';

export class MemoryFoundationService implements KernelComponentPort {
  readonly componentId = 'platform.memory';
  readonly capabilities = ['memory.read'] as const;

  constructor(private readonly registry: MemoryRegistry) {}

  async handle<TResult = unknown>(request: KernelOperationRequest): Promise<TResult> {
    if (request.target !== this.componentId || request.capability !== 'memory.read') {
      throw new Error('Memory foundation request is invalid');
    }
    if (request.action === 'list') {
      return (await this.registry.listBrains()) as TResult;
    }
    if (request.action === 'read') {
      const id = readBrainId(request.payload);
      return (await this.registry.getBrain(id)) as TResult;
    }
    throw new Error('Memory foundation action is unsupported');
  }
}

function readBrainId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new Error('Memory Brain ID is required');
  const id = (payload as Partial<BrainContract>).id;
  if (!id?.trim()) throw new Error('Memory Brain ID is required');
  return id;
}
