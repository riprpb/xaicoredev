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
or removal, master shutdown, reboot, and successor grants require Owner authority or
an explicitly authorized successor where permitted.

Successor authority is explicit, cryptographically protected, revocable, versioned,
documented, and audited. It is never automatic.

Shutdown and reboot are separate permissions. Shutdown may be delegated according to
policy. Reboot is restricted to the Owner and explicitly designated successors. Every
lifecycle action records actor, authority, reason, affected components, timestamp,
correlation ID, and result.
