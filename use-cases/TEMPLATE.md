# {{NAME}}

**Image:** `ghcr.io/cascadesteam/erp-{{NAME}}`

{{DESCRIPTION}}

Intended for: <!-- describe the deployment scenario, e.g. "customer support portals, IT helpdesks" -->

## Apps

| App | Repo | Branch |
|-----|------|--------|
| frappe | frappe/frappe | version-16 (pinned by base image) |
| erpnext | frappe/erpnext | version-16 |
<!-- add one row per additional app; keep in sync with apps.json -->

## Known Incompatibilities

<!-- list any apps that should NOT be combined with this use case -->
None.

## Deployment Notes

<!-- any deployment-specific notes: required env vars, site config, external dependencies -->
