-- CreateEnum
CREATE TYPE "ComponentKind" AS ENUM ('AI', 'SERVICE', 'MODULE', 'PLUGIN', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('EXPERIMENTAL', 'ACTIVE', 'DEPRECATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "RegistryStatus" AS ENUM ('REGISTERED', 'DISABLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "RegistryLifecycleState" AS ENUM ('PROVISIONING', 'INITIALIZING', 'RUNNING', 'BUSY', 'IDLE', 'SLEEPING', 'MAINTENANCE', 'UPDATING', 'RESTARTING', 'RECOVERY', 'SHUTDOWN', 'OFFLINE', 'DEPRECATED', 'REMOVED');

-- CreateTable
CREATE TABLE "platform_manifests" (
    "id" UUID NOT NULL,
    "component_id" VARCHAR(150) NOT NULL,
    "component_kind" "ComponentKind" NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "status" "ManifestStatus" NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifest_digest" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_manifests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_manifest_digest_check" CHECK ("manifest_digest" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "platform_registry" (
    "id" UUID NOT NULL,
    "component_id" VARCHAR(150) NOT NULL,
    "component_kind" "ComponentKind" NOT NULL,
    "active_manifest_id" UUID NOT NULL,
    "status" "RegistryStatus" NOT NULL DEFAULT 'REGISTERED',
    "lifecycle_state" "RegistryLifecycleState" NOT NULL DEFAULT 'OFFLINE',
    "execution_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "removed_at" TIMESTAMPTZ(3),

    CONSTRAINT "platform_registry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_registry_ai_execution_check"
      CHECK ("component_kind" <> 'AI' OR "execution_enabled" = false),
    CONSTRAINT "platform_registry_ai_lifecycle_check"
      CHECK ("component_kind" <> 'AI' OR "lifecycle_state" IN ('OFFLINE', 'SHUTDOWN', 'REMOVED')),
    CONSTRAINT "platform_registry_removed_state_check"
      CHECK (("status" = 'REMOVED') = ("removed_at" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_manifests_component_id_version_key" ON "platform_manifests"("component_id", "version");
CREATE UNIQUE INDEX "platform_manifests_component_id_manifest_digest_key" ON "platform_manifests"("component_id", "manifest_digest");
CREATE UNIQUE INDEX "platform_manifests_identity_key" ON "platform_manifests"("id", "component_id", "component_kind");
CREATE INDEX "platform_manifests_component_kind_status_idx" ON "platform_manifests"("component_kind", "status");
CREATE UNIQUE INDEX "platform_registry_component_id_key" ON "platform_registry"("component_id");
CREATE INDEX "platform_registry_component_kind_status_idx" ON "platform_registry"("component_kind", "status");
CREATE INDEX "platform_registry_lifecycle_state_execution_enabled_idx" ON "platform_registry"("lifecycle_state", "execution_enabled");

-- AddForeignKey
ALTER TABLE "platform_registry" ADD CONSTRAINT "platform_registry_active_manifest_fkey"
FOREIGN KEY ("active_manifest_id", "component_id", "component_kind")
REFERENCES "platform_manifests"("id", "component_id", "component_kind")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutable manifest versions are superseded by insertion, never mutation.
CREATE TRIGGER "platform_manifests_immutable"
BEFORE UPDATE OR DELETE ON "platform_manifests"
FOR EACH ROW EXECUTE FUNCTION "reject_immutable_record_mutation"();
