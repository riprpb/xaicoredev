# XAICore Engineering Standards

## Required Workflow

1. Understand the request and user value.
2. Search active source and documented decisions.
3. Review constitutional, architecture, security, and roadmap constraints.
4. Identify ownership, dependencies, permissions, risks, tests, and documentation.
5. Prefer extending coherent implementations over creating duplication.
6. Implement the smallest production-quality change advancing the approved phase.
7. Type-check, lint, test, build, scan dependencies, and review security.
8. Synchronize documentation and record significant decisions in an ADR.

## Kernel Integration Standard

- The Kernel is the sole architectural authority for platform communication.
- Every runtime interaction between platform components uses an approved Kernel
  contract, Registry, event, component port, or other Kernel-managed interface.
- Direct peer-to-peer platform calls are prohibited unless an accepted ADR explicitly
  authorizes a Kernel-managed exception.
- Every operation carries Kernel request and correlation context. Privileged operations
  additionally require authentication, permission evaluation, and append-only audit.
- Code review must reject hidden infrastructure access, direct provider or database
  calls outside approved adapters, and component imports that create runtime bypasses.
- Architecture tests should verify dependency direction and Kernel mediation as
  implementations are introduced.

This standard applies to every current and future AI, service, module, provider,
infrastructure component, plugin, Registry, Feature Flag, memory operation, audit or
security service, wallet, trading service, blockchain component, and extension.

## Haley Core Standard

Haley Core has comprehensive platform visibility through `KernelReadGateway` and
minimal execution authority. It may observe, aggregate, analyze, report, recommend,
and request Owner approval. It cannot mutate platform state, grant authority, execute
privileged operations, control infrastructure, or communicate outside Kernel-managed
interfaces.

## Definition of Done

A feature is complete only when working behavior, authorization, error handling,
structured logging, audit requirements, configuration, automated tests, documentation,
health and metrics, security review, performance consideration, deployment validation,
and architecture review are satisfied. Contracts and prototypes must be labeled and
never represented as production features.

Database changes are migration-driven. Secrets never enter source. APIs are versioned,
authenticated, authorized, rate-limited, observable, and tested.
