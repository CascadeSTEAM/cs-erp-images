# AGENTS.md — Agent Guidelines for cs-erp-images

This repo builds versioned Frappe/ERPNext Docker images and authors deployment
tooling. It is **not** where live infrastructure is operated.

## Hard rule — Infrastructure & deployment go through an OpsKit subagent

**Any deployment, infrastructure change, maintenance, or addition MUST be performed
by a subagent operating in the OpsKit project (`~/Projects/opskit`) — never run
directly from this repo.** This includes, non-exhaustively:

- SSH / `pct` into live hosts (e.g. CT111 / cspve2), Proxmox, containers
- Frappe **bench** operations: site creation, `add-domain`, `set-config`, app installs
- **DNS** changes (Cloudflare, Technitium)
- **Caddy** / reverse-proxy edits and deploys
- Any **installation** of apps, packages, or services
- Secret retrieval (Bitwarden) and anything touching a live ERP instance

**Proactively offer this routing** whenever such work comes up — don't wait to be
asked. The OpsKit subagent enforces SSH aliases, helpdesk ticketing, Bitwarden secret
handling, IaC (Ansible), and client-data isolation. Keeping ops there also keeps
secrets and customer info out of *this* repo.

Why a subagent specifically: OpsKit is the mature ops solution (rebuilt from the
legacy `bms-ai-cluster`). The CS environment lives in OpsKit's gitignored
`environments/cs/`. Legacy `bms-ai-cluster` is reference-only.

### Harness note
The Claude Code **auto-mode classifier blocks model/subagent-initiated infra writes**
(DNS, bench config, external API writes). With **auto mode OFF**, the subagent's writes
go through normal permission rules instead. If a write is still blocked, hand the
operator the exact command to run themselves.

## What IS done directly in this repo (no OpsKit needed)

- Image use-case definitions (`use-cases/<name>/apps.json` + README)
- The customized `images/custom/Containerfile` and build scripts
- The DocWright plugin (`plugins/erp-images/`)
- Authoring/maintaining the `builder-site-deploy` skill in
  `.opencode/skills/builder-site-deploy/` (crawl → analyze → compose → componentize →
  publish a source site into a Frappe Builder instance). Composing/previewing is local;
  **publishing to a live instance runs via the OpsKit subagent.**

## Governance

This repo is under DocWright governance: `main` is PR-only, lifecycle hooks gate
writes, and infra changes reference a helpdesk ticket. See the DocWright docs.
