# Module Dependency Diagram

```mermaid
flowchart LR
    Web[src/pages and src/services] --> API[src/server]
    API --> Config[src/config]
    API --> Platform[src/platform]

    Platform --> Health[contracts/health]
    Platform --> Lifecycle[lifecycle]
    Platform --> Manifest[manifests]
    Platform --> Registry[registry]
    Platform --> Memory[memory]
    Platform --> Provider[providers]
    Platform --> Trust[trust]
    Platform --> Flags[feature-flags]

    Registry --> Manifest
    Registry --> Health
    Registry --> Lifecycle
    Memory --> Manifest
    Provider --> Flags
    Trust --> Health

    Database[(PostgreSQL / Prisma - Gate 1)]
    Registry -. future repository .-> Database
    Memory -. future metadata .-> Database
    API -. future accounts .-> Database
```

## Dependency Law

- `src/platform` must not depend on UI code or business modules.
- Contract packages may depend only on narrower platform contracts.
- Business modules may depend on platform contracts, never the reverse.
- Provider adapters implement Provider Gateway interfaces outside the core contracts.
- Persistence is introduced through repositories in Gate 1, not directly inside
  domain contracts.
- Circular dependencies are prohibited.
