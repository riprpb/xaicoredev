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

## Definition of Done

A feature is complete only when working behavior, authorization, error handling,
structured logging, audit requirements, configuration, automated tests, documentation,
health and metrics, security review, performance consideration, deployment validation,
and architecture review are satisfied. Contracts and prototypes must be labeled and
never represented as production features.

Database changes are migration-driven. Secrets never enter source. APIs are versioned,
authenticated, authorized, rate-limited, observable, and tested.
