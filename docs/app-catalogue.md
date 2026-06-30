# Frappe / ERPNext App Catalogue

Source of truth for known apps, their v16 compatibility, and which use-case
images they belong to. Update this file when an app is tested, a new version
is released, a use-case assignment changes, or compatibility changes.

**Last verified:** 2026-06-24  
**Frappe target:** version-16  
**Source document:** Cascade STEAM ERPNext Michael-Notes (Google Doc)

---

## How to read this table

| Column | Meaning |
|--------|---------|
| **Priority** | `install` = decided · `review` = under consideration · `vertical` = client-deployment specific · `built-in` = already in ERPNext/Frappe · `watch-upstream` = not ready, track for future · `revisit-at-scale` = right tool but premature · `cs-dev` = assigned to CS-DEV (trial/experimental) image |
| **Status** | `✅ confirmed` working on v16 · `⚠ unverified` branch exists, untested · `❌ incompatible` known broken · `🗄 archived` repo archived · `🚧 not-production` flagged unstable |
| **Source** | `official` = frappe org · `community` = third-party · `fork` = fork of archived official · `incubator` = frappe-funded community project |
| **Branch** | Branch/tag to use in `apps.json` for v16 |
| **Images** | Which use-case images include this app. `cs` = CS production · `cs-dev` = CS development/trial · future: `nonprofit`, `restaurant`, `makerspace` |

---

## Use-Case Images (defined so far)

| Image | Purpose | Status |
|-------|---------|--------|
| `cs` | CS production — clean, stable, maintainable. Only confirmed or thoroughly tested apps. | 🔨 defining |
| `cs-dev` | CS development/trial — crash-testing, AI experiments, not-production apps. Rebuilt often. | 📋 planned |
| `nonprofit` | Client vertical — donation management, member tracking | 📋 planned |
| `restaurant` | Client vertical — POS, kitchen display, table management | 📋 planned |
| `makerspace` | Client vertical — member management, equipment, events | 📋 planned |

---

## Core (required in every image)

| App | Repo | Branch | Priority | Status | Images | Notes |
|-----|------|--------|----------|--------|--------|-------|
| Frappe Framework | frappe/frappe | version-16 | install | ✅ confirmed | all | Always included via base image |
| ERPNext | frappe/erpnext | version-16 | install | ✅ confirmed | all | Core ERP — accounting, inventory, purchasing, built-in POS, blog, newsletter, gantt |

---

## DevOps & Infrastructure (Garth)

| App | Repo | Branch | Priority | Status | Source | Images | Notes |
|-----|------|--------|----------|--------|--------|--------|-------|
| Press | frappe/press | main | revisit-at-scale | ⚠ unverified | official | — | Builds own Docker images + private S3 registry. Architecturally incompatible with cs-erp-images. See "Revisit at Scale" section |
| Mail | frappe/mail | main | watch-upstream | ⚠ unverified | official | — | JMAP frontend requiring Stalwart backend. CS staying on Google for now. **External alternative: Mailcow** (Docker, Postfix+Dovecot+Rspamd) connects to ERPNext via standard SMTP/IMAP — no Frappe app needed |
| Builder | frappe/builder | develop | install | ⚠ unverified | official | cs | WYSIWYG website/page builder. Confirmed for cs image. Figma plugin available |
| Builder Hub | frappe/builder_hub | develop | install | ⚠ unverified | official | cs | Template library for Builder — include alongside Builder |
| AI / MCP | frappe/mcp | main | install | ⚠ unverified | official | cs, cs-dev | Official Frappe AI framework. Promoted to cs 2026-06-30 (operator override — see Changelog) |
| AI / Skills | frappe/skills | main | install | ⚠ unverified | official | cs, cs-dev | AI skills framework. Promoted to cs 2026-06-30 (operator override — see Changelog) |

---

## Communication & Collaboration (Garth)

