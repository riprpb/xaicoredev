# Repository Structure

## Active Layout

```text
xaicoredev/
|-- .github/workflows/       Automated quality and security gates
|-- config/                  Versioned, non-secret configuration examples and schemas
|-- docs/                    Governing, architecture, assessment, and roadmap documents
|-- prisma/                  Authoritative PostgreSQL schema and future migrations
|-- public/                  Deployable static assets
|-- src/                     Active application source only
|   |-- config/              Validated runtime configuration
|   |-- pages/               User experience pages
|   |-- platform/            Kernel-level contracts and infrastructure foundations
|   |   |-- contracts/       Shared health and platform contracts
|   |   |-- feature-flags/   Configuration-driven flag contracts
|   |   |-- lifecycle/       Standard lifecycle state contracts
|   |   |-- manifests/       Component manifests and validation
|   |   |-- memory/          Memory Engine and Brain contracts
|   |   |-- providers/       External AI Provider Gateway contracts
|   |   |-- registry/        AI Registry contracts and registration lifecycle
|   |   `-- trust/           Trust Gateway pipeline contracts
|   |-- server/              Express application composition
|   |-- services/            Active application service clients
|   |-- types/               Shared application types
|   `-- utils/               Narrow application utilities
|-- archive/                 Compressed and binary historical material; never built
|-- backups/                 Preserved snapshots and editor state; never built
`-- legacy/reference/        Unverified source preserved for selective recovery
```

## Boundaries

- Only `src/`, root build configuration, `config/`, `prisma/`, and `public/`
  participate in application builds.
- `legacy/`, `archive/`, `backups/`, `.codex/`, and `.copilot/` are excluded from
  lint, test, build, deployment, and Git by default.
- A legacy file may enter active source only through a reviewed feature change with
  architecture fit, provenance, security review, tests, and documentation.
- Generated output belongs in ignored directories such as `dist/` and `coverage/`.
- Prisma migrations will be version controlled; they are no longer ignored.

## Repository Root Decision

The application is structured so `xaicoredev/` can become the Git root. The existing
parent Git repository remains untouched during Gate 0 because it has no commits and
contains neighboring material. Initializing or relocating Git metadata is an Owner
machine-level operation and must be completed deliberately before the first commit.
