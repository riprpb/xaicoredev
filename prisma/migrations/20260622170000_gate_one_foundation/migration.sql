-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('RECOGNIZED', 'TRUSTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuthenticationAssurance" AS ENUM ('SINGLE_FACTOR', 'MULTI_FACTOR', 'PHISHING_RESISTANT');

-- CreateEnum
CREATE TYPE "ConstitutionalRole" AS ENUM ('OWNER', 'DESIGNATED_SUCCESSOR', 'OPERATIONAL_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "AuthorityStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SuccessorGrantStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('ALLOWED', 'DENIED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "status" "IdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "provider_id" VARCHAR(100) NOT NULL,
    "credential_type" VARCHAR(100) NOT NULL,
    "material_reference" VARCHAR(512) NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upgraded_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "assurance" "AuthenticationAssurance" NOT NULL,
    "provider_session_reference" VARCHAR(512),
    "authenticated_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revocation_reason" TEXT,
    "revocation_correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'RECOGNIZED',
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "provider_id" VARCHAR(100) NOT NULL,
    "factor_type" VARCHAR(100) NOT NULL,
    "material_reference" VARCHAR(512) NOT NULL,
    "status" "FactorStatus" NOT NULL DEFAULT 'PENDING',
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_methods" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "provider_id" VARCHAR(100) NOT NULL,
    "method_type" VARCHAR(100) NOT NULL,
    "material_reference" VARCHAR(512) NOT NULL,
    "status" "FactorStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "recovery_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constitutional_authority_assignments" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "role" "ConstitutionalRole" NOT NULL,
    "status" "AuthorityStatus" NOT NULL DEFAULT 'ACTIVE',
    "granted_by_authority_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "constitutional_authority_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_entitlements" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "product_id" VARCHAR(100) NOT NULL,
    "plan_id" VARCHAR(100) NOT NULL,
    "capabilities" TEXT[],
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "product_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "successor_trust_grants" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "granted_by_authority_id" UUID NOT NULL,
    "scopes" TEXT[],
    "activation_policy_id" VARCHAR(255) NOT NULL,
    "status" "SuccessorGrantStatus" NOT NULL DEFAULT 'PENDING',
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "integrity_proof_reference" VARCHAR(512) NOT NULL,

    CONSTRAINT "successor_trust_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_bootstrap_records" (
    "id" UUID NOT NULL,
    "singleton_key" INTEGER NOT NULL DEFAULT 1,
    "identity_id" UUID NOT NULL,
    "ceremony_id" UUID NOT NULL,
    "cryptographic_owner_identifier" VARCHAR(512) NOT NULL,
    "constitutional_document_id" VARCHAR(255) NOT NULL,
    "constitutional_version" VARCHAR(255) NOT NULL,
    "constitutional_digest" VARCHAR(128) NOT NULL,
    "constitutional_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "recovery_key_reference" VARCHAR(512) NOT NULL,
    "successor_trust_policy_reference" VARCHAR(512) NOT NULL,
    "ownership_integrity_reference" VARCHAR(512) NOT NULL,
    "established_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "owner_bootstrap_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_records" (
    "id" UUID NOT NULL,
    "type" VARCHAR(150) NOT NULL,
    "action" VARCHAR(150) NOT NULL,
    "target" VARCHAR(255) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" VARCHAR(255),
    "actor_kind" VARCHAR(50) NOT NULL,
    "constitutional_authority" TEXT[],
    "permission_decision_id" VARCHAR(255),
    "request_id" VARCHAR(255) NOT NULL,
    "correlation_id" VARCHAR(255) NOT NULL,
    "environment" VARCHAR(50) NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "previous_event_hash" CHAR(64) NOT NULL,
    "integrity_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(150) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "response_reference" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identities_status_deleted_at_idx" ON "identities"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "credentials_identity_id_status_idx" ON "credentials"("identity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_provider_id_material_reference_key" ON "credentials"("provider_id", "material_reference");

-- CreateIndex
CREATE INDEX "sessions_identity_id_status_expires_at_idx" ON "sessions"("identity_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_provider_session_reference_idx" ON "sessions"("provider_session_reference");

-- CreateIndex
CREATE INDEX "devices_identity_id_status_idx" ON "devices"("identity_id", "status");

-- CreateIndex
CREATE INDEX "mfa_factors_identity_id_status_idx" ON "mfa_factors"("identity_id", "status");

-- CreateIndex
CREATE INDEX "recovery_methods_identity_id_status_idx" ON "recovery_methods"("identity_id", "status");

-- CreateIndex
CREATE INDEX "constitutional_authority_assignments_role_status_expires_at_idx" ON "constitutional_authority_assignments"("role", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "constitutional_authority_assignments_identity_id_role_versi_key" ON "constitutional_authority_assignments"("identity_id", "role", "version");

-- CreateIndex
CREATE INDEX "product_entitlements_identity_id_status_expires_at_idx" ON "product_entitlements"("identity_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_entitlements_identity_id_product_id_plan_id_key" ON "product_entitlements"("identity_id", "product_id", "plan_id");

-- CreateIndex
CREATE INDEX "successor_trust_grants_status_expires_at_idx" ON "successor_trust_grants"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "successor_trust_grants_identity_id_version_key" ON "successor_trust_grants"("identity_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "owner_bootstrap_records_singleton_key_key" ON "owner_bootstrap_records"("singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "owner_bootstrap_records_identity_id_key" ON "owner_bootstrap_records"("identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "owner_bootstrap_records_ceremony_id_key" ON "owner_bootstrap_records"("ceremony_id");

-- CreateIndex
CREATE UNIQUE INDEX "owner_bootstrap_records_cryptographic_owner_identifier_key" ON "owner_bootstrap_records"("cryptographic_owner_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "audit_records_integrity_hash_key" ON "audit_records"("integrity_hash");

-- CreateIndex
CREATE INDEX "audit_records_correlation_id_occurred_at_idx" ON "audit_records"("correlation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_records_actor_id_occurred_at_idx" ON "audit_records"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_records_target_action_occurred_at_idx" ON "audit_records"("target", "action", "occurred_at");

-- CreateIndex
CREATE INDEX "idempotency_records_status_expires_at_idx" ON "idempotency_records"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_methods" ADD CONSTRAINT "recovery_methods_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constitutional_authority_assignments" ADD CONSTRAINT "constitutional_authority_assignments_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_entitlements" ADD CONSTRAINT "product_entitlements_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "successor_trust_grants" ADD CONSTRAINT "successor_trust_grants_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_bootstrap_records" ADD CONSTRAINT "owner_bootstrap_records_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foundation invariants not expressible in the Prisma schema.
ALTER TABLE "owner_bootstrap_records"
ADD CONSTRAINT "owner_bootstrap_singleton_check" CHECK ("singleton_key" = 1),
ADD CONSTRAINT "owner_bootstrap_version_check" CHECK ("version" = 1);

ALTER TABLE "constitutional_authority_assignments"
ADD CONSTRAINT "authority_assignment_version_check" CHECK ("version" > 0),
ADD CONSTRAINT "authority_assignment_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at");

ALTER TABLE "successor_trust_grants"
ADD CONSTRAINT "successor_grant_version_check" CHECK ("version" > 0),
ADD CONSTRAINT "successor_grant_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "issued_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "session_expiry_check" CHECK ("expires_at" > "authenticated_at");

ALTER TABLE "idempotency_records"
ADD CONSTRAINT "idempotency_expiry_check" CHECK ("expires_at" > "created_at");

ALTER TABLE "audit_records"
ADD CONSTRAINT "audit_previous_hash_check" CHECK ("previous_event_hash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "audit_integrity_hash_check" CHECK ("integrity_hash" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "one_active_owner_authority"
ON "constitutional_authority_assignments" ("role")
WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';

CREATE FUNCTION "reject_immutable_record_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable platform records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "owner_bootstrap_immutable"
BEFORE UPDATE OR DELETE ON "owner_bootstrap_records"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_record_mutation"();

CREATE TRIGGER "audit_records_append_only"
BEFORE UPDATE OR DELETE ON "audit_records"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_record_mutation"();
