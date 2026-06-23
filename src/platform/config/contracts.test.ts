import { describe, expectTypeOf, it } from 'vitest';
import type {
  ConfigurationValue,
  PublicConfigurationValue,
  ReferencedConfigurationValue,
} from '@/platform/config/contracts';

describe('Kernel configuration contracts', () => {
  it('separates public values from secret references', () => {
    expectTypeOf<PublicConfigurationValue<string>>().toMatchTypeOf<ConfigurationValue<string>>();
    expectTypeOf<ReferencedConfigurationValue>().toMatchTypeOf<ConfigurationValue>();
    expectTypeOf<ReferencedConfigurationValue>().not.toHaveProperty('value');
  });
});
