import type { AuditEvent, KernelAuditReader } from '@/platform/audit/contracts';
import type { FeatureFlagDecision } from '@/platform/feature-flags/contracts';
import type { KernelGateway, KernelOperationResult } from '@/platform/kernel/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type { PlatformRegistrationRecord } from '@/platform/registry/platform-registry';

export interface OwnerPlatformStatus {
  health?: unknown;
  registry: readonly PlatformRegistrationRecord[];
  featureFlags: readonly FeatureFlagDecision[];
  configuration?: unknown;
  available: boolean;
}

export interface OwnerFeatureFlagResult {
  operation: KernelOperationResult<FeatureFlagDecision>;
  audit: readonly AuditEvent[];
}

export class OwnerOperationsService {
  constructor(
    private readonly kernel: KernelGateway,
    private readonly audit: KernelAuditReader
  ) {}

  async getStatus(context: KernelRequestContext): Promise<OwnerPlatformStatus> {
    const [health, registry, featureFlags, configuration] = await Promise.all([
      this.kernel.read({
        context,
        target: 'platform.health',
        capability: 'health.read',
        action: 'read',
      }),
      this.kernel.read<readonly PlatformRegistrationRecord[]>({
        context,
        target: 'platform.registry',
        capability: 'registry.read',
        action: 'list',
      }),
      this.kernel.read<readonly FeatureFlagDecision[]>({
        context,
        target: 'platform.feature-flags',
        capability: 'feature-flags.read',
        action: 'list',
      }),
      this.kernel.read({
        context,
        target: 'platform.configuration',
        capability: 'configuration.read',
        action: 'read',
      }),
    ]);
    return {
      health: health.result,
      registry: registry.result ?? [],
      featureFlags: featureFlags.result ?? [],
      configuration: configuration.result,
      available: [health, registry, featureFlags, configuration].every((result) => result.accepted),
    };
  }

  async updateFeatureFlag(
    context: KernelRequestContext,
    name: string,
    enabled: boolean,
    reason: string
  ): Promise<OwnerFeatureFlagResult> {
    if (!reason.trim()) throw new Error('Feature Flag change reason is required');
    const operation = await this.kernel.execute<
      { name: string; environment: string; enabled: boolean; reason: string },
      FeatureFlagDecision
    >({
      context,
      target: 'platform.feature-flags',
      capability: 'feature-flags.write',
      action: 'update',
      payload: { name, environment: context.environment, enabled, reason },
    });
    const audit = await this.audit.listByCorrelationId(context.correlationId);
    return { operation, audit };
  }
}
