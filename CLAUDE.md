# CLAUDE.md

See **`AGENTS.md`** — it is the source of truth for working in this repo, kept
vendor-neutral so Claude Code, OpenCode, and humans share one document. This file
exists only because Claude Code looks for `CLAUDE.md` specifically; its content is not
duplicated here so the two cannot drift.

**Most important rule:** any deployment, infrastructure change, maintenance, or
addition (SSH to live hosts, Frappe bench/site config, DNS, Caddy, installs, secrets,
live-ERP access) is performed by a **subagent in the OpsKit project**
(`~/Projects/opskit`) — never directly from this repo — and is **offered proactively**
whenever such work comes up. Full policy and rationale: `AGENTS.md`.
