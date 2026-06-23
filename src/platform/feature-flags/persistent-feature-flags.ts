import type { Prisma } from '@prisma/client';
import type { DatabaseTransactionRunner } from '@/database/contracts';
import type {
  FeatureFlagContext,
  FeatureFlagDecision,
  FeatureFlagProvider,
} from '@/platform/feature-flags/contracts';
import type { KernelComponentPort, KernelOperationRequest } from '@/platform/kernel/contracts';

export type FeatureFlagAvailability = 'available' | 'unavailable' | 'retired';

export interface RegisteredFeatureFlag {
  id: string;
  name: string;
  ownerComponentId: string;
  description: string;
  status: FeatureFlagAvailability;
  secureDefault: false;
}

export interface FeatureFlagPersistence {
  register(
    name: string,
    ownerComponentId: string,
    description: string,
    transaction: Prisma.TransactionClient
  ): Promise<RegisteredFeatureFlag>;
  setValue(
    name: string,
    environment: string,
    enabled: boolean,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<FeatureFlagDecision>;
  evaluate(name: string, environment: string): Promise<FeatureFlagDecision>;
  list(environment: string): Promise<readonly FeatureFlagDecision[]>;
}

export class PersistentFeatureFlagProvider implements FeatureFlagProvider {
  constructor(private readonly persistence: FeatureFlagPersistence) {}

  evaluate(name: string, context: FeatureFlagContext): Promise<FeatureFlagDecision> {
    return this.persistence.evaluate(name, context.environment);
  }

  list(context: FeatureFlagContext): Promise<readonly FeatureFlagDecision[]> {
    return this.persistence.list(context.environment);
  }
}

export type FeatureFlagOperationPayload =
  | { name: string; ownerComponentId: string; description: string; reason: string }
  | { name: string; environment: string; enabled: boolean; reason: string };

export class FeatureFlagRegistryService implements KernelComponentPort {
  readonly componentId = 'platform.feature-flags';
  readonly capabilities = ['feature-flags.read', 'feature-flags.write'] as const;

  constructor(
    private readonly persistence: FeatureFlagPersistence,
    private readonly transactions: DatabaseTransactionRunner
  ) {}

  async handle<TResult = unknown>(
    request: KernelOperationRequest<FeatureFlagOperationPayload>
  ): Promise<TResult> {
    if (request.target !== this.componentId) throw new Error('Feature Flag target is invalid');
    if (request.action === 'register') {
      const payload = readRegistration(request.payload);
      validateReason(payload.reason);
      validateFlagName(payload.name);
      if (!payload.ownerComponentId.trim() || !payload.description.trim()) {
        throw new Error('Feature Flag owner and description are required');
      }
      return this.transactions.transaction((transaction) =>
        this.persistence.register(
          payload.name,
          payload.ownerComponentId,
          payload.description,
          transaction
        )
      ) as Promise<TResult>;
    }
    if (request.action === 'update') {
      const payload = readUpdate(request.payload);
      validateFlagName(payload.name);
      validateEnvironment(payload.environment);
      validateReason(payload.reason);
      return this.transactions.transaction((transaction) =>
        this.persistence.setValue(
          payload.name,
          payload.environment,
          payload.enabled,
          payload.reason,
          transaction
        )
      ) as Promise<TResult>;
    }
    throw new Error('Feature Flag action is unsupported');
  }
}

function readRegistration(payload: FeatureFlagOperationPayload | undefined) {
  if (!payload || !('ownerComponentId' in payload) || !('description' in payload)) {
    throw new Error('Feature Flag registration payload is invalid');
  }
  return payload;
}

function readUpdate(payload: FeatureFlagOperationPayload | undefined) {
  if (!payload || !('environment' in payload) || !('enabled' in payload)) {
    throw new Error('Feature Flag update payload is invalid');
  }
  return payload;
}

function validateFlagName(name: string): void {
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(name)) {
    throw new Error('Feature Flag name is invalid');
  }
}

function validateEnvironment(environment: string): void {
  if (!['development', 'test', 'staging', 'production'].includes(environment)) {
    throw new Error('Feature Flag environment is invalid');
  }
}

function validateReason(reason: string): void {
  if (!reason.trim()) throw new Error('Feature Flag mutation reason is required');
}
