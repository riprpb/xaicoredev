export type AIProviderKind =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'local'
  | 'self-hosted'
  | 'future'

export interface AIProviderDescriptor {
  id: string
  kind: AIProviderKind
  displayName: string
  capabilities: readonly string[]
  configurationKeys: readonly string[]
}

export interface AIProviderRequest {
  requestId: string
  capability: string
  model?: string
  input: unknown
  metadata: Readonly<Record<string, string>>
  timeoutMs: number
}

export interface AIProviderResponse {
  requestId: string
  providerId: string
  model?: string
  output: unknown
  usage?: Readonly<Record<string, number>>
  completedAt: string
}

export interface AIProviderAdapter {
  descriptor: AIProviderDescriptor
  execute(request: AIProviderRequest): Promise<AIProviderResponse>
  isAvailable(): Promise<boolean>
}

export interface AIProviderRoutingPolicy {
  selectProvider(
    request: AIProviderRequest,
    providers: readonly AIProviderDescriptor[],
  ): Promise<string>
}

export interface AIProviderGateway {
  register(adapter: AIProviderAdapter): void
  listProviders(): readonly AIProviderDescriptor[]
  execute(request: AIProviderRequest): Promise<AIProviderResponse>
}

export class ProviderGateway implements AIProviderGateway {
  private readonly adapters = new Map<string, AIProviderAdapter>()

  constructor(private readonly routingPolicy: AIProviderRoutingPolicy) {}

  register(adapter: AIProviderAdapter): void {
    if (this.adapters.has(adapter.descriptor.id)) {
      throw new Error(`Provider ${adapter.descriptor.id} is already registered`)
    }
    this.adapters.set(adapter.descriptor.id, adapter)
  }

  listProviders(): readonly AIProviderDescriptor[] {
    return [...this.adapters.values()].map((adapter) => adapter.descriptor)
  }

  async execute(request: AIProviderRequest): Promise<AIProviderResponse> {
    const providerId = await this.routingPolicy.selectProvider(
      request,
      this.listProviders(),
    )
    const adapter = this.adapters.get(providerId)
    if (!adapter) throw new Error(`Provider ${providerId} is not registered`)
    if (!adapter.descriptor.capabilities.includes(request.capability)) {
      throw new Error(`Provider ${providerId} does not support ${request.capability}`)
    }
    if (!(await adapter.isAvailable())) {
      throw new Error(`Provider ${providerId} is unavailable`)
    }
    return adapter.execute(request)
  }
}
