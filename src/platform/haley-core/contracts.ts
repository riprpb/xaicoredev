import type { ComponentHealth, HealthStatus } from '@/platform/contracts/health';
import type { FeatureFlagDecision } from '@/platform/feature-flags/contracts';
import type { KernelReadGateway } from '@/platform/kernel/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type { ComponentManifest } from '@/platform/manifests/contracts';

export interface RegistryAwarenessRecord {
  componentId: string;
  state: string;
  updatedAt: string;
}

export interface RepositoryAwarenessReport {
  revision: string;
  branch?: string;
  clean: boolean;
}

export interface ArchitectureAwarenessReport {
  componentIds: readonly string[];
  warnings: readonly string[];
}

export interface LogAggregationReport {
  windowStartedAt: string;
  windowEndedAt: string;
  counts: Readonly<Record<string, number>>;
}

export interface ConfigurationAwarenessReport {
  environment: string;
  valid: boolean;
  descriptorCount: number;
  issues: readonly string[];
}

export interface HaleyCoreDiagnostic {
  source: string;
  status: Exclude<HealthStatus, 'healthy'>;
  message: string;
}

export interface HaleyCoreSnapshot {
  generatedAt: string;
  status: HealthStatus;
  manifests: readonly ComponentManifest[];
  registrations: readonly RegistryAwarenessRecord[];
  featureFlags: readonly FeatureFlagDecision[];
  componentHealth: readonly ComponentHealth[];
  repository?: RepositoryAwarenessReport;
  architecture?: ArchitectureAwarenessReport;
  logs?: LogAggregationReport;
  configuration?: ConfigurationAwarenessReport;
  diagnostics: readonly HaleyCoreDiagnostic[];
}

export type HaleyCoreKernelGateway = KernelReadGateway;

export interface HaleyCoreMonitor {
  inspect(context: KernelRequestContext): Promise<HaleyCoreSnapshot>;
}
