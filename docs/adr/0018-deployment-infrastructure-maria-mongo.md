# ADR-0018: Deployment Infrastructure — MariaDB, MongoDB, Apache, NVIDIA

**Decision Number:** 0018  
**Date:** 2026-07-01  
**Status:** Owner-Approved for Implementation  
**Owner:** Ryan Patrick Burbage  
**Decision Authority:** Constitutional Owner

## Problem Statement

XAICore requires a production deployment infrastructure that:
- Avoids vendor lock-in (no AWS/GCP/Azure)
- Supports relational data (subscriptions, users, transactions)
- Supports document stores (AI brains, conversations, unstructured data)
- Provides fast inference and GPU acceleration (NVIDIA)
- Offers proven, lightweight web serving (Apache)
- Remains operationally lightweight and portable

## Context

Gate 0 stabilized the codebase. Gate 1 requires:
- Live database verification (workstreams 6–9)
- Production-ready staging environment
- Haley AI (owner-only), Scarlett X, Hope Security AI
- Tier-based subscriptions (Stripe)
- 12-brain orchestration with persistence
- Real-time trading system
- KYC/compliance audit trail

Current tech stack:
- **Frontend:** React + Vite + TypeScript
- **Backend:** tRPC + Node.js + Express
- **ORM:** Drizzle (relational) + Prisma (migrations)
- **Package Manager:** npm
- **CI/CD:** GitHub Actions + PostgreSQL test container

## Decision

### Infrastructure Stack

