# XAICore Documentation

## Governing Order

1. [Constitution](constitution/01-foundation.md)
2. [Governance and Authority](constitution/02-governance.md)
3. [System Kernel](constitution/03-system-kernel.md)
4. [Enterprise Architecture](architecture/platform-overview.md)
5. [Engineering Standards](engineering/standards.md)
6. [Product Roadmap](roadmap/gate-one-implementation-plan.md)

When documents conflict, the higher document governs. Product code never overrides
Owner authority or constitutional rules.

## Documentation Areas

- `constitution/`: permanent governing principles and authority.
- `architecture/`: system boundaries, diagrams, and component designs.
- `engineering/`: implementation and quality standards.
- `adr/`: numbered Architecture Decision Records explaining why decisions were made.
- `api/`: API contracts, conventions, and endpoint documentation.
- `database/`: data architecture, migrations, and lifecycle policies.
- `ai/`: AI manifests, Registry, Brain, memory, and provider documentation.
- `security/`: threat models, controls, incident procedures, and trust architecture.
- `deployment/`: environments, CI/CD, release, rollback, and recovery.
- `roadmap/`: approved execution plans and phase gates.
- `operations/`: runbooks, health, observability, support, and Owner operations.
- `gates/`: immutable Gate evidence indexes and accepted engineering snapshots.

## Status Language

- **Planned:** approved direction without implementation.
- **Contract:** interface or schema exists without operational behavior.
- **Prototype:** experimental code not integrated into the active platform.
- **Integrated:** connected to the active application but not release-qualified.
- **Tested:** automated behavior and failure paths pass quality gates.
- **Staged:** validated in a production-like environment.
- **Production:** explicitly approved and deployed with monitoring and rollback.

Legacy documents under `docs/reference/` are historical evidence, not authoritative
statements of implementation status.

## Gate History

- [Gate 0 evidence](gates/gate-0/README.md)
