# Security Documentation

Security documentation will include threat models, authority boundaries, secret and
key management, identity controls, Trust Gateway policies, vulnerability management,
incident response, privacy, KYC data handling, and release security evidence.

- [Root Authority information boundary](root-authority-boundary.md) records the
  internal security directive without disclosing restricted control mechanisms.
- [Owner information](owner-information.md) records the Owner-declared platform,
  entity, ownership, and Owner-reserved control baseline.
- [Constitutional identity model](constitutional-identity-model.md) separates authority
  assignments, successor trust metadata, and product entitlements.
- [Owner Bootstrap review](owner-bootstrap-review.md) records high-level guarantees and
  execution prerequisites without exposing private security mechanisms.
- [Permission Engine](permission-engine.md) records the deny-by-default authorization
  boundary and Owner-reserved operation requirements.
- [Audit integrity](audit-integrity.md) records append-only storage, redaction, and
  fail-closed permission-audit behavior.
- [Owner session authentication](owner-session-authentication.md) records the opaque
  token, MFA, session, and route-activation boundary.
- [Gate 1 security validation](gate-one-security-validation.md) records tested abuse
  cases, verified controls, and remaining live validation without exposing restricted
  Root Authority mechanisms.
- [KeePassXC vault initialization](keepassxc-vault-initialization.md) records the local
  empty-vault import utility and Owner secret-handling boundary.
