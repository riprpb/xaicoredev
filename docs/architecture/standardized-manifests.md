# Standardized Manifests

Every AI, service, module, plugin, and infrastructure component uses the same base
manifest. The manifest is the authoritative discovery and dependency declaration,
not proof that a component is authorized or running.

Required fields include:

- Schema version, stable ID, display name, semantic version, and component kind.
- Description, accountable owner, implementation status, and documentation path.
- Capabilities and requested permissions.
- Required and optional dependencies with version ranges.
- Health, readiness, liveness, and optional metrics endpoints.
- Configuration key names and optional controlling feature flag.

The TypeScript contract and validator are in `src/platform/manifests/`. A JSON Schema
for external tooling is in `config/manifests/component-manifest.schema.json`.

AI manifests add purpose, classification, limitations, Brain assignments, and provider
capabilities. Future specialized manifests may extend the base without weakening its
required fields.
