# Gate 0 Manifest Snapshot

## Standard

- Schema version: `1.0`
- Component kinds: `ai`, `service`, `module`, `plugin`, `infrastructure`
- Manifest JSON Schema: `config/manifests/component-manifest.schema.json`
- TypeScript contract: `src/platform/manifests/contracts.ts`
- Validator: `src/platform/manifests/validation.ts`

## Required Base Fields

Schema version, ID, display name, semantic version, kind, description, owner, status,
capabilities, permissions, dependencies, health/readiness/liveness endpoints,
configuration keys, optional feature flag, and documentation.

## AI Extension

AI manifests additionally declare classification, purpose, limitations, Brain
assignments, and provider capabilities.

## Registered Components

No production component manifest is registered. The in-memory Registry is exercised
only by a test manifest. All future AI systems remain offline and disabled.
