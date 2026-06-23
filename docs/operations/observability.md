# Observability

## Runtime Evidence

The active API provides aggregate health, readiness, liveness, version, dependency,
and metrics evidence. Required dependency failure makes readiness unhealthy and returns
HTTP 503. Optional dependency failure degrades aggregate health without exposing raw
adapter errors.

Structured logs use stable event names, timestamps, and correlation metadata. Shared
redaction removes credentials, secrets, tokens, authorization values, cookies,
recovery material, private keys, email addresses, display names, binary data, and
circular references before a sink receives a record.

Metrics contain numerical operational state only. Labels and values must not contain
personal information, secrets, request bodies, credentials, or Root Authority data.

## Required Alerts

Production alert routing must cover:

- Required dependency readiness failure.
- Audit integrity verification failure or audit-write failure.
- Repeated Owner-reserved permission denials.
- Unexpected lifecycle or recovery operation attempts.
- Sustained API error-rate or rate-limit increases.
- Log or metrics sink failure.

No alert provider is selected until the deployment target is approved. Alert content
must use correlation IDs and stable event metadata rather than personal information or
sensitive payloads.

## Retention

Gate 1 performs no automatic audit deletion. Audit, constitutional authority,
permission, recovery, and privileged-operation records remain retained until an
Owner-approved production retention and legal-hold schedule exists. Operational logs
and metrics must use the minimum retention necessary for reliability and security, with
provider-specific periods decided alongside hosting and applicable legal requirements.

Retention jobs may not weaken the append-only audit chain or delete an immutable Owner
record. Any future pruning or archival design requires an ADR, Owner approval, and
verifiable integrity continuity.
