# Module Dependency Diagram

```mermaid
flowchart LR
    Web[src/pages and src/services] --> API[src/server]
    API --> Kernel[kernel]

    Kernel --> Health[contracts/health]
    Kernel --> Lifecycle[lifecycle]
    Kernel --> Manifest[manifests]
    Kernel --> Registry[registry]
    Kernel --> Memory[memory]
    Kernel --> Provider[providers]
    Kernel --> Trust[trust]
    Kernel --> Flags[feature-flags]
    Kernel --> HaleyCore[haley-core]
    Kernel --> Permission[permissions]
    Kernel --> Audit[audit]
    Kernel --> Config[config]
    Kernel --> Events[events]

    Kernel -. repositories .-> Database[(PostgreSQL / Prisma - Gate 1)]
```

## Dependency Law

- The Kernel is the single runtime integration center.
- Platform components implement Kernel ports and do not invoke peer implementations.
- Shared contract imports may depend only on narrower platform contracts and carry no
  runtime authority.
- Business modules and AI may depend on Kernel contracts; the Kernel never depends on
  UI or business modules.
- Provider adapters, persistence adapters, and external infrastructure remain behind
  Kernel-owned contracts.
- Persistence is introduced through repositories owned by Kernel services, not
  directly inside domain contracts.
- Circular dependencies and runtime peer-to-peer platform calls are prohibited.
