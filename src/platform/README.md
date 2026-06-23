# Platform Foundations

**Control status:** Approved baseline; changes require an ADR and Owner approval when
they expand platform responsibilities. See ADR-0011.

This directory contains the Gate 0 platform contracts and the approved Gate 1 Haley
Core foundation.

It intentionally contains **no business AI behavior, autonomous decision-making,
business memory, provider credentials, malware scanning, payment processing, trading
logic, blockchain logic, wallet operations, or user-facing business features.**

These foundations establish stable architectural boundaries for:

- Standard component manifests and dependency declarations.
- Platform lifecycle and health reporting.
- AI registration and manifest validation.
- Memory Registry, Brain, permission, encryption, versioning, and routing contracts.
- External AI Provider Gateway interfaces and configuration-based routing.
- Configuration-driven Feature Flag architecture with secure defaults.
- Trust Gateway ingress, scanning interfaces, risk scoring, quarantine, and audit
  contracts.
- Haley Core platform awareness, diagnostics, observability, Registry awareness, and
  executive monitoring.

Haley Core is **platform awareness only**.

Haley Core provides:

- Platform diagnostics.
- Health aggregation.
- Registry awareness.
- Feature Flag awareness.
- Architecture awareness.
- Configuration awareness.
- Log aggregation.
- Executive dashboard support.

Haley Core does **not** possess constitutional authority.

Haley Core does **not** control privileged platform operations.

Haley Core may observe, analyze, report, recommend, and request Owner approval, but it
shall never independently execute constitutional or Owner-reserved actions.

The Kernel is the single architectural center. Every service, Registry, AI, provider,
memory operation, permission evaluation, audit record, and lifecycle event integrates
through Kernel contracts. Runtime peer-to-peer platform integrations are prohibited.
An exception requires explicit authorization in an accepted Kernel architecture ADR
and must still use a Kernel-managed interface.

All future implementations shall depend upon these contracts rather than communicating
directly with infrastructure, providers, databases, or external services.

These contracts form the permanent engineering foundation of the XAICore platform and
shall remain stable, well-documented, versioned, and protected throughout the lifetime
of the platform.
