# Owner Session Authentication

Owner Operations accept only an active, unexpired session carrying multi-factor or
stronger assurance and an active constitutional Owner assignment. Raw session tokens
are SHA-256 hashed before verification and are never logged, persisted in audit, or
placed in Kernel context. Kernel context contains only opaque subject and session IDs.

Owner-reserved mutations additionally require recent reauthentication, CSRF
verification, an explicit reason, Permission Engine approval, and durable audit. A
username, email address, product entitlement, client-supplied role, or possession of a
session token alone cannot establish Owner authority.

The route adapter is optional and remains unmounted when no approved authenticator is
configured. Live activation requires direct Owner password setup and MFA enrollment;
credentials and factor secrets must be entered locally and must not be sent through AI
prompts, source control, logs, manifests, or chat.

The local password ceremony writes one create-once private credential bound to the
immutable Owner subject. It stores only a normalized login-identifier hash and an
approved scrypt password hash after compromised-password screening. The separate local
TOTP ceremony verifies the Owner password and an authenticator code before storing the
factor secret encrypted with password-derived scrypt and AES-256-GCM keys. Enrollment
material is displayed only in the interactive terminal and must be treated as sensitive.
Neither ceremony activates Owner routes by itself.
