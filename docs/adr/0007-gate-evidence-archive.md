# ADR-0007: Gate Evidence Archive and Approval Ordering

**Decision Number:** 0007

**Date:** 2026-06-22

**Status:** Accepted by Owner directive

## Problem Statement

An annotated tag identifies an exact commit, but a tag alone does not preserve the
assessments, verification results, configuration state, and approval evidence needed
to understand why a Gate was accepted.

## Context

Gate 0 established immutable Gate tags in ADR-0006. The Owner subsequently required a
complete evidence archive and explicit Owner review before tagging every Gate.

## Options Considered

1. Keep evidence only in conversations and terminal history.
2. Attach unstructured evidence outside the repository.
3. Version a standard evidence archive with each Gate commit before Owner approval and
   annotated tagging.

## Decision

Every Gate commit includes a structured evidence directory containing the Gate,
architecture, security, dependency, build, test, documentation, ADR, repository tree,
release, configuration, feature flag, and manifest records. Owner review follows the
verified commit and evidence review. The annotated tag is created only after approval.

## Reasoning

Repository evidence remains discoverable, reviewable, checksummed, and bound to exact
source history. Future contributors do not need access to private conversations to
understand Gate acceptance.

## Tradeoffs

Evidence adds documentation work and some duplication. Snapshots must exclude secrets
and personal data. Generated evidence should remain concise and reproducible.

## Future Impact

CI should generate or verify evidence, validate tag messages, and refuse Gate tags
without Owner approval status and a complete evidence index.

## Related Components

`docs/gates/`, Gate assessments, CI, release versioning, Git tags, ADR-0006.

## Superseded Decisions

ADR-0006 is extended by this decision; its immutable tag requirement remains active.
