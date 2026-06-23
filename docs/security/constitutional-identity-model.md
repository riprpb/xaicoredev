# Constitutional Identity Model

## Gate 1 Scope

Constitutional authority assignments and product entitlements are independent domain
records. A subscription, plan, product capability, billing state, or entitlement can
never create Owner, successor, or operational-administrator authority.

Authority assignments are explicit, versioned, status-controlled, attributable to a
granting authority, and optionally time-bound. Permission enforcement remains the
responsibility of the future Kernel Permission Engine workstream.

Successor trust grants model scope, status, activation policy, expiry, revocation,
version, and an opaque integrity-proof reference. They do not expose Root Authority,
recovery, cryptographic, or activation implementation details.

The authentication metadata model is identity-provider neutral. It defines users,
credential references, provider links, devices, MFA factor references, recovery-method
references, sessions, and immutable session revocation results without storing
passwords, tokens, factor secrets, recovery codes, or provider credential material.

Local credentials are approved for the initial development strategy. Passwords use a
versioned scrypt policy with unique salts, constant-time comparison, upgrade detection,
and bounded brute-force state. Password composition rules are not imposed. Hashing
requires a configured compromised-password checker; the initial adapter consumes only
local SHA-256 fingerprints and stores no plaintext denylist entries.

Constitutional and privileged requests require at least multi-factor assurance. Account
recovery requires an active subject-matched recovery reference, reason, timestamp, and
correlation ID, and can never modify constitutional authority. MFA factor execution,
recovery material handling, persistence, and Owner account creation remain required
before authentication is integrated.