| App | Repo | Branch | Priority | Status | Source | Images | Notes |
|-----|------|--------|----------|--------|--------|--------|-------|
| Raven | The-Commit-Company/raven | develop | install | ⚠ unverified | community | cs | Real-time chat. Repo moved from frappe/raven. No version-16 branch — default is develop. **Needs test build before cs image release** |
| Gameplan | frappe/gameplan | develop | install | ⚠ unverified | official | cs, cs-dev | Async team discussions. Promoted to cs 2026-06-30 (operator override — see Changelog). Branch corrected to develop |
| Meet | frappe/meet | develop | install | 🚧 not-production | official | cs, cs-dev | Video calling. Promoted to cs 2026-06-30 (operator override — see Changelog). Branch corrected to develop (no main branch exists) |
| Drive | frappe/drive | main | install | 🚧 not-production | official | cs, cs-dev | Google Drive replacement. Promoted to cs 2026-06-30 (operator override — see Changelog) |
| Suite | frappe/suite | develop | install | 🚧 not-production | official | cs, cs-dev | Office suite (Mail + Meet + Slides + Writer). Promoted to cs 2026-06-30 (operator override — see Changelog). Sub-apps: frappe/writer@develop, frappe/sheets@main, frappe/slides@develop |
| Buzz | bwhtech/buzz | develop | install | ⚠ unverified | incubator | cs, cs-dev | Event management. Org renamed from BuildWithHussain to bwhtech 2026-06-30. Promoted to cs 2026-06-30 (operator override — see Changelog) |

---

## Business & CRM (Michael)

| App | Repo | Branch | Priority | Status | Source | Images | Notes |
|-----|------|--------|----------|--------|--------|--------|-------|
| CRM | frappe/crm | main | install | ✅ confirmed | official | cs | Lead/deal/contact/client management |
| Wiki | frappe/wiki | develop | install | ⚠ unverified | official | cs, cs-dev | Public/internal knowledge base. Promoted to cs 2026-06-30 (operator override — see Changelog) |
| LMS | frappe/lms | develop | install | ⚠ unverified | official | cs | Training programs. Promoted to cs 2026-06-30 (operator override — see Changelog). Branch corrected to develop |
| Education | frappe/education | version-16 | cs-dev | ✅ confirmed | official | cs-dev | Student lifecycle, courses, fees. LinuxFest/conference use — not active. **Explicitly excluded from cs 2026-06-30** per operator decision |
| Insights (BI) | frappe/insights | main | install | ⚠ unverified | official | cs | Self-serve analytics and data visualization |
| HRMS | frappe/hrms | version-16 | install | ✅ confirmed (v16.10.1) | official | cs | HR, contracting, timesheets, payroll. **CS internal use only** — client orgs are mostly volunteer-run |
| Payments | frappe/payments | develop | install | ✅ confirmed | official | cs, nonprofit, restaurant | Payment gateway abstraction (Stripe, PayPal, Razorpay) |
| Mint (Bank Reconciliation) | The-Commit-Company/mint | main | install | ⚠ unverified | community | cs | Bank reconciliation from The Commit Company |
| Newsletter | frappe/erpnext | — | built-in | ✅ confirmed | — | all | Built into ERPNext. No separate install |
| Blog | frappe/frappe | — | built-in | ✅ confirmed | — | all | Built into Frappe Framework |

---

## Support

| App | Repo | Branch | Priority | Status | Source | Images | Notes |
|-----|------|--------|----------|--------|--------|--------|-------|
| Helpdesk | frappe/helpdesk | main | install | ✅ confirmed (v1.26.2) | official | cs | Customer support + customer portal. Telephony dependency dropped |
| Telephony | frappe/telephony | develop | review | ⚠ unverified | official | — | CS using external SIP solution — not needed in cs image |

---

## Under Review (not yet decided)

