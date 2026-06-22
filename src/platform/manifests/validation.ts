import {
  COMPONENT_KINDS,
  type ComponentDependency,
  type ComponentManifest,
} from '@/platform/manifests/contracts'

export interface ManifestValidationResult {
  valid: boolean
  errors: readonly string[]
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const ROUTE_PATTERN = /^\/[a-zA-Z0-9/_{}.-]*$/

function validateDependency(
  dependency: ComponentDependency,
  index: number,
): string[] {
  const errors: string[] = []
  if (!ID_PATTERN.test(dependency.id)) {
    errors.push(`dependencies[${index}].id must be a stable lowercase identifier`)
  }
  if (!COMPONENT_KINDS.includes(dependency.kind)) {
    errors.push(`dependencies[${index}].kind is unsupported`)
  }
  if (!dependency.versionRange.trim()) {
    errors.push(`dependencies[${index}].versionRange is required`)
  }
  return errors
}

export function validateComponentManifest(
  manifest: ComponentManifest,
): ManifestValidationResult {
  const errors: string[] = []

  if (manifest.schemaVersion !== '1.0') {
    errors.push('schemaVersion must be 1.0')
  }
  if (!ID_PATTERN.test(manifest.id)) {
    errors.push('id must be a stable lowercase identifier')
  }
  if (!VERSION_PATTERN.test(manifest.version)) {
    errors.push('version must use semantic versioning')
  }
  if (!COMPONENT_KINDS.includes(manifest.kind)) {
    errors.push('kind is unsupported')
  }
  if (!manifest.displayName.trim()) errors.push('displayName is required')
  if (!manifest.description.trim()) errors.push('description is required')
  if (!manifest.owner.trim()) errors.push('owner is required')
  if (!manifest.documentation.trim()) errors.push('documentation is required')

  for (const [name, route] of Object.entries(manifest.endpoints)) {
    if (route !== undefined && !ROUTE_PATTERN.test(route)) {
      errors.push(`endpoints.${name} must be an absolute platform route`)
    }
  }

  const dependencyIds = new Set<string>()
  manifest.dependencies.forEach((dependency, index) => {
    errors.push(...validateDependency(dependency, index))
    if (dependencyIds.has(dependency.id)) {
      errors.push(`dependency ${dependency.id} is declared more than once`)
    }
    if (dependency.id === manifest.id) {
      errors.push('a component cannot depend on itself')
    }
    dependencyIds.add(dependency.id)
  })

  return { valid: errors.length === 0, errors }
}
