import { createHash } from 'node:crypto';
import {
  type ComponentKind as PrismaComponentKind,
  type ManifestStatus as PrismaManifestStatus,
  type PlatformRegistryRecord as PrismaRegistryRecord,
  Prisma,
  type PrismaClient,
  type RegistryLifecycleState,
  type RegistryStatus,
} from '@prisma/client';
import type { PlatformLifecycleState } from '@/platform/lifecycle/contracts';
import type { ComponentKind, ComponentManifest } from '@/platform/manifests/contracts';
import type {
  PlatformRegistrationRecord,
  PlatformRegistrationStatus,
  PlatformRegistryRepository,
} from '@/platform/registry/platform-registry';

type RegistryWithManifest = PrismaRegistryRecord & {
  activeManifest: { manifest: Prisma.JsonValue };
};

export class PrismaPlatformRegistryRepository implements PlatformRegistryRepository {
  constructor(private readonly database: PrismaClient) {}

  async register(
    manifest: ComponentManifest,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<PlatformRegistrationRecord> {
    const manifestJson = toJson(manifest);
    const storedManifest = await transaction.platformManifestRecord.create({
      data: {
        componentId: manifest.id,
        componentKind: toPrismaKind(manifest.kind),
        version: manifest.version,
        status: manifest.status.toUpperCase() as PrismaManifestStatus,
        manifest: manifestJson,
        manifestDigest: digest(manifestJson),
      },
    });
    const registration = await transaction.platformRegistryRecord.create({
      data: {
        componentId: manifest.id,
        componentKind: toPrismaKind(manifest.kind),
        activeManifestId: storedManifest.id,
        status: 'REGISTERED',
        lifecycleState: 'OFFLINE',
        executionEnabled: false,
        reason,
      },
      include: { activeManifest: { select: { manifest: true } } },
    });
    return mapRegistration(registration);
  }

  async get(componentId: string): Promise<PlatformRegistrationRecord | undefined> {
    const record = await this.database.platformRegistryRecord.findUnique({
      where: { componentId },
      include: { activeManifest: { select: { manifest: true } } },
    });
    return record ? mapRegistration(record) : undefined;
  }

  async list(): Promise<readonly PlatformRegistrationRecord[]> {
    const records = await this.database.platformRegistryRecord.findMany({
      include: { activeManifest: { select: { manifest: true } } },
      orderBy: { componentId: 'asc' },
    });
    return records.map(mapRegistration);
  }

  async updateState(
    componentId: string,
    status: PlatformRegistrationStatus,
    lifecycleState: PlatformLifecycleState,
    executionEnabled: boolean,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<PlatformRegistrationRecord> {
    const current = await transaction.platformRegistryRecord.findUniqueOrThrow({
      where: { componentId },
    });
    if (
      current.componentKind === 'AI' &&
      (executionEnabled || !['offline', 'shutdown', 'removed'].includes(lifecycleState))
    ) {
      throw new Error('AI registrations must remain disabled and offline during Gate 1');
    }
    const registration = await transaction.platformRegistryRecord.update({
      where: { componentId },
      data: {
        status: status.toUpperCase() as RegistryStatus,
        lifecycleState: lifecycleState.toUpperCase() as RegistryLifecycleState,
        executionEnabled,
        reason,
        removedAt: status === 'removed' ? new Date() : null,
      },
      include: { activeManifest: { select: { manifest: true } } },
    });
    return mapRegistration(registration);
  }
}

function mapRegistration(record: RegistryWithManifest): PlatformRegistrationRecord {
  return {
    id: record.id,
    componentId: record.componentId,
    manifest: record.activeManifest.manifest as unknown as ComponentManifest,
    status: record.status.toLowerCase() as PlatformRegistrationStatus,
    lifecycleState: record.lifecycleState.toLowerCase() as PlatformLifecycleState,
    executionEnabled: record.executionEnabled,
    reason: record.reason,
    registeredAt: record.registeredAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    removedAt: record.removedAt?.toISOString(),
  };
}

function toPrismaKind(kind: ComponentKind): PrismaComponentKind {
  return kind.toUpperCase() as PrismaComponentKind;
}

function toJson(manifest: ComponentManifest): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(manifest)) as Prisma.InputJsonValue;
}

function digest(value: Prisma.InputJsonValue): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
