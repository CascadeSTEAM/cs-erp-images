# Frappe / ERPNext App Catalogue

Source of truth for known apps, their v16 compatibility, and suitability for
use-case images. Update this file when an app is tested, a new version is
released, or compatibility changes.

**Last verified:** 2026-06-24  
**Frappe target:** version-16  
**Source document:** Cascade STEAM ERPNext Michael-Notes (Google Doc)

---

## How to read this table

| Column | Meaning |
|--------|---------|
| **Priority** | `install` = decided, will be included · `review` = under consideration · `vertical` = client-deployment specific · `built-in` = already in ERPNext/Frappe, no separate install · `revisit-at-scale` = right tool but premature for current deployment count |
| **Status** | `✅ confirmed` tested/working on v16 · `⚠ unverified` branch exists, untested · `❌ incompatible` known broken · `🗄 archived` repo archived · `🚧 not-production` flagged unstable by team |
| **Source** | `official` = frappe org · `community` = third-party · `fork` = fork of archived official · `incubator` = frappe-funded community project |
| **Branch** | Branch/tag to use in `apps.json` for v16 |

---

## Core (required in every image)

| App | Repo | Branch | Priority | Status | Notes |
|-----|------|--------|----------|--------|-------|
| Frappe Framework | frappe/frappe | version-16 | install | ✅ confirmed | Always included via base image |
| ERPNext | frappe/erpnext | version-16 | install | ✅ confirmed | Core ERP — accounting, inventory, purchasing, built-in POS, blog, newsletter, gantt |

---

## DevOps & Infrastructure (Garth)

| App | Repo | Branch | Priority | Status | Source | Notes |
|-----|------|--------|----------|--------|--------|-------|
| Press | frappe/press | main | revisit-at-scale | ⚠ unverified | official | Frappe Cloud hosting manager. Builds its own Docker images and runs a private S3-backed registry — **architecturally incompatible with cs-erp-images**. Replaces Ansible + docker compose + GHCR entirely. Revisit when managing 30+ client sites. See "Revisit at Scale" section. |
| Mail | frappe/mail | main | install | ⚠ unverified | official | JMAP email frontend using Stalwart backend. New and evolving. Requires separate Stalwart server deployment |
| Builder | frappe/builder | main | install | ⚠ unverified | official | WYSIWYG website/page builder. Figma plugin available |
| Builder Hub | frappe/builder_hub | main | review | ⚠ unverified | official | Template library for Builder |
| AI / MCP | frappe/mcp | main | install | ⚠ unverified | official | Frappe MCP server integration |
| AI / Skills | frappe/skills | main | install | ⚠ unverified | official | AI skills framework for Frappe |

---

## Communication & Collaboration (Garth)

| App | Repo | Branch | Priority | Status | Source | Notes |
|-----|------|--------|----------|--------|--------|-------|
| Raven | The-Commit-Company/raven | version-16 | install | ⚠ unverified | community | Real-time chat (Discord text replacement). Repo moved from frappe/raven. Has v16 branch; flagged incompatible Jan 2026 — needs retest |
| Gameplan | frappe/gameplan | main | install | ⚠ unverified | official | Async team discussions (Basecamp-style). Goal/project-oriented |
| Meet | frappe/meet | main | install | 🚧 not-production | official | Video calling (Google Meet / Jitsi replacement). Doc notes: "will eventually integrate with Raven" — not production ready |
| Drive | frappe/drive | main | install | 🚧 not-production | official | Google Drive replacement. Doc notes: "Very basic functionality, not production" |
| Suite | frappe/suite | main | install | 🚧 not-production | official | Office suite (Mail + Meet + Slides + Writer). Doc notes: "Very basic functionality, not production." Sub-apps: frappe/writer, frappe/sheets, frappe/slides |
| Buzz | BuildWithHussain/buzz | main | install | ⚠ unverified | incubator | Event management / conferences. Incubator project by BuildWithHussain |

---

## Business & CRM (Michael)

| App | Repo | Branch | Priority | Status | Source | Notes |
|-----|------|--------|----------|--------|--------|-------|
| CRM | frappe/crm | main | install | ✅ confirmed | official | Lead/deal/contact management. Separate from ERPNext CRM module |
| Wiki | frappe/wiki | main | install | ⚠ unverified | official | Public/internal knowledge base and shared resources |
| LMS | frappe/lms | main | install | ⚠ unverified | official | Training programs and curriculum delivery |
| Education | frappe/education | version-16 | install | ✅ confirmed | official | Student lifecycle, courses, fees. For conferences/LinuxFest followup |
| Insights (BI) | frappe/insights | main | install | ⚠ unverified | official | Self-serve analytics and data visualization |
| HRMS | frappe/hrms | version-16 | install | ✅ confirmed (v16.10.1) | official | HR, contracting, timesheets, payroll, leave. **Primarily for CS internal use** — most client orgs are volunteer-run |
| Payments | frappe/payments | develop | install | ✅ confirmed | official | Payment gateway abstraction (Stripe, PayPal, Razorpay). Required by apps that accept online payments |
| Mint (Bank Reconciliation) | The-Commit-Company/mint | main | install | ⚠ unverified | community | Bank reconciliation tool from The Commit Company |
| Newsletter | frappe/erpnext | — | built-in | ✅ confirmed | — | Email campaigns are built into ERPNext. No separate install needed |
| Blog | frappe/frappe | — | built-in | ✅ confirmed | — | Blog/website entries are built into Frappe Framework |

