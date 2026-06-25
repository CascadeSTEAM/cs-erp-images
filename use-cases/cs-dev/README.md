# cs-dev

**Image:** `ghcr.io/cascadesteam/erp-cs-dev`

Cascade STEAM development/trial — experimental apps, AI tools, education, not-production builds.

Intended for: Trial deployments, crash-testing new apps, evaluating AI/LLM integrations,
and LinuxFest/conference demos. Rebuilt frequently; not for production data.

## Apps

| App | Repo | Branch | Status |
|-----|------|--------|--------|
| frappe | frappe/frappe | version-16 (pinned by base image) | ✅ confirmed |
| erpnext | frappe/erpnext | version-16 | ✅ confirmed |
| wiki | frappe/wiki | develop | ⚠ unverified |
| education | frappe/education | version-16 | ✅ confirmed |
| mcp | frappe/mcp | main | ⚠ unverified (evaluate before cs promotion) |
| skills | frappe/skills | main | ⚠ unverified (evaluate before cs promotion) |
| meet | frappe/meet | develop | 🚧 not-production |
| drive | frappe/drive | main | 🚧 not-production |
| buzz | BuildWithHussain/buzz | main | ⚠ unverified |

## Known Incompatibilities

None confirmed yet — this image exists to discover them.

## Deployment Notes

- Not for production data; destroy/rebuild freely
- Apps marked 🚧 not-production are intentionally included for evaluation
- Promote an app to `cs` only after it passes a test build here
