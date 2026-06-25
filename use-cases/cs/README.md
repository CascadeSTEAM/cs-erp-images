# cs

**Image:** `ghcr.io/cascadesteam/erp-cs`

Cascade STEAM production — helpdesk, CRM, HRMS, payments, and communication tools.

Intended for: CS production deployment on CT111. All apps are confirmed v16-compatible
or are priority installs pending test build.

## Apps

| App | Repo | Branch | Status |
|-----|------|--------|--------|
| frappe | frappe/frappe | version-16 (pinned by base image) | ✅ confirmed |
| erpnext | frappe/erpnext | version-16 | ✅ confirmed |
| helpdesk | frappe/helpdesk | main | ✅ confirmed (v1.26.2) |
| crm | frappe/crm | main | ✅ confirmed |
| payments | frappe/payments | develop | ✅ confirmed |
| hrms | frappe/hrms | version-16 | ✅ confirmed (v16.10.1) |
| raven | The-Commit-Company/raven | develop | ⚠ needs test build |
| builder | frappe/builder | develop | ⚠ unverified |
| builder_hub | frappe/builder_hub | develop | ⚠ unverified |
| insights | frappe/insights | main | ⚠ unverified |
| mint | The-Commit-Company/mint | main | ⚠ unverified |

## Known Incompatibilities

- `frappe/print_designer` — v15/develop only, do not add
- `frappe/telephony` — removed from cs; CS uses external SIP solution

## Deployment Notes

- Site: support.cascadesteam.org
- External dependencies: Authentik (SSO/LDAP), Mailcow (SMTP/IMAP) — deployed separately
- Raven requires a Redis instance; confirm frappe_docker base image includes it
