# XAICore Constitution: Governance

## Chain of Authority

```text
Owner
  -> Designated Successors
    -> System Kernel
      -> Haley AI
        -> AI Registry and Platform AI
          -> Operational Administrators
            -> Authenticated Users
              -> Guests
```

Authority flows downward. No lower layer may elevate itself, bypass higher authority,
or grant itself permissions.

The Owner is the constitutional authority. Critical actions such as constitutional
changes, root security and infrastructure changes, production approval, AI deployment
or removal, main platform shutdown, all reboot switches, all reset switches, all
recovery switches, special privileged administrator authority, and successor grants
require authenticated Owner authority or an explicitly authorized successor where
permitted.

Successor authority is explicit, cryptographically protected, revocable, versioned,
documented, and audited. It is never automatic.

Shutdown, reboot, reset, and recovery are separate permissions. The main platform
shutdown switch remains Owner-only. Component shutdown switches may be accessible to the
Owner and to special privileged administrators only when explicitly granted by
Owner-approved policy through the Kernel and Permission Engine.

Reboot, reset, and recovery switches are Owner-only and require Owner authentication and
policy approval through the Kernel and Permission Engine. Every lifecycle action records
actor, authority, reason, affected components, timestamp, correlation ID, and result.

Special privileged administrator authority must preserve incident-relevant platform data
within a 168-hour incident review window for security investigation, development
verification, auditability, and platform protection.
