# Root Authority Information Boundary

**Classification:** Internal security policy boundary  
**Status:** Accepted by Owner directive on 2026-06-22

The Kernel and Permission Engine preserve permanent Owner Authority. AI,
administrators, service accounts, automation, workflows, plugins, modules, and other
subsystems cannot independently perform constitutional or platform-critical actions.
They may detect, monitor, analyze, recommend, prepare, and request Owner approval.

AI-facing contracts may state only that constitutional authority exists and
authenticated Owner approval is required. They must not describe or receive private
Root Authority validation, emergency control, recovery, maintenance, shutdown, reboot,
transfer, cryptographic, or security-ceremony mechanisms.

Detailed implementations, operational procedures, key material, identifiers, and
control paths belong in restricted Owner-controlled security records outside AI
prompts, manifests, APIs, source comments, general documentation, logs, and user-facing
interfaces. Security telemetry must use sanitized control outcomes rather than expose
mechanism details.

This boundary supersedes designs that disclose private Root Authority mechanisms to AI
agents or non-Owner users. Public constitutional language continues to define authority
and required approval without revealing the underlying controls.
