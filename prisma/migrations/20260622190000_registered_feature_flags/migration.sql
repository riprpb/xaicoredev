-- CreateEnum
CREATE TYPE "FeatureFlagStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'RETIRED');

-- CreateTable
CREATE TABLE "feature_flag_definitions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "registry_record_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeatureFlagStatus" NOT NULL DEFAULT 'AVAILABLE',
    "secure_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flag_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flag_secure_default_check" CHECK ("secure_default" = false)
);

-- CreateTable
CREATE TABLE "feature_flag_values" (
    "id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "environment" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feature_flag_values_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flag_value_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_definitions_name_key" ON "feature_flag_definitions"("name");
CREATE INDEX "feature_flag_definitions_registry_record_id_status_idx" ON "feature_flag_definitions"("registry_record_id", "status");
CREATE INDEX "feature_flag_values_environment_enabled_idx" ON "feature_flag_values"("environment", "enabled");
CREATE UNIQUE INDEX "feature_flag_values_definition_id_environment_key" ON "feature_flag_values"("definition_id", "environment");

-- AddForeignKey
ALTER TABLE "feature_flag_definitions" ADD CONSTRAINT "feature_flag_definitions_registry_record_id_fkey"
FOREIGN KEY ("registry_record_id") REFERENCES "platform_registry"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "feature_flag_values" ADD CONSTRAINT "feature_flag_values_definition_id_fkey"
FOREIGN KEY ("definition_id") REFERENCES "feature_flag_definitions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
