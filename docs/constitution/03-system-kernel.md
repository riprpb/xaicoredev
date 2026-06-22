# XAICore Constitution: System Kernel

The System Kernel is trusted infrastructure, not an AI. It enforces constitutional
authority and owns platform infrastructure. Business logic does not belong in the
Kernel.

Kernel responsibilities include authentication, authorization, identity, sessions,
Owner authority, registries, service discovery, event routing, configuration, feature
flags, encryption and secret references, audit logging, health, metrics, dependency
and lifecycle management, shutdown, recovery, and disaster-recovery support.

The Kernel remains lightweight, independently testable, observable, secure,
fault-tolerant, and stateless where practical. It depends only on underlying
infrastructure. No AI may initialize before required Kernel services are healthy.