| Component | Choice | Version | Rationale |
| --- | --- | --- | --- |
| **Relational Database** | MariaDB | 10.11+ | Drop-in MySQL replacement, GPL/FOSS, proven, ACID transactions for subscriptions/audit |
| **Document Store** | MongoDB | 7.0+ | Flexible schema for AI brains, conversations, encrypted storage, TTL indexes for sessions |
| **Web Server** | Apache httpd | 2.4+ | Reverse proxy, SSL/TLS termination, load balancing, mature security hardening |
| **GPU Compute** | NVIDIA CUDA + cuDNN | 12.x | AI inference acceleration (Haley, Scarlett, Hope brains), NVIDIA Container Runtime for Docker |
| **Hosting Platform** | Self-Hosted VPS or On-Premises | N/A | Full control, no vendor lock-in, portable across providers (DigitalOcean, Linode, Vultr, private datacenter) |

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│ Browser (HTTP/HTTPS) → Apache Reverse Proxy (port 443)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    APACHE (httpd)                            │
│  ├─ SSL/TLS Termination (Let's Encrypt)                     │
│  ├─ Load Balancing (mod_proxy_http + mod_proxy_balancer)    │
│  ├─ Request Headers (authentication, CORS)                  │
│  ├─ Rate Limiting (mod_ratelimit)                           │
│  └─ Static Asset Caching                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│              NODE.JS BACKEND POOL (tRPC)                     │
│  ├─ Instance 1 (port 3001)                                  │
│  ├─ Instance 2 (port 3002)                                  │
│  └─ Instance N (port 300N)                                  │
│  └─ Health checks via /api/health endpoints                 │
└──────────────────────────────────────────────────────────────┘
            ↓                           ↓
┌──────────────────────┐      ┌────────────────────┐
│     MARIADB          │      │     MONGODB        │
│  Relational Data:    │      │  Document Data:    │
│  ├─ Users           │      │  ├─ Brains         │
│  ├─ Subscriptions   │      │  ├─ Conversations  │
│  ├─ Transactions    │      │  ├─ Sessions       │
│  ├─ Orders          │      │  ├─ Audit Logs     │
│  ├─ KYC Verif.      │      │  └─ Encrypted Data │
│  └─ Audit Trail     │      │                    │
│  Primary + Replica  │      │ Replica Set (3x)   │
└──────────────────────┘      └────────────────────┘
            ↓
┌────────────────────────────────────────────────┐
│        NVIDIA GPU COMPUTE LAYER                │
│ ├─ Haley AI Inference (owner-only)            │
│ ├─ Scarlett X Content Generation              │
│ ├─ Hope Security Threat Analysis              │
│ ├─ Trading ML Models                          │
│ └─ CUDA Runtime + cuDNN for TensorFlow/PyTorch│
└────────────────────────────────────────────────┘
```

### MariaDB Configuration

**Purpose:** ACID transactional data for financial integrity

**Setup:**
- Primary-Replica replication for high availability
- Backup replication stream to cold storage (daily)
- InnoDB storage engine with STRICT transaction isolation
- Encrypted replication channels
- Point-in-time recovery via binary logs (60-day retention)

**Key Tables:**
- `users` — authentication, roles, MFA seeds
- `subscriptions` — tier, status, renewal date, Stripe references
- `stripe_events` — webhook audit trail
- `transactions` — trading, wallet, payments (immutable after commit)
- `kyc_verification` — identity verification records
- `audit_log` — Owner operations, permission decisions
- `trading_orders` — order lifecycle, fills, cancellations
- `brain_registry` — 12-brain metadata, shutdown state, permissions

### MongoDB Configuration

**Purpose:** Flexible, schemaless storage for AI brains and unstructured data

**Setup:**
- 3-node Replica Set (primary + 2 secondaries) for high availability
- Encryption at rest (KMIP or self-hosted key server)
- TTL indexes for session auto-deletion
- Sharding ready (partition key: userId)
- Backup: continuous snapshots to cold storage

**Key Collections:**
- `haley_brain` — owner-only conversation history, tools logs
- `scarlett_personas` — content, moderation queue, encrypted storage
- `hope_security_incidents` — threat detection, responses
- `user_sessions` — active MFA sessions (TTL: 24h)
- `ai_conversations` — multi-user chat history (encrypted)
- `brain_memory` — persistent state for each of 12 brains

### Apache Configuration

**Purpose:** Reverse proxy, SSL/TLS, load balancing, DDoS protection

**Setup:**
- Listening on ports 80 (HTTP redirect) and 443 (HTTPS only)
- Self-signed or Let's Encrypt certificates (auto-renewal)
- Modules enabled:
  - `mod_proxy` + `mod_proxy_http` — backend routing
  - `mod_proxy_balancer` + `mod_lbmethod_byrequests` — round-robin
  - `mod_ratelimit` — DDoS throttling
  - `mod_headers` — security headers (CSP, X-Frame-Options, etc.)
  - `mod_ssl` — TLS 1.2+, strong cipher suites
  - `mod_log_config` — structured access/error logs
  - `mod_rewrite` — URL rewrites for SPA routing

**Configuration Example:**
```apache
<VirtualHost *:443>
  ServerName xaicore.platform
  SSLEngine on
  SSLProtocol TLSv1.2 TLSv1.3
  SSLCipherSuite HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4
  
  ProxyPreserveHost On
  ProxyPass /api http://localhost:3001/api connectiontimeout=5 timeout=300
  ProxyPassReverse /api http://localhost:3001/api
  
  <Proxy balancer://backend>
    BalancerMember http://localhost:3001
    BalancerMember http://localhost:3002
    BalancerMember http://localhost:3003
  </Proxy>
  
  ProxyPass /api balancer://backend/api
  ProxyPassReverse /api balancer://backend/api
  
  <Location /api>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
    SetOutputFilter rate-limit
    LimitRequestRate 1000 per 10 second
  </Location>
</VirtualHost>
```

### NVIDIA GPU Configuration

**Purpose:** AI inference acceleration for Haley, Scarlett X, Hope Security

**Setup:**
- NVIDIA CUDA 12.x runtime
- NVIDIA cuDNN for deep learning optimization
- NVIDIA Container Runtime (if Docker-based)
- TensorFlow/PyTorch pinned to CUDA 12.x compatible versions

**Resource Allocation:**
- Haley AI: 1 GPU (owner-only, highest priority)
- Scarlett X: 1 GPU (content generation, batched)
- Hope Security AI: 0.5 GPU (threat analysis, shared)
- Trading ML: 0.5 GPU (market predictions, shared)

**Monitoring:**
- `nvidia-smi` polling for memory/utilization
- Alerts if GPU memory exceeds 90%
- Auto-fallback to CPU if GPU unavailable

### Database Migration Strategy

**Current State (Prisma + PostgreSQL test container):**
- Gate 1 development uses PostgreSQL 16 in CI

**Migration Plan:**
1. **Export Prisma schema** from current codebase
2. **Create Drizzle schema equivalents** for MariaDB tables
3. **Drizzle migrations** for MariaDB (version-controlled in `prisma/migrations/`)
4. **Create Mongoose schemas** for MongoDB collections
5. **Live migration test:**
   - Dump PostgreSQL test data
   - Transform to MariaDB schema
   - Verify foreign keys + constraints
   - Load MongoDB documents
   - Run integration tests against both DBs
6. **Cutover:** Point Node.js to MariaDB + MongoDB connectors

### Backup and Disaster Recovery

| Asset | Backup Frequency | Retention | Recovery Time |
| --- | --- | --- | --- |
| MariaDB binary logs | Continuous stream | 60 days | Point-in-time (seconds) |
| MariaDB snapshots | Daily 02:00 UTC | 30 days | 1-2 hours |
| MongoDB snapshots | Daily 02:30 UTC | 30 days | 1-2 hours |
| Apache config + TLS certs | On every change | Permanent (Git) | Minutes (re-deploy) |
| Application secrets | Never (encrypted at rest) | N/A | Sealed envelope only |

**Recovery Procedures:**
1. **Database corruption:** Restore from last good snapshot + replay binary logs
2. **Data loss:** Restore from cold-storage backup
3. **Complete node failure:** Spin up new VM, restore from snapshots, rejoin replica set
4. **Apache SSL cert expiration:** Let's Encrypt auto-renewal (cron-driven)

### Secrets Management

**Implementation:**
- No secrets in Git (`.gitignore` covers `.env`, `keys/`, `certs/`)
- Development: `.env.local` file (not committed)
- Production: Environment variables only (injected at deploy time)
- Database passwords: Encrypted in HashiCorp Vault or similar (sealed envelope)
- MongoDB replication key: Stored separately from database
- Stripe API keys: Rotated quarterly, stored in sealed envelope

### Security Hardening

**Firewall:**
- Port 22 (SSH): Whitelist by Owner IP only
- Port 80 (HTTP): Accept, redirect to HTTPS
- Port 443 (HTTPS): Public access (with rate limits)
- Port 3306 (MariaDB): Internal only (no external access)
- Port 27017 (MongoDB): Internal only (no external access)
- Port 3001-3003 (Node.js): Internal only (Apache reverse proxy only)

**OS Hardening:**
- Disable root login (sudo only)
- Fail2ban for brute-force protection
- SELinux or AppArmor security contexts
- Automatic security updates (unattended-upgrades)
- Log centralization (syslog to cold storage)

### Compliance & Audit

**Data Residency:**
- All data stored on Owner-controlled infrastructure
- No cloud provider access
- Audit trail immutable (MariaDB append-only, binlog retention)

**Access Audit:**
- All database queries logged (MariaDB general_log, MongoDB oplog)
- All HTTP requests logged (Apache access_log)
- All Owner operations logged (audit_log table)
- Quarterly audit report generation

## Rationale

1. **Avoid Vendor Lock-in:** MariaDB/MongoDB/Apache are portable across any VPS provider
2. **Cost:** Self-hosted is significantly cheaper than AWS/GCP/Azure at scale
3. **Control:** Full access to infrastructure, databases, backups — no managed service restrictions
4. **Performance:** Direct NVIDIA GPU access for AI inference, no cloud GPU quota limits
5. **Security:** Owner-controlled, no third-party access, encryption keys locally managed
6. **Flexibility:** Can migrate to any provider or on-premises datacenter without refactoring

## Consequences

### Operational Responsibilities
- Database backups and point-in-time recovery
- OS patching and security updates
- SSL certificate renewal (automated)
- Monitoring and alerting (DIY or third-party APM)
- Scaling (vertical: more cores/RAM; or horizontal: load balancer + replicas)

### Cost Implications
- VPS cost: $50–500/month depending on compute/storage needs
- Bandwidth: Pay-as-you-go (typically $0.01–0.05 per GB egress)
- Backup storage: $10–50/month for 30-day retention
- No licensing costs (FOSS stack)

### Timeline
- **Week 1:** Provision VPS, install MariaDB + MongoDB + Apache + NVIDIA drivers
- **Week 2:** Migrate Prisma schema to Drizzle + MariaDB, create MongoDB collections
- **Week 3:** Integration testing (live database + application)
- **Week 4:** Production cutover + monitoring setup

## Exit Criteria for Go-Live

- [ ] MariaDB + MongoDB online and replicated
- [ ] Apache reverse proxy routing traffic to 3+ Node.js instances
- [ ] NVIDIA GPU available and tested with Haley AI inference
- [ ] All CI quality gates passing (with live MariaDB)
- [ ] KYC audit trail immutable and logged
- [ ] Subscription billing tested end-to-end (Stripe webhook → DB record)
- [ ] Backup and restore procedures tested and documented
- [ ] Owner authentication (Haley access control) verified
- [ ] 72-hour stability test (no errors, uptime > 99.9%)

## Related Decisions

- [ADR-0003: PostgreSQL and Prisma](0003-postgresql-prisma.md) — initial tech selection (now refined to MariaDB)
- [ADR-0013: Typed Runtime Configuration](0013-typed-runtime-configuration.md) — environment variables for DB credentials
- [Deployment Documentation](../deployment/README.md) — runbooks and procedures
- [Gate 1 Implementation Plan](../roadmap/gate-one-implementation-plan.md) — workstreams 6–9 unblocked

## Owner Approval

- **Approved by:** Ryan Patrick Burbage (Constitutional Owner)
- **Approval date:** 2026-07-01
- **Effective date:** 2026-07-01 (immediate implementation)
- **Go-live target:** 2026-07-08
- **Deployment lead:** [To be assigned]

---

**This ADR unblocks:**
- ✅ IaC and deployment automation
- ✅ Staging environment provisioning
- ✅ Gate 1 live database verification
- ✅ Production infrastructure readiness
- ✅ Backup and DR procedures
- ✅ Security hardening checklist
