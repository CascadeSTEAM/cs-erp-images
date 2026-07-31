---
title: "Builder Site Deploy Skill — Scrape, Build, Deploy"
author: NetYeti
created: 2026-07-22
tags:
  - builder
  - deploy
  - scrape
  - website
  - skill
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

We need a reusable workflow to take an existing website, recreate it as a Frappe Builder site, and deploy it to an existing CS ERP instance. This was done ad-hoc for Grouchy's Diner (scraped a live site, created a theme in Builder, deployed via Builder), but there's no codified skill or tooling for this process.

Each time we want to deploy a new website on the CS ERP system, we'd have to:
1. Manually scrape the source site
2. Manually recreate the content in Builder
3. Manually configure DNS (Cloudflare) and reverse proxy (Caddy)
4. Manually verify the deployment

This is error-prone and not repeatable.

## Proposed Solution

Create a reusable skill `builder-site-deploy` in `cs-erp-images/.opencode/skills/` that automates the end-to-end workflow:

### Skill Components

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition with triggers, workflow, and documentation |
| `scrape.sh` | Scrape URL, save HTML + assets locally as structured JSON |
| `create-pages.py` | Create Builder pages via Frappe REST API |
| `deploy-dns.sh` | Add Cloudflare DNS record + Caddy vhost route |

### Workflow

```
Input: SOURCE_URL + TARGET_SUBDOMAIN + TARGET_DOMAIN
  │
  ├─ 1. SCRAPE ── scrape.sh <url> <output-dir>
  │     wget/curl to save HTML + assets, extract structure
  │
  ├─ 2. ANALYZE ── AI reads scraped content
  │     Map to Builder blocks (Container, Text, Image, etc.)
  │
  ├─ 3. BUILD ── create-pages.py --erp <site> --scrape-dir <dir>
  │     Authenticate to Frappe, create Builder Page doctypes
  │
  ├─ 4. DEPLOY ── deploy-dns.sh --subdomain <sub> --domain <dom>
  │     Cloudflare DNS + Caddy vhost configuration
  │
  └─ 5. VERIFY ── HTTP probe, SSL check
```

### First Use Case

Deploy `cascadesteam.org` → `new.cascadesteam.org` on the existing CS ERP instance (`support.cascadesteam.org`).

## Alternatives Considered

1. **Manual workflow only** — Rejected because it's not repeatable and we'll need this for multiple sites.

2. **Ansible playbook instead of skill** — Considered, but a skill is more appropriate because:
   - The workflow involves AI analysis (mapping scraped content to Builder blocks)
   - Skills are invoked on-demand per task
   - Playbooks are better for infrastructure state changes

3. **Builder Hub templates only** — Rejected because we're starting from existing live sites, not using pre-built templates.

## Future

- Extend to support multiple pages (not just single-page scrapes)
- Add theme creation (color schemes, typography)
- Support for Builder components and data scripts
- Integration with Builder Hub for template import
- Automated screenshot comparison (source vs. deployed)

## Security Implications

- Frappe admin password and Cloudflare API token stored in Bitwarden
- Scripts use `bw` CLI to retrieve secrets at runtime
- No secrets committed to repository
- Caddy configuration validated before deployment
- DNS changes are idempotent (safe to re-run)
