import type { ComponentManifest } from '@/platform/manifests/contracts';

export const HALEY_CORE_MANIFEST: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'haley.core',
  displayName: 'Haley Core',
  version: '0.1.0',
  kind: 'service',
  description: 'Provides read-only platform awareness and diagnostic aggregation.',
  owner: 'system-kernel',
  status: 'experimental',
  capabilities: [
    'manifest.awareness',
    'registry.awareness',
    'feature-flag.awareness',
    'health.aggregation',
    'platform.diagnostics',
    'repository.awareness',
    'architecture.reporting',
    'configuration.awareness',
    'log.aggregation',
  ],
  permissions: [
    'manifests.read',
    'registry.read',
    'feature-flags.read',
    'health.read',
    'repository.status.read',
    'architecture.read',
    'configuration.read',
    'logs.summary.read',
  ],
  dependencies: [
    {
      id: 'system.kernel',
      kind: 'infrastructure',
      requirement: 'required',
      versionRange: '^0.1.0',
    },
  ],
  endpoints: {
    health: '/internal/haley-core/health',
    readiness: '/internal/haley-core/readiness',
    liveness: '/internal/haley-core/liveness',
    metrics: '/internal/haley-core/metrics',
  },
  configurationKeys: [],
  documentation: '/docs/architecture/haley-core.md',
};
