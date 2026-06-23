import type { ComponentHealth, HealthStatus } from '@/platform/contracts/health';
import type { FeatureFlagDecision } from '@/platform/feature-flags/contracts';
import type {
  ArchitectureAwarenessReport,
  ConfigurationAwarenessReport,
  HaleyCoreDiagnostic,
  HaleyCoreKernelGateway,
  HaleyCoreMonitor,
  HaleyCoreSnapshot,
  LogAggregationReport,
  RegistryAwarenessRecord,
  RepositoryAwarenessReport,
} from '@/platform/haley-core/contracts';
import type { KernelReadAction } from '@/platform/kernel/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type { ComponentManifest } from '@/platform/manifests/contracts';

type SourceResult<T> =
  | { value: T; diagnostic?: never }
  | { value: T; diagnostic: HaleyCoreDiagnostic };

export class DefaultHaleyCoreMonitor implements HaleyCoreMonitor {
  constructor(
    private readonly kernel: HaleyCoreKernelGateway,
    private readonly now: () => Date = () => new Date()
  ) {}

  async inspect(context: KernelRequestContext): Promise<HaleyCoreSnapshot> {
    const [
      manifests,
      registry,
      featureFlags,
      health,
      repository,
      architecture,
      logs,
      configuration,
    ] = await Promise.all([
      this.read<readonly ComponentManifest[]>(
        context,
        'manifests',
        'platform.manifests',
        'manifests.read',
        'list',
        []
      ),
      this.read<readonly RegistryAwarenessRecord[]>(
        context,
        'registry',
        'platform.registry',
        'registry.read',
        'list',
        []
      ),
      this.read<readonly FeatureFlagDecision[]>(
        context,
        'feature-flags',
        'platform.feature-flags',
        'feature-flags.read',
        'list',
        []
      ),
      this.read<readonly ComponentHealth[]>(
        context,
        'health',
        'platform.health',
        'health.read',
        'list',
        []
      ),
      this.read<RepositoryAwarenessReport | undefined>(
        context,
        'repository',
        'platform.repository',
        'repository.status.read',
        'inspect',
        undefined
      ),
      this.read<ArchitectureAwarenessReport | undefined>(
        context,
        'architecture',
        'platform.architecture',
        'architecture.read',
        'inspect',
        undefined
      ),
      this.read<LogAggregationReport | undefined>(
        context,
        'logs',
        'platform.logs',
        'logs.summary.read',
        'summarize',
        undefined
      ),
      this.read<ConfigurationAwarenessReport | undefined>(
        context,
        'configuration',
        'platform.configuration',
        'configuration.read',
        'read',
        undefined
      ),
    ]);

    const results = [
      manifests,
      registry,
      featureFlags,
      health,
      repository,
      architecture,
      logs,
      configuration,
    ];
    const diagnostics = results.flatMap((result) => (result.diagnostic ? [result.diagnostic] : []));

    return {
      generatedAt: this.now().toISOString(),
      status: aggregateStatus(
        health.value.map((component) => component.status),
        diagnostics
      ),
      manifests: manifests.value,
      registrations: registry.value,
      featureFlags: featureFlags.value,
      componentHealth: health.value,
      repository: repository.value,
      architecture: architecture.value,
      logs: logs.value,
      configuration: configuration.value,
      diagnostics,
    };
  }

  private async read<T>(
    context: KernelRequestContext,
    source: string,
    target: string,
    capability: string,
    action: KernelReadAction,
    fallback: T
  ): Promise<SourceResult<T>> {
    try {
      const response = await this.kernel.read<T>({
        context,
        target,
        capability,
        action,
      });
      if (
        !response.accepted ||
        response.permission.effect !== 'allow' ||
        response.result === undefined
      ) {
        return unavailable(source, fallback);
      }
      return { value: response.result };
    } catch {
      return unavailable(source, fallback);
    }
  }
}

function unavailable<T>(source: string, fallback: T): SourceResult<T> {
  return {
    value: fallback,
    diagnostic: {
      source,
      status: 'degraded',
      message: 'Kernel-managed awareness source is unavailable',
    },
  };
}

function aggregateStatus(
  statuses: readonly HealthStatus[],
  diagnostics: readonly HaleyCoreDiagnostic[]
): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (diagnostics.length > 0 || statuses.includes('degraded')) return 'degraded';
  if (statuses.length === 0 || statuses.includes('unknown')) return 'unknown';
  return 'healthy';
}
