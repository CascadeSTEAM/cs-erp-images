# grouchys

**Image:** `ghcr.io/cascadesteam/erp-grouchys`

ERPNext with website builder, team chat (Raven), and the Frappe office suite.

Intended for: deployments that pair a Builder-based public website with Raven
team chat and the Frappe office suite.

## Apps

| App | Repo | Branch |
|-----|------|--------|
| frappe | frappe/frappe | version-16 (pinned by base image) |
| erpnext | frappe/erpnext | version-16 |
| builder | frappe/builder | develop |
| builder_hub | frappe/builder_hub | develop |
| raven | The-Commit-Company/raven | develop |
| suite | frappe/suite | develop |
| raven-cloud | The-Commit-Company/raven-cloud | main |
<!-- add one row per additional app; keep in sync with apps.json -->

## Known Incompatibilities

<!-- list any apps that should NOT be combined with this use case -->
None.

## Deployment Notes

Several apps are pinned to moving branches (`develop`/`main`) rather than
release branches — acceptable for bring-up, but pin to release branches or
commits before this image is relied on in production.
