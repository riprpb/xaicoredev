import type { KernelRequestContext } from '@/platform/kernel/context';

export type ConfigurationVisibility = 'public' | 'sensitive-reference' | 'secret';

export interface ConfigurationDescriptor {
  key: string;
  visibility: ConfigurationVisibility;
  required: boolean;
  environments: readonly string[];
  description: string;
}

export interface PublicConfigurationValue<T = unknown> {
  descriptor: ConfigurationDescriptor & { visibility: 'public' };
  value: T;
  source: string;
}

export interface ReferencedConfigurationValue {
  descriptor: ConfigurationDescriptor & {
    visibility: 'sensitive-reference' | 'secret';
  };
  secretReference: string;
  source: string;
}

export type ConfigurationValue<T = unknown> =
  | PublicConfigurationValue<T>
  | ReferencedConfigurationValue;

export interface KernelConfigurationReader {
  get<T>(key: string, context: KernelRequestContext): Promise<ConfigurationValue<T>>;
  listDescriptors(): Promise<readonly ConfigurationDescriptor[]>;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export interface KernelConfigurationValidator {
  validate(environment: string): Promise<ConfigurationValidationResult>;
}
