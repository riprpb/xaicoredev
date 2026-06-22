# Release and Gate Versioning

Every completed development Gate ends with:

1. A clean, reproducible installation.
2. Passing Gate quality, security, documentation, architecture, and verification checks.
3. A milestone assessment listing pass/fail status and outstanding issues.
4. A dedicated commit containing the accepted Gate state.
5. Owner review and approval.
6. An annotated Git tag pointing to that commit.
7. Archival of all Gate evidence.

## Tag Format

```text
v<major>.<minor>.<patch>-gate<number>
```

Initial roadmap tags:

- Gate 0: `v0.1.0-gate0`
- Gate 1: `v0.2.0-gate1`
- Gate 2: `v0.3.0-gate2`

Future Gates continue sequentially.

## Gate Evidence

Every completed Gate archives:

- Gate Assessment
- Architecture Assessment
- Security Assessment
- Dependency Audit
- Build Results
- Test Results
- Documentation Changes
- ADR Changes
- Repository Tree Snapshot
- Release Notes
- Configuration Snapshot
- Feature Flag Snapshot
- Manifest Snapshot

These artifacts become the permanent historical record for that Gate.

## Tag Immutability

Gate tags are immutable release evidence.

Published Gate tags shall never be moved, reassigned, or deleted.

Corrections require a new patch release and a new annotated tag rather than modifying
an existing published tag.

Annotated tag messages summarize:

- Gate Number
- Verification Results
- Owner Approval Status
- Outstanding Issues
- Related ADRs
- Related Documentation

## Gate vs. Release

A Gate represents engineering completion.

A Release represents customer readiness.

A Gate may exist without a Release.

A Release shall never exist without successfully completing its required Gate.

Production releases use standard Semantic Versioning after successful Gate completion.

Examples:

```text
v1.0.0-alpha
v1.0.0-beta
v1.0.0-rc1
v1.0.0
v1.1.0
v2.0.0
```

Gate tags remain part of the permanent engineering history and are independent of
customer-facing releases.

## Rollback

Rollback never moves or modifies published tags.

Recovery is performed by creating a new branch or release from the desired tagged
commit while preserving historical integrity.

## Engineering Principle

Every Gate should leave XAICore more secure, more maintainable, more thoroughly
documented, and better understood than the Gate before it.

The purpose of Gate versioning is not merely to mark progress, but to preserve a
complete, auditable engineering history of the platform.
