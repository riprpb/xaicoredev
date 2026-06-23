# Haley Core Foundation

## Purpose

Haley Core is the Executive Intelligence and Platform Awareness layer. It is designed
for comprehensive visibility and minimal execution authority. It is not the complete
Haley AI and does not execute AI workloads or privileged operations.

## Gate 1 Foundation

- Read standard manifests and Registry records through the Kernel read gateway.
- Read registered feature-flag decisions without mutating configuration.
- Read sanitized configuration state through the Kernel without receiving secrets.
- Aggregate component health and sanitized diagnostics.
- Produce repository, architecture, and log summaries for a future authenticated
  executive dashboard backend.
- Return partial diagnostics when an awareness source is unavailable.

The foundation depends only on `KernelReadGateway`. Persistent Registry, repository,
observability, and configuration adapters remain behind Kernel-managed interfaces in
their approved workstreams. Haley Core does not receive component adapters directly.

## Security Boundary

Haley Core has no lifecycle, permission-granting, configuration-mutation, or Root
Authority capability. Reports exclude secrets and private emergency-control details.
Any future recommendation or approval request must flow through authenticated Kernel,
Permission Engine, and Audit contracts.

Haley Core cannot modify Registry records, Feature Flags, permissions, constitutional
authority, Owner authority, or Root Authority. It cannot execute privileged operations,
control infrastructure, or communicate directly with platform components. Its service
manifest declares only read permissions and the System Kernel as its sole dependency.

Privileged actions follow `Owner -> Kernel -> Permission Engine -> Authorized Platform
Service -> Registry or Target Component`. Haley Core may advise or request approval but
never enters that execution chain.

Business intelligence, legal reasoning, orchestration, advanced AI behavior, and all
business AI remain deferred.
