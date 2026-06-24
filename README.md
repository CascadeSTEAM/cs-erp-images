# cs-erp-images

Versioned Frappe/ERPNext Docker images for Cascade STEAM deployments, built
per use-case and published to GitHub Container Registry.

## How it works

Each subdirectory under `use-cases/` defines one image flavour via an
`apps.json` file. GitHub Actions builds all flavours on a version tag push and
publishes them to GHCR. Deployments in `bms-ai-cluster` reference specific
image tags — upgrading means bumping the tag and redeploying.

## Image naming

```
ghcr.io/cascadesteam/erp-<use-case>:<frappe-version>-r<revision>
ghcr.io/cascadesteam/erp-helpdesk:v16.23.1-r1
```

## Use cases

| Use case | Image | Description |
|----------|-------|-------------|
| `helpdesk` | `erp-helpdesk` | ERPNext + Helpdesk + Telephony |

*(Add rows here as use cases are defined.)*

## Adding a use case

1. Create `use-cases/<name>/apps.json` listing the apps and branches
2. Add a `use-cases/<name>/README.md` describing the intended deployment
3. Open a PR — images build automatically on merge to `main` when tagged

## Releasing

```bash
git tag v16.23.1-r1
git push origin v16.23.1-r1
```

This triggers a matrix build of all use cases. The Frappe major version is
inferred from the tag (e.g. `v16.*` → `version-16` branch).

To build a single use case manually: use the **Build and Push** workflow
dispatch in GitHub Actions, specifying the use case name and tag.

## Local build

```bash
./scripts/build-local.sh helpdesk v16.23.1-r1
```

Requires Docker Buildx. Pulls the upstream `frappe_docker` Containerfile
directly from GitHub so no local copy is needed.

## Deployment

Compose files in `bms-ai-cluster` reference images from this registry:

```yaml
image: ghcr.io/cascadesteam/erp-helpdesk:v16.23.1-r1
```

To upgrade: update the tag, then `docker compose pull && docker compose up -d`.