| App | Repo | Priority | Status | Source | Notes |
|-----|------|----------|--------|--------|-------|
| Print Designer | frappe/print_designer | review | ❌ incompatible | official | v15/develop only. Do not use on v16 |
| GANTT Charts | frappe/gantt | built-in | — | — | Built into ERPNext Projects |
| TaxJar | ERPNext integration | review | ⚠ unverified | official | US sales tax. ERPNext built-in integration — may not need separate app |
| Matcha (Payment Reconciliation) | Negentropy-Solutions/matcha | review | ⚠ unverified | community | Advanced payment reconciliation |
| White Label | bhavesh95863/whitelabel | review | ⚠ unverified | community | Removes Frappe branding |
| IT Management | phamos-eu/it_management | review | ⚠ unverified | community | IT asset and service management |
| IT Management (alt) | Arus-Info/ProjectIT | review | ⚠ unverified | community | Alternative IT management |
| Genie (Screen/Audio Recording) | wahni-green/genie | review | ⚠ unverified | community | Issue reporting with screen/audio capture |
| Appointment | frappe (marketplace) | review | ⚠ unverified | official | Appointment booking. Also uses HRMS |
| Frappe Books | frappe/books | review | ⚠ unverified | official | Simplified accounting — standalone, not an ERPNext app |
| VMS | BuildWithHussain/vms | review | ⚠ unverified | incubator | Video hosting and management |
| Hive (Project Mgmt) | BuildWithHussain/hive | review | ⚠ unverified | incubator | Modern project management |
| Zoom Integration | BuildWithHussain/zoom_integration | review | ⚠ unverified | incubator | Zoom meeting integration |
| E-Signature | frappe/incubator | review | ⚠ unverified | incubator | No public repo yet |
| Desk Theme | dhwani-ris/frappe_desk_theme | review | ⚠ unverified | community | Custom UI theming |
| Raven Push Notifications | The-Commit-Company/raven-cloud | review | ⚠ unverified | community | Push notification service for Raven |
| Clefincode Chat | clefincode/clefincode_chat | review | ⚠ unverified | community | Website chat widget |
| Ecommerce Integrations | frappe/ecommerce_integrations | review | ⚠ unverified | official | Shopify/WooCommerce sync |
| Changemakers | frappe/changemakers | review | ⚠ unverified | official | Homeless/social program management |
| go1 CMS | TridotsTech/go1cms | review | ⚠ unverified | community | Web development / CMS |

---

## Third-Party AI Integrations (all cs-dev pending official evaluation)

*Evaluate `frappe/mcp` + `frappe/skills` (official) in cs-dev first. Only adopt
community AI apps if the official stack doesn't cover the need.*

| App | Repo | Images | Notes |
|-----|------|--------|-------|
| ERPNext Copilot | byt3crafter/erpnext-copilot | cs-dev | |
| Next Assist | navdeepghai/nextassist | cs-dev | |
| Frappe MCP Server | appliedrelevance/frappe-mcp-server | cs-dev | |
| Next AI | erpnextai/next_ai | cs-dev | Google Gemini |
| ChangAI | ERPGulf/changAI | cs-dev | |
| ERPNext MCP Server | rakeshgangwar/erpnext-mcp-server | cs-dev | |
| Frappe Claude Skills | OpenAEC-Foundation/Frappe_Claude_Skill_Package | cs-dev | |
| KAI | KorucuTech/kai | cs-dev | |
| Frappe Assistant Core | buildswithpaul/Frappe_Assistant_Core | cs-dev | |
| MCP ERPNext | Casys-AI/mcp-erpnext | cs-dev | |

---

## POS Options (under review — needed for restaurant image)

| App | Repo | Status | Images | Notes |
|-----|------|--------|--------|-------|
| URY Restaurant | ury-erp/ury | ⚠ unverified | restaurant | 298 ⭐, POS + KDS + table mgmt. No explicit v16 branch. **Must test-build** |
| ERPNext Restaurant (alphabit) | alphabit-technology/erpnext-restaurant | ❌ incompatible | — | 182 ⭐. Explicitly requires v13–v15 |
| POSNext | BrainWise-DEV/POSNext | ⚠ unverified | — | Alternative POS |
| KLiK POS | Beveren-Software-Inc/KLiK_PoS | ⚠ unverified | — | Alternative POS |
| ERPNext built-in POS | frappe/erpnext | ✅ confirmed | restaurant | Basic but v16 confirmed. Fallback if URY fails |

---

## Verticals (client deployment targets)

| App | Repo | Branch | Status | Images | Notes |
|-----|------|--------|--------|--------|-------|
| Non Profit (Aakvatech fork) | Aakvatech-Limited/non_profit | Version-16 | ✅ confirmed | nonprofit | Fork of archived frappe/non_profit. Updated June 3 2026 |
| Frappe Giving | klisia-org/frappe_giving | main | ⚠ unverified | nonprofit | Online donation portal. Requires Payments. Integration with Aakvatech untested |
| Non Profit (official) | frappe/non_profit | — | 🗄 archived | — | Archived July 2025. Use Aakvatech fork |
| Church / Member Mgmt | meichthys/church | version-16 | ⚠ unverified | — | **On hold** — church-specific terminology. Potential makerspace foundation if re-termed |
| Education (ifitwala) | fderyckel/ifitwala_ed | — | ⚠ unverified | — | Alternative education vertical |
| Healthcare | earthians/marley | — | ⚠ unverified | — | frappe/healthcare now redirects here |
| Hospitality | frappe/hospitality | — | 🗄 archived | — | Archived Oct 2023 |
| Property Management | aakvatech/PropMS | — | ⚠ unverified | — | From Aakvatech |
| Agriculture | frappe/agriculture | — | ⚠ unverified | — | Agriculture management |
| Shipping | frappe/erpnext-shipping | — | ⚠ unverified | — | Shipping integrations |
| Grant Management | navariltd/navari_gms | — | ❌ incompatible | — | Abandoned. Needs v16 port |

