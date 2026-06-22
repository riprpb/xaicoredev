# Release and Gate Versioning

Every completed development Gate ends with:

1. A clean reproducible installation.
2. Passing Gate quality, security, documentation, and architecture checks.
3. A milestone assessment listing pass/fail status and outstanding issues.
4. A dedicated commit containing the accepted Gate state.
5. An annotated Git tag pointing to that commit.

## Tag Format

```text
v<major>.<minor>.<patch>-gate<number>
```

Initial roadmap tags:

- Gate 0: `v0.1.0-gate0`
- Gate 1: `v0.2.0-gate1`
- Gate 2: `v0.3.0-gate2`

Tags are immutable release evidence. Corrections receive a new patch tag rather than
moving or replacing an existing published tag. Annotated tag messages summarize the
Gate, verification results, approval state, and known outstanding issues.

Production releases may use stable semantic versions after their Gate release is
accepted. A Gate tag does not itself authorize production deployment.
