# Frappe / ERPNext App Catalogue

Source of truth for known apps, their v16 compatibility, and suitability for
use-case images. Update this file when an app is tested, a new version is
released, or compatibility changes.

**Last verified:** 2026-06-24  
**Frappe target:** version-16

---

## How to read this table

| Column | Meaning |
|--------|---------|
| **Status** | `✅ confirmed` tested and working on v16 · `⚠ unverified` branch exists but untested · `❌ incompatible` known broken · `🗄 archived` repo archived upstream |
| **Source** | `official` = frappe org · `community` = third-party maintained · `fork` = fork of archived official |
| **Branch** | The branch/tag to use in `apps.json` for v16 |
| **Used in** | Which use-case images currently reference this app |

---

## Core (required in every image)

| App | Repo | Branch | Status | Notes |
|-----|------|--------|--------|-------|
| Frappe Framework | frappe/frappe | version-16 | ✅ confirmed | Always included via base image |
| ERPNext | frappe/erpnext | version-16 | ✅ confirmed | Core ERP — accounting, inventory, purchasing |

---

## Support & Communication

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Helpdesk | frappe/helpdesk | main | ✅ confirmed | cs-managed-services | Customer support ticketing portal. Requires telephony unless telephony is removed as dependency (verify on v1.26+) |
| Telephony | frappe/telephony | develop | ⚠ unverified | — | SIP/Twilio/Exotel integration. **Not used** — CS will use external SIP solution |
| Raven (Chat) | The-Commit-Company/raven | version-16 | ⚠ unverified | — | Internal team chat. Repo moved from frappe/raven (404). Has v16 branch; flagged incompatible Jan 2026 — needs retest |

---

## CRM & Sales

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| CRM | frappe/crm | main | ✅ confirmed | cs-managed-services | Lead/deal/contact management. Separate from ERPNext CRM module |
| Webshop | frappe/webshop | main | ⚠ unverified | — | E-commerce storefront on Frappe. v16 compatibility unclear |

---

## Finance & Payments

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Payments | frappe/payments | develop | ✅ confirmed | nonprofit, restaurant | Payment gateway abstraction (Stripe, PayPal, Razorpay, etc.). Required by apps that accept online payments |
| Lending | frappe/lending | version-16 | ✅ confirmed (v16.1.1) | — | Loan origination and management |

---

## HR & People

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| HRMS | frappe/hrms | version-16 | ✅ confirmed (v16.10.1) | — | Full HR: employees, payroll, leave, attendance. **Not included by default** — most target orgs are volunteer-run |

---

## Nonprofit & Fundraising

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Non Profit (Aakvatech fork) | Aakvatech-Limited/non_profit | Version-16 | ✅ confirmed | nonprofit | Fork of archived frappe/non_profit. Member management, donations, chapters, volunteers. Updated June 3 2026 |
| Frappe Giving | klisia-org/frappe_giving | main | ⚠ unverified | nonprofit | Online donation portal (customer-facing). Likely requires Payments. Integration with Aakvatech non_profit untested |
| Non Profit (official) | frappe/non_profit | — | 🗄 archived | — | Archived July 2025. No v16 branch. Superseded by Aakvatech fork |
| Grant Management | navariltd/navari_gms | — | ❌ incompatible | — | Most complete grant lifecycle app but effectively abandoned. Needs forking and v16 port before use |

---

## Education & Community

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Education | frappe/education | version-16 | ✅ confirmed | — | Student lifecycle, courses, LMS, fees. Primarily for educational institutions |
| Church / Member Mgmt | meichthys/church | version-16 | ⚠ unverified | — | Member/household/event/donation model. Structurally useful for community orgs but **terminology is church-specific** (congregation, ministry, etc.). On hold pending a better makerspace option |

---

## Restaurant & Hospitality

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| URY Restaurant | ury-erp/ury | main | ⚠ unverified | restaurant | 298 ⭐ POS + Kitchen Display System + table management + analytics. No explicit v16 branch declaration. Last release Nov 2025. **Must test-build before including** |
| ERPNext POS | frappe/erpnext | version-16 | ✅ confirmed | — | Built-in ERPNext point-of-sale. Basic but v16 confirmed. Fallback if URY fails |
| Hospitality (official) | frappe/hospitality | — | 🗄 archived | — | Archived October 2023. No v16 support |
| ERPNext Restaurant | Rocket-Quack/erpnext_restaurant | version-16 | ⚠ unverified | — | Has v16 branch. Only 2 ⭐ — very early stage |

---

## Analytics & Reporting

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Insights | frappe/insights | main | ⚠ unverified | — | Self-serve analytics and dashboards on Frappe data |
| Print Designer | frappe/print_designer | develop | ❌ incompatible | — | Custom print format designer. README explicitly states v15/develop only. Do not use on v16 |

---

## Content & Web

| App | Repo | Branch | Status | Used in | Notes |
|-----|------|--------|--------|---------|-------|
| Builder | frappe/builder | main | ⚠ unverified | — | Visual website/page builder |
| Wiki | frappe/wiki | main | ⚠ unverified | — | Internal knowledge base |

---

## Gaps & Needed Apps

Apps we need that don't yet have a good v16 option:

| Need | Vertical | Current gap | Options |
|------|----------|-------------|---------|
| Makerspace member management | makerspace | No dedicated app | 1) Custom doctype on ERPNext Subscriptions · 2) Fork + re-term `meichthys/church` · 3) Commission a community app |
| Equipment / resource booking | makerspace | No Frappe app | Custom doctype. External: MemberMatters (Django, REST bridge) |
| Physical access control integration | makerspace | No Frappe app | REST bridge to Konnektive / Brivo / custom MQTT |
| Grant lifecycle management | nonprofit | `navari_gms` abandoned | Fork navari_gms and port to v16 |
| Online donation portal (tested) | nonprofit | `frappe_giving` untested | Test `frappe_giving` + Payments integration |
| Restaurant POS (confirmed v16) | restaurant | URY unverified | Test URY build; fallback to ERPNext built-in POS |
| MSP deployment tracking | cs-managed-services | No dedicated app | ERPNext Projects + CRM combination; evaluate IT-GLUE-style community apps |

---

## Verification Queue

Apps that need a test build to confirm v16 compatibility before being promoted
to `confirmed`. Priority order:

1. `frappe_giving` + `Aakvatech non_profit` integration — needed for nonprofit image
2. `ury-erp/ury` — needed for restaurant image
3. `The-Commit-Company/raven` — needed if internal chat is required
4. `klisia-org/frappe_giving` standalone build

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial catalogue from research session |