---

## Support

| App | Repo | Branch | Priority | Status | Source | Notes |
|-----|------|--------|----------|--------|--------|-------|
| Helpdesk | frappe/helpdesk | main | install | ✅ confirmed (v1.26.2) | official | Customer support ticketing + customer portal. Telephony dependency can be dropped |

---

## Under Review (not decided)

| App | Repo | Priority | Status | Source | Notes |
|-----|------|----------|--------|--------|-------|
| Telephony | frappe/telephony | review | ⚠ unverified | official | SIP/Twilio/Exotel. **CS will use external SIP solution** — likely drop entirely |
| Print Designer | frappe/print_designer | review | ❌ incompatible | official | Custom print formats. README explicitly states v15/develop only. Do not use on v16 |
| GANTT Charts | frappe/gantt | review | built-in | — | Gantt view is built into ERPNext Projects. No separate install needed |
| TaxJar | ERPNext integration | review | ⚠ unverified | official | US sales tax by client location. ERPNext built-in integration — may not need separate app |
| Matcha (Payment Reconciliation) | Negentropy-Solutions/matcha | review | ⚠ unverified | community | Advanced payment reconciliation |
| White Label | bhavesh95863/whitelabel | review | ⚠ unverified | community | Removes Frappe branding |
| IT Management | phamos-eu/it_management | review | ⚠ unverified | community | IT asset and service management |
| IT Management (alt) | Arus-Info/ProjectIT | review | ⚠ unverified | community | Alternative IT management |
| Genie (Screen/Audio Recording) | wahni-green/genie | review | ⚠ unverified | community | Issue reporting with screen/audio capture |
| Appointment | frappe (marketplace) | review | ⚠ unverified | official | Appointment booking. Also uses HRMS |
| Frappe Books | frappe/books | review | ⚠ unverified | official | Simplified accounting (simpler than ERPNext). Standalone — not an ERPNext app |
| Video Management | BuildWithHussain/vms | review | ⚠ unverified | incubator | Video hosting and management |
| Hive (Project Mgmt) | BuildWithHussain/hive | review | ⚠ unverified | incubator | Modern project management |
| Zoom Integration | BuildWithHussain/zoom_integration | review | ⚠ unverified | incubator | Zoom meeting integration |
| E-Signature | frappe/incubator | review | ⚠ unverified | incubator | Electronic signature. Incubator project, no public repo yet |
| Desk Theme | dhwani-ris/frappe_desk_theme | review | ⚠ unverified | community | Custom UI theming |
| Raven Push Notifications | The-Commit-Company/raven-cloud | review | ⚠ unverified | community | Push notification service for Raven |
| Clefincode Chat (Website) | clefincode/clefincode_chat | review | ⚠ unverified | community | Website chat widget |
| Ecommerce Integrations | frappe/ecommerce_integrations | review | ⚠ unverified | official | Shopify/WooCommerce sync |
| Changemakers | frappe/changemakers | review | ⚠ unverified | official | Homeless/social program management |
| go1 CMS | TridotsTech/go1cms | review | ⚠ unverified | community | Web development / CMS |

---

## Third-Party AI Integrations (all under review)

| App | Repo | Notes |
|-----|------|-------|
| ERPNext Copilot | byt3crafter/erpnext-copilot | Generic AI assistant |
| Next Assist | navdeepghai/nextassist | AI assistant |
| Frappe MCP Server | appliedrelevance/frappe-mcp-server | MCP server for Frappe |
| Next AI | erpnextai/next_ai | Google Gemini integration |
| ChangAI | ERPGulf/changAI | AI integration |
| ERPNext MCP Server | rakeshgangwar/erpnext-mcp-server | MCP server alternative |
| Frappe Claude Skills | OpenAEC-Foundation/Frappe_Claude_Skill_Package | Claude integration |
| KAI | KorucuTech/kai | AI assistant |
| Frappe Assistant Core | buildswithpaul/Frappe_Assistant_Core | AI assistant framework |
| MCP ERPNext | Casys-AI/mcp-erpnext | MCP server alternative |

*Note: evaluate against frappe/mcp + frappe/skills (official) before adopting community AI apps.*

---

## POS Options (under review)