---

## Not Frappe Apps (external integrations)

| Integration | Images | Notes |
|-------------|--------|-------|
| **Authentik (SSO/LDAP)** | cs | Required in CS PROD-PLAN. External identity provider. Integrates via LDAP or SAML. Tracked separately from image builds |
| **Mailcow** | cs | Recommended FOSS mail server (Postfix+Dovecot+Rspamd+SOGo). Docker-based. Connects to ERPNext via standard SMTP/IMAP — no Frappe app needed. Separate LXC deployment |
| VOIP / FreePBX | — | HUMENTH/frappe_voip. CS using external SIP solution |
| Collabora | — | WOPI office editing. fossibleworks integration guide |
| Offsite Backups | — | frappe/offsite_backups — not an ERPNext app |
| MemberMatters | makerspace | Django makerspace management. REST bridge to Frappe possible |
| Stalwart | — | JMAP mail backend for frappe/mail. Deferred with frappe/mail |

---

## Gaps — Needs a Solution

| Need | Vertical | Gap | Options |
|------|----------|-----|---------|
| Makerspace member management | makerspace | No dedicated v16 app | ERPNext Subscriptions + custom Membership doctype · Fork + re-term church · Commission new app |
| Equipment / resource booking | makerspace | No Frappe app | Custom doctype; MemberMatters bridge |
| Physical access control | makerspace | No Frappe app | REST/MQTT bridge (custom) |
| Grant lifecycle management | nonprofit | navari_gms abandoned | Fork + v16 port |
| MSP deployment tracking | cs | No dedicated app | ERPNext Projects + CRM |
| Confirmed v16 restaurant POS | restaurant | URY unverified | Test URY; fallback ERPNext built-in POS |

---

## Verification Queue (priority order)

1. `The-Commit-Company/raven` — retest v16 compatibility before cs image release
2. `Aakvatech-Limited/non_profit` + `klisia-org/frappe_giving` + `frappe/payments` — nonprofit image
3. `ury-erp/ury` — restaurant image test build
4. `frappe/mail` — assess Stalwart requirements when revisiting mail strategy
5. `frappe/mcp` + `frappe/skills` — evaluate in cs-dev before any cs promotion

---

## Revisit at Scale

| App | Repo | Threshold | Why deferred | What it replaces |
|-----|------|-----------|-------------|-----------------|
| Press | frappe/press | ~30+ client sites | Builds own Docker images + private S3 registry — incompatible with cs-erp-images. Requires S3, private registry server, agents on every managed node | Ansible + docker compose + cs-erp-images + manual site provisioning |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial catalogue from research session |
| 2026-06-24 | Major expansion from CS ERPNext Michael-Notes doc |
| 2026-06-24 | Press → revisit-at-scale |
| 2026-06-24 | Added `images` column and use-case image table. Mail → watch-upstream (Mailcow as external recommendation). Gameplan → review. LMS → review (next round). AI apps → cs-dev. Meet/Drive/Suite/Buzz → cs-dev. Raven → cs. Introduced cs-dev image concept |
| 2026-06-24 | Builder + Builder Hub → cs. Wiki → cs-dev. Insights → cs. |
| 2026-06-24 | Education → cs-dev (LinuxFest work not active; move to cs-dev until needed) |
| 2026-06-24 | Fix branch refs: raven/builder/builder_hub/wiki → develop (no main/version-16 branch exists) |
| 2026-06-30 | Operator decision: promote Buzz, Gameplan, Meet, Drive, Suite (+writer/sheets/slides), AI mcp/skills, Wiki, LMS from cs-dev/review directly into `cs`, overriding prior staging gates, to prioritize MVP speed. Press and Mail remain excluded (hard architectural/dependency blockers); Education remains excluded (explicit operator call, LinuxFest work not active). Corrected stale branch refs: Buzz org BuildWithHussain → bwhtech; Meet/Gameplan/LMS → develop (verified against actual GitHub default branches) |
