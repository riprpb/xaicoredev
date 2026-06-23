import type { PrismaClient, Prisma } from '@prisma/client';
import type { FeatureFlagDecision } from '@/platform/feature-flags/contracts';
import type {
  FeatureFlagPersistence,
  RegisteredFeatureFlag,
} from '@/platform/feature-flags/persistent-feature-flags';

export class PrismaFeatureFlagPersistence implements FeatureFlagPersistence {
  constructor(private readonly database: PrismaClient) {}

  async register(
    name: string,
    ownerComponentId: string,
    description: string,
    transaction: Prisma.TransactionClient
  ): Promise<RegisteredFeatureFlag> {
    const owner = await transaction.platformRegistryRecord.findUnique({
      where: { componentId: ownerComponentId },
    });
    if (!owner || owner.status !== 'REGISTERED') {
      throw new Error('Feature Flag owner must be an active Registry record');
    }
    const definition = await transaction.featureFlagDefinition.create({
      data: {
        name,
        registryRecordId: owner.id,
        description,
        status: 'AVAILABLE',
        secureDefault: false,
      },
    });
    return {
      id: definition.id,
      name: definition.name,
      ownerComponentId,
      description: definition.description,
      status: 'available',
      secureDefault: false,
    };
  }

  async setValue(
    name: string,
    environment: string,
    enabled: boolean,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<FeatureFlagDecision> {
    const definition = await transaction.featureFlagDefinition.findUnique({
      where: { name },
    });
    if (!definition) throw new Error('Feature Flag is not registered');
    if (definition.status !== 'AVAILABLE') throw new Error('Feature Flag is unavailable');
    const value = await transaction.featureFlagValue.upsert({
      where: { definitionId_environment: { definitionId: definition.id, environment } },
      create: { definitionId: definition.id, environment, enabled, reason, version: 1 },
      update: { enabled, reason, version: { increment: 1 } },
    });
    return {
      name,
      enabled: value.enabled,
      source: 'persistent-registry',
      reason: value.reason,
    };
  }

  async evaluate(name: string, environment: string): Promise<FeatureFlagDecision> {
    const definition = await this.database.featureFlagDefinition.findUnique({
      where: { name },
      include: { values: { where: { environment }, take: 1 } },
    });
    if (!definition) return secureDecision(name, 'unregistered Feature Flag');
    if (definition.status !== 'AVAILABLE') return secureDecision(name, 'unavailable Feature Flag');
    const value = definition.values[0];
    if (!value) return secureDecision(name, 'secure default');
    return {
      name,
      enabled: value.enabled,
      source: 'persistent-registry',
      reason: value.reason,
    };
  }

  async list(environment: string): Promise<readonly FeatureFlagDecision[]> {
    const definitions = await this.database.featureFlagDefinition.findMany({
      orderBy: { name: 'asc' },
      include: { values: { where: { environment }, take: 1 } },
    });
    return definitions.map((definition) => {
      if (definition.status !== 'AVAILABLE') {
        return secureDecision(definition.name, 'unavailable Feature Flag');
      }
      const value = definition.values[0];
      return value
        ? {
            name: definition.name,
            enabled: value.enabled,
            source: 'persistent-registry',
            reason: value.reason,
          }
        : secureDecision(definition.name, 'secure default');
    });
  }
}

function secureDecision(name: string, reason: string): FeatureFlagDecision {
  return { name, enabled: false, source: 'persistent-registry', reason };
}
