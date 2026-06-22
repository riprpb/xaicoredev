# Platform Foundations

This directory contains Gate 0 infrastructure contracts. It intentionally contains
no AI behavior, business memory, provider credentials, malware scanner, payment
logic, or user-facing business feature.

The contracts establish stable boundaries for:

- Standard component manifests and dependency declarations.
- Platform lifecycle and health reporting.
- AI registration and manifest validation.
- Memory Registry, Brain, permission, encryption, version, and routing contracts.
- External AI provider adapters and configuration-based routing.
- Configuration-driven feature flags with secure defaults.
- Trust ingress, scanning, risk scoring, quarantine, and audit contracts.

All future implementations must depend on these contracts rather than calling
providers or infrastructure directly.
