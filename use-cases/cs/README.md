# cs

**Image:** `ghcr.io/cascadesteam/erp-cs`

Cascade STEAM production — helpdesk, CRM, HRMS, payments, and the full
Garth/Devops + Michael/Business app set from the ERPNext Michael-Notes doc
(Press, Mail, and Education excluded — see Known Incompatibilities).

Intended for: Cascade STEAM's primary production ERPNext/Frappe site
(support.cascadesteam.org) — internal ops, member/customer support, and
collaboration tooling in one site.

## Apps

| App | Repo | Branch |
|-----|------|--------|
| frappe | frappe/frappe | version-16 (pinned by base image) |
| erpnext | frappe/erpnext | version-16 |
| helpdesk | frappe/helpdesk | main |
| crm | frappe/crm | main |
| payments | frappe/payments | develop |
| hrms | frappe/hrms | version-16 |
| raven | The-Commit-Company/raven | develop |
| builder | frappe/builder | develop |
| builder_hub | frappe/builder_hub | develop |
| insights | frappe/insights | main |
| mint | The-Commit-Company/mint | main |
| buzz | bwhtech/buzz | develop |
| gameplan | frappe/gameplan | develop |
| meet | frappe/meet | develop |
| drive | frappe/drive | main |
| suite | frappe/suite | develop |
| writer | frappe/writer | develop |
| sheets | frappe/sheets | main |
| slides | frappe/slides | develop |
| mcp | frappe/mcp | main |
| skills | frappe/skills | main |
| wiki | frappe/wiki | develop |
| lms | frappe/lms | develop |

Newsletter and Blog need no separate app — both are built into ERPNext/Frappe core.

## Known Incompatibilities

- **Press** (frappe/press) — not an installable app; builds its own Docker
  images + private S3 registry. Architecturally incompatible with
  cs-erp-images. Tracked separately under "Revisit at Scale" in
  `docs/app-catalogue.md`.
- **Mail** (frappe/mail) — requires a Stalwart JMAP backend not deployed
  here. CS is using external Mailcow instead (SMTP/IMAP, no Frappe app
  needed). Omitted from this image on 2026-06-30 per operator decision.
- **Education** (frappe/education) — deliberately kept in `cs-dev` only;
  not active for CS production. Omitted from this image on 2026-06-30
  per operator decision.

## Deployment Notes

Most apps added 2026-06-30 (buzz, gameplan, meet, drive, suite, writer,
sheets, slides, mcp, skills, wiki, lms) were previously gated to `cs-dev`
or `review` status in the catalogue as unverified or not-production. They
were promoted directly into `cs` per an explicit operator decision to
prioritize MVP speed over staged verification — expect possible build or
runtime issues from untested app combinations on first deploy.
