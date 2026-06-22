import { describe, expect, it } from 'vitest'
import type { ComponentManifest } from '@/platform/manifests/contracts'
import { validateComponentManifest } from '@/platform/manifests/validation'

const validManifest: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'kernel.audit',
  displayName: 'Audit Service',
  version: '1.0.0',
  kind: 'service',
  description: 'Records platform audit events.',
  owner: 'system-kernel',
  status: 'experimental',
  capabilities: ['audit.write'],
  permissions: ['audit.append'],
  dependencies: [],
  endpoints: {
    health: '/health',
    readiness: '/ready',
    liveness: '/live',
  },
  configurationKeys: [],
  documentation: '/docs/architecture/audit.md',
}

describe('component manifest validation', () => {
  it('accepts a complete standard manifest', () => {
    expect(validateComponentManifest(validManifest)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('rejects invalid identifiers and self-dependencies', () => {
    const result = validateComponentManifest({
      ...validManifest,
      id: 'Invalid ID',
      dependencies: [
        {
          id: 'Invalid ID',
          kind: 'service',
          requirement: 'required',
          versionRange: '^1.0.0',
        },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('id must be a stable lowercase identifier')
    expect(result.errors).toContain('a component cannot depend on itself')
  })
})
