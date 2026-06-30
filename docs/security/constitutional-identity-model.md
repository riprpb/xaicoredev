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

Owner recovery is split into two separate paths. Path 1 is Owner MFA recovery codes:
ten cryptographically secure one-time codes are displayed exactly once, persisted only
as salted hashes, audited on generation, regeneration, and use, and allowed to restore
Owner access without changing constitutional authority. Regeneration requires
successful Owner authentication and MFA verification.

Path 2 is the successor recovery framework: it stores only an opaque protected
reference bound to an active approved successor policy, requires a reason, timestamp,
policy validation, and audit record, does not activate automatically, does not expose
Root Authority or emergency-control internals, and does not generate real successor
credentials unless explicitly approved by Owner.

For the local development Owner, generate or rotate MFA recovery codes with:

```powershell
npm run owner:recovery -- generate --credential '.xaicore-private\owner\credentials\owner-local-credential.json' --factor '.xaicore-private\owner\credentials\owner-local-totp.json' --private-dir '.xaicore-private\owner'
```

The command authenticates the existing Owner password, verifies a current TOTP code,
persists only salted hashes, appends a chained audit event, and displays the ten
plaintext codes once. Plaintext codes must be moved directly into Owner-controlled
custody and must never be pasted into chat, logs, or repository files.

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