| App | Repo | Status | Notes |
|-----|------|--------|-------|
| ERPNext Restaurant (alphabit) | alphabit-technology/erpnext-restaurant | ⚠ unverified | 182 ⭐, rich table UI, explicitly requires v13–v15. **Not v16 compatible** |
| URY Restaurant | ury-erp/ury | ⚠ unverified | 298 ⭐, POS + KDS + table mgmt. No explicit v16 branch. **Must test-build** |
| POSNext | BrainWise-DEV/POSNext | ⚠ unverified | Alternative POS |
| KLiK POS | Beveren-Software-Inc/KLiK_PoS | ⚠ unverified | Alternative POS |
| ERPNext built-in POS | frappe/erpnext | ✅ confirmed | Basic but v16 confirmed. Fallback if others fail |

---

## Verticals (client deployment targets)

| App | Repo | Branch | Status | Notes |
|-----|------|--------|--------|-------|
| Non Profit (Aakvatech fork) | Aakvatech-Limited/non_profit | Version-16 | ✅ confirmed | Fork of archived frappe/non_profit. Updated June 3 2026 |
| Frappe Giving | klisia-org/frappe_giving | main | ⚠ unverified | Online donation portal. Requires Payments. Integration with Aakvatech untested |
| Non Profit (official) | frappe/non_profit | — | 🗄 archived | Archived July 2025. No v16. Use Aakvatech fork |
| Church / Member Mgmt | meichthys/church | version-16 | ⚠ unverified | Member/event/donation model. **On hold** — terminology is church-specific |
| Education (ifitwala) | fderyckel/ifitwala_ed | — | ⚠ unverified | Alternative education vertical app |
| Healthcare | earthians/marley | — | ⚠ unverified | frappe/healthcare redirects here |
| Hospitality | frappe/hospitality | — | 🗄 archived | Archived Oct 2023. No v16 |
| Property Management | aakvatech/PropMS | — | ⚠ unverified | From Aakvatech |
| Agriculture | frappe/agriculture | — | ⚠ unverified | Agriculture management |
| Shipping | frappe/erpnext-shipping | — | ⚠ unverified | Shipping integrations |
| Grant Management | navariltd/navari_gms | — | ❌ incompatible | Most complete grant app but abandoned. Needs v16 port |

---

## Not Frappe Apps (external integrations)

| Integration | Notes |
|-------------|-------|
| **Authentik (SSO/LDAP)** | Required in PROD-PLAN. External identity provider — not a Frappe app. Integrates via LDAP or SAML. Tracked separately from image builds |
| VOIP / FreePBX | HUMENTH/frappe_voip + FreePBX CRM link. Telephony integration if needed |
| Collabora | WOPI-compatible office editing. fossibleworks integration guide |
| Offsite Backups | frappe/offsite_backups — backup management, not an ERPNext app |
| MemberMatters | Django-based makerspace management. REST bridge to Frappe possible |

---

## Gaps — Needs a Solution

| Need | Vertical | Current gap | Options |
|------|----------|-------------|---------|
| Makerspace member management | makerspace | No dedicated v16 app | 1) ERPNext Subscriptions + custom Membership doctype · 2) Fork + re-term church · 3) Commission new app |
| Equipment / resource booking | makerspace | No Frappe app | Custom doctype; external MemberMatters bridge |
| Physical access control | makerspace | No Frappe app | REST/MQTT bridge (custom) |
| Grant lifecycle management | nonprofit | navari_gms abandoned | Fork + v16 port |
| MSP deployment tracking | cs-managed-services | No dedicated app | ERPNext Projects + CRM; evaluate IT management apps |
| Confirmed v16 restaurant POS | restaurant | URY unverified | Test URY build; fallback to ERPNext built-in POS |

---

## Verification Queue (priority order)

1. `frappe/helpdesk` — confirm telephony is no longer a hard dependency on v1.26+
2. `Aakvatech-Limited/non_profit` + `klisia-org/frappe_giving` + `frappe/payments` — nonprofit image integration test
3. `ury-erp/ury` — restaurant image test build
4. `The-Commit-Company/raven` — retest v16 compatibility (flagged broken Jan 2026)
5. `frappe/mail` — assess Stalwart dependency requirements

---

## Revisit at Scale

Apps deliberately deferred — not wrong choices, just premature for current deployment count.
Revisit when the operational pain they solve becomes real.

| App | Repo | Threshold | Why deferred | What it replaces |
|-----|------|-----------|-------------|-----------------|
| Press | frappe/press | ~30+ client sites | Builds its own Docker images + private registry — architecturally incompatible with cs-erp-images. Heavy infrastructure: requires S3, private registry server, agents on every managed node, and replaces Ansible/Compose entirely. | Ansible + docker compose + cs-erp-images + manual site provisioning |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial catalogue from research session |
| 2026-06-24 | Major expansion from CS ERPNext Michael-Notes doc — added 40+ apps, TO INSTALL/REVIEW/VERTICAL categorisation, built-in flags, external integrations |
| 2026-06-24 | Press moved to "Revisit at Scale" — architecturally incompatible with cs-erp-images (builds own images + private registry); deferred until 30+ client sites |
