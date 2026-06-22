export const CORE_FEATURE_FLAGS = [
  'kernel',
  'haley',
  'scarlett',
  'production',
  'hope-shield',
  'hope-s',
  'hope-tech',
  'wallet',
  'trading',
  'marketplace',
  'billing',
  'avatar-studio',
  'experimental',
] as const

export type CoreFeatureFlag = (typeof CORE_FEATURE_FLAGS)[number]
export type FeatureFlagName = string

export interface FeatureFlagContext {
  userId?: string
  organizationId?: string
  environment: string
  attributes?: Readonly<Record<string, string | number | boolean>>
}

export interface FeatureFlagDecision {
  name: FeatureFlagName
  enabled: boolean
  source: string
  reason: string
}

export interface FeatureFlagProvider {
  evaluate(
    name: FeatureFlagName,
    context: FeatureFlagContext,
  ): Promise<FeatureFlagDecision>
  list(context: FeatureFlagContext): Promise<readonly FeatureFlagDecision[]>
}

export class ConfigurationFeatureFlagProvider implements FeatureFlagProvider {
  constructor(
    private readonly values: Readonly<Record<string, boolean>>,
    private readonly source = 'configuration',
  ) {}

  async evaluate(
    name: FeatureFlagName,
    context: FeatureFlagContext,
  ): Promise<FeatureFlagDecision> {
    void context
    const configured = Object.prototype.hasOwnProperty.call(this.values, name)
    return {
      name,
      enabled: configured ? this.values[name] : false,
      source: this.source,
      reason: configured ? 'configured value' : 'secure default',
    }
  }

  async list(context: FeatureFlagContext): Promise<readonly FeatureFlagDecision[]> {
    return Promise.all(
      Object.keys(this.values).map((name) => this.evaluate(name, context)),
    )
  }
}
