# Permission Engine

## Boundary

The Kernel Permission Engine is deny-by-default. It evaluates authenticated Kernel
context against an explicit versioned policy matrix. It never derives constitutional
authority from an email address, username, product entitlement, client-supplied role,
or user-interface state.

Authorization subjects are supplied through a provider-neutral resolver. Subject IDs,
active constitutional roles, explicit service capabilities, authentication assurance,
and reauthentication time are evaluated independently from request payloads.

## Required Controls

- Authentication completes before permission evaluation.
- Unknown resources, actions, capabilities, subjects, and policy combinations deny.
- Read and mutation capabilities are separate.
- AI actors cannot mutate Registry or Feature Flag state.
- Services require explicit named capabilities and receive no constitutional role.
- Owner-reserved lifecycle, recovery, deployment, and policy operations require active
  Owner authority, multi-factor assurance, recent reauthentication, and a reason.
- Operational administrators cannot perform Owner-reserved operations.
- Internal evaluation failures return generic denials and do not disclose policy data.

Permission decisions include a unique decision ID, effect, stable policy version,
reason, and timestamp so the Kernel Audit service can correlate both allow and denial
outcomes in Workstream 5.
