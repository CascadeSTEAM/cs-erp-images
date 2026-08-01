
---

## Session: 2026-07-24 — Builder site + CS infra

**Focus:** Builder site + CS infra

**Completed:**
- [x] docs: add website backup & export guide
- [x] docs: add website backup & export guide
- [x] docs: add AGENTS.md + CLAUDE.md — route infra/deploy through OpsKit subagents
- [x] docs: add AGENTS.md + CLAUDE.md — route infra/deploy through OpsKit subagents
- [x] feat: per-image branch overrides, cs image refresh
- [x] Merge pull request #4 from CascadeSTEAM/feat/grouchys-use-case
- [x] docs: fix stale local-build note — Containerfile is vendored, not fetched
- [x] feat: add grouchys use case

**Session note:** `docs/session-notes/session_note_202607241334.md`

---

## Session: 2026-07-31 — CS website theming (CS-0055)

**Focus:** Theming overhaul + templated content model for `new.cascadesteam.org`

**Completed:**
- [x] docs: CS website design system + content model (#9)
- [x] feat: CS website composition tooling + resume state (#10, open)
- [x] Step 0 — backups, 13 Builder Snapshots, state export attached to CS-0055
- [x] Step 1/1b — 50 Builder Variables live (17 Color, 33 Dimension)
- [x] Step 2 — 11 components published; header/footer restyled in place
- [x] Filed CS-0059, CS-0061, CS-0062, CS-0063

**In flight at session end:** steps 3+4 (Website Entry doctype + content migration) — result not seen.

**Session note:** `docs/session-notes/session_note_202607311650.md`

---

## Session: 2026-07-31 — Helpdesk data + credential cleanup

**Focus:** Helpdesk data + credential cleanup

**Completed:**
- [x] feat: CS website composition tooling + resume state (CS-0055)
- [x] docs: commit builder-site-deploy skill proposal
- [x] docs: CS website design system + content model (CS-0055)
- [x] docs: fix review findings; resolve accent + dark-mode scope (CS-0055)
- [x] docs: re-anchor layout on the current site, revise token strategy (CS-0055)
- [x] docs: CS website design system + content model (CS-0055)
- [x] fix: patch wiki User.after_insert hook — stale-doc save broke all user creation

**Session note:** `docs/session-notes/session_note_202607311655.md`

---

## Session: 2026-07-31 (evening) — CS-0055 steps 3–5

**Focus:** Resume CS-0055 — schema, content migration, Builder pages

**Completed:**
- [x] Step 3 — `Website Entry` + `Website Entry Tag`, role, workspace, 5 Event custom fields, 20 property setters
- [x] Step 4 — 31 entries, 27 assets, 39 redirects (+31 self-pointers = 70); all verified by read-back
- [x] Permission boundary tested empirically — role has zero Builder DocPerms
- [x] Repaired 31 stale entry bodies: 56 un-rewritten internal refs → 0
- [x] Fixed 3 `migrate_content.py` defects + 1 self-inflicted double-rewrite bug
- [x] Step 5 planned — `tools/cs-website/STEP-5-pages.md`; inventory is 9 pages, not 7
- [x] Documented the IST timestamp trap and marked `RESUME-steps-3-4.md` superseded

**Discovered:** steps 3+4 had already been applied by an **unrecorded run** three minutes after
the previous session's "site was clean" probe was committed. Hidden by the site storing IST.

**In flight at session end:** step 5 (9 Builder pages + data scripts + repeater bindings) —
agent still running, result not seen. **Probe before trusting anything.**

**Session note:** `docs/session-notes/session_note_202607312127.md`

---

## Session: 2026-07-31 (late evening) — CS-0061 worker DB auth fix

**Focus:** CS-0061 — RQ workers cannot authenticate to MariaDB

**Completed:**
- [x] Validated CS-0061 as real and active — reproduced 1045 from all three worker/scheduler containers
- [x] Root-caused: MariaDB grant pinned to `172.18.0.8` only; `setup_db` derives grant host from `SELECT USER()` at `bench new-site`
- [x] Ruled out password, site config, Redis, volumes, DNS, missing DB, paused scheduler — each with direct evidence
- [x] Fixed 2026-08-01 04:00:46 UTC — added `'%'` grant, hash copied server-side; no restart, no config change
- [x] Verified — control job `finished`, 4 clean scheduler ticks, `last_execution` 39/39 non-NULL, 0 new 1045s
- [x] Discarded 17 stale failed jobs; verified support's 14 unrelated failures intact
- [x] CS-0061 resolved with full root-cause comment; `status_category`/`resolution_date` verified consistent
- [x] Filed CS-0065 — audit IP-pinned grants across all OpsKit-managed environments
- [x] Commented CS-0055; retired the stale-lock/synchronous-cache-clear workaround from repo docs

**Discovered:** the site had been broken **since creation (2026-07-22)** — 39/39 Scheduled Job
Types had never executed once and `Scheduled Job Log` was empty. Not a regression. Also: the
IP-pinned grant meant a container *recreate* would have broken the **web** path too, so the
site was one `docker compose up -d` away from a full outage, not just dead background jobs.

**Corrections to the ticket:** "outbound email is dead" was misattributed — the site has 0 Email
Accounts, so this fix does not restore mail. The stale-lock backlog was already gone.

**Concurrency:** a second session was active on this branch; its commit `a6768aa` swept up this
session's doc edits under an unrelated message. Changes are committed and pushed.

**Still open:** blank `System Settings.time_zone` on `new.cascadesteam.org` (IST vs UTC trap —
set before any `Event` data); 0 Email Accounts on that site; `MYSQL_ROOT_PASSWORD` plaintext in
`/root/cs-erpnext-v2-compose.yml` (OpsKit backlog).

**Session note:** `docs/session-notes/session_note_202607312137.md`
