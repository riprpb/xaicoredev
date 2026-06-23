# ADR-0014: Primary Repository Identity

**Decision Number:** 0014  
**Date:** 2026-06-22  
**Status:** Accepted by Owner directive

## Problem Statement

The active XAICore source requires one unambiguous repository name and Git root.

## Context

The `xaicoredev/` directory already contains the independent Git metadata, active
source, documentation, configuration, and Gate history. The Gate 1 plan retained final
Owner confirmation as an outstanding decision.

## Options Considered

1. Use the parent workspace as the primary repository.
2. Rename or relocate the active repository.
3. Confirm `xaicoredev/` as the primary repository name and independent Git root.

## Decision

Use `xaicoredev` as the primary repository name. The `xaicoredev/` directory is the
independent Git root and governance boundary for the XAICore Platform.

## Reasoning

This matches the existing source-control boundary, Gate tags, active tooling, and
documented repository layout without introducing relocation risk.

## Tradeoffs

Parent workspace material and neighboring directories remain outside repository
history and require their own retention decisions.

## Future Impact

Automation, remote hosting, CI, release evidence, and contributor documentation use
`xaicoredev` as the repository identity. The npm package and product display name remain
separate concerns and are not renamed by this decision.

## Related Components

Repository root, `README.md`, repository structure documentation, and Gate 1 roadmap.

## Superseded Decisions

None.
