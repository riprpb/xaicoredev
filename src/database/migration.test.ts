import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const schemaPath = path.resolve('prisma/schema.prisma');
const migrationPath = path.resolve(
  'prisma/migrations/20260622170000_gate_one_foundation/migration.sql'
);
const registryMigrationPath = path.resolve(
  'prisma/migrations/20260622180000_persistent_platform_registry/migration.sql'
);
const featureFlagMigrationPath = path.resolve(
  'prisma/migrations/20260622190000_registered_feature_flags/migration.sql'
);

describe('Gate 1 database migration baseline', () => {
  it('contains only approved foundation domains', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    expect(schema).toContain('model Identity');
    expect(schema).toContain('model OwnerBootstrapRecord');
    expect(schema).toContain('model AuditRecord');
    expect(schema).not.toMatch(/model (Wallet|Transaction|Brain|Subscription)\b/);
    expect(schema).not.toContain('password');
  });

  it('enforces immutable Owner, append-only audit, and singleton authority constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('owner_bootstrap_singleton_check');
    expect(migration).toContain('one_active_owner_authority');
    expect(migration).toContain('owner_bootstrap_immutable');
    expect(migration).toContain('audit_records_append_only');
    expect(migration).toContain('session_expiry_check');
    expect(migration).toContain('idempotency_expiry_check');
  });

  it('persists opaque Kernel identifiers without assuming UUID format', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('"actor_id" VARCHAR(255)');
    expect(migration).toContain('"request_id" VARCHAR(255) NOT NULL');
    expect(migration).toContain('"correlation_id" VARCHAR(255) NOT NULL');
    expect(migration).toContain('"permission_decision_id" VARCHAR(255)');
  });

  it('keeps manifest versions immutable and all AI registrations offline', async () => {
    const migration = await readFile(registryMigrationPath, 'utf8');

    expect(migration).toContain('platform_manifests_immutable');
    expect(migration).toContain('platform_registry_ai_execution_check');
    expect(migration).toContain('platform_registry_ai_lifecycle_check');
    expect(migration).toContain('platform_registry_active_manifest_fkey');
  });

  it('requires Registry-owned Feature Flags with secure false defaults', async () => {
    const migration = await readFile(featureFlagMigrationPath, 'utf8');

    expect(migration).toContain('feature_flag_definitions_registry_record_id_fkey');
    expect(migration).toContain('feature_flag_secure_default_check');
    expect(migration).toContain('feature_flag_values_definition_id_environment_key');
    expect(migration).toContain('feature_flag_value_version_check');
  });
});
