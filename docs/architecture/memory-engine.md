# Memory Engine Design

## Purpose

Memory is a permission-controlled platform resource. It is not owned by an AI agent.
The Memory Engine coordinates discovery, routing, permissions, encryption policy,
version metadata, and retention contracts.

## Gate 0 Scope

- `BrainContract` describes a cognitive domain without storing knowledge.
- `MemoryRegistry` defines Brain registration and permission discovery.
- `MemoryPermissionContract` grants explicit operations to a subject and Brain.
- `MemoryEncryptionContract` references keys; it never contains key material.
- `MemoryVersionContract` defines lineage, checksum, actor, and timestamp metadata.
- `MemoryRouter` returns an explicit allow/deny routing decision with a reason.
- `MemoryEngine` composes registry, routing, and authorization contracts.

## Request Flow

```mermaid
sequenceDiagram
    participant AI as Registered AI
    participant Kernel as Permission Engine
    participant Registry as Memory Registry
    participant Router as Memory Router
    participant Brain as Brain Adapter
    participant Audit as Audit Engine

    AI->>Kernel: MemoryRouteRequest
    Kernel->>Registry: Resolve permissions and Brain
    Registry->>Router: Candidate route
    Router-->>Kernel: Allow or deny decision
    Kernel->>Audit: Record decision
    Kernel-->>AI: Decision or permissioned Brain response
```

Brain storage, embeddings, retrieval, personal memory, retention jobs, and deletion
workflows are intentionally deferred. Gate 1 designs persistence and constitutional
authorization before any user or AI memory is stored.
