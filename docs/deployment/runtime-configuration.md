# Runtime Configuration

## Gate 1 Scope

XAICore validates runtime configuration at startup through
`src/config/environment.ts`. Supported profiles are `development`, `test`, `staging`,
and `production`.

Configuration is separated into:

- Public runtime values returned under `RuntimeConfig.public`.
- Sensitive references returned under `RuntimeConfig.sensitiveReferences`.
- Secret values read only by their owning infrastructure adapter and never returned by
  runtime configuration, logged, or included in diagnostics.

Staging and production require an explicit API host and HTTPS CORS origins. Origins
with paths, queries, or fragments are rejected. Invalid profiles and numeric values
also fail startup.

## Secret Provider

`DATABASE_URL_SECRET_REF` is an opaque reference only. Selecting and integrating the
production secret-management provider remains blocked on deployment-target approval.
Until then, no production secret resolver is implemented or implied.

The example environment contains only active Gate 1 foundation settings. Provider,
billing, wallet, trading, blockchain, and business-feature secrets remain out of scope.
