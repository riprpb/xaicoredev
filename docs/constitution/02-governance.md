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
or removal, master shutdown, component shutdown, reboot, special administrator
privileges, and successor grants require authenticated Owner authority or an explicitly
authorized successor where permitted.

Successor authority is explicit, cryptographically protected, revocable, versioned,
documented, and audited. It is never automatic.

Shutdown and reboot are separate permissions. Shutdown requires Owner authentication
and policy approval through the Kernel and Permission Engine. Reboot switches are
Owner-only unless an Owner-approved successor policy explicitly authorizes otherwise.
Every lifecycle action records actor, authority, reason, affected components,
timestamp, correlation ID, and result.
