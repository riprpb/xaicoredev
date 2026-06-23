import type {
  ComponentHealth,
  DependencyHealth,
  HealthContract,
  HealthStatus,
} from '@/platform/contracts/health';

export interface DependencyProbe {
  id: string;
  required: boolean;
  check(): Promise<HealthStatus>;
}

export class PlatformHealthService implements HealthContract {
  constructor(
    private readonly componentId: string,
    private readonly version: string,
    private readonly dependencies: readonly DependencyProbe[],
    private readonly now: () => Date = () => new Date()
  ) {
    if (!componentId.trim() || !version.trim()) {
      throw new Error('Health component ID and version are required');
    }
  }

  async checkHealth(): Promise<ComponentHealth> {
    return this.checkDependencies();
  }

  async checkReadiness(): Promise<ComponentHealth> {
    return this.checkDependencies();
  }

  async checkLiveness(): Promise<ComponentHealth> {
    return this.result('healthy', []);
  }

  private async checkDependencies(): Promise<ComponentHealth> {
    const dependencies = await Promise.all(
      this.dependencies.map(async (probe): Promise<DependencyHealth> => {
        const checkedAt = this.now().toISOString();
        try {
          return {
            id: probe.id,
            required: probe.required,
            status: await probe.check(),
            checkedAt,
          };
        } catch {
          return {
            id: probe.id,
            required: probe.required,
            status: 'unhealthy',
            checkedAt,
            message: 'dependency check failed',
          };
        }
      })
    );
    return this.result(aggregateStatus(dependencies), dependencies);
  }

  private result(status: HealthStatus, dependencies: readonly DependencyHealth[]): ComponentHealth {
    return {
      componentId: this.componentId,
      status,
      version: this.version,
      checkedAt: this.now().toISOString(),
      dependencies: [...dependencies],
    };
  }
}

function aggregateStatus(dependencies: readonly DependencyHealth[]): HealthStatus {
  if (dependencies.some((dependency) => dependency.required && dependency.status !== 'healthy')) {
    return 'unhealthy';
  }
  if (dependencies.some((dependency) => dependency.status !== 'healthy')) return 'degraded';
  return 'healthy';
}
