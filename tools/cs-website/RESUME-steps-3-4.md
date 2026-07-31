# RESUME: steps 3 + 4 — content doctype and migration (CS-0055)

**Status:** started 2026-07-31 16:51 PDT, **killed ~3.5 min in** at the owner's request rather
than left running unattended. Last reported action: *"Now applying Step 3 — schema."*
A read-only probe was run immediately after the stop — **see "State at stop" below before
doing anything.**

Everything needed to finish is committed in this directory. This file is the brief; hand it to
an OpsKit subagent.

---

## State at stop

> **FILL THIS IN from the probe result before resuming.** If the probe result was lost with the
> session, re-run the probe first — the checklist is in "Verify current state" below. Do not
> assume the site is clean: the agent may have created the doctype, part of it, or nothing.

| Object | Expected if step 3 completed | Actual at stop |
|---|---|---|
| DocType `Website Entry` | exists, full field list | _tbd_ |
| DocType `Website Entry Tag` | exists, istable | _tbd_ |
| `Website Entry` records | 31 | _tbd_ |
| `Event` custom fields | 6 | _tbd_ |
| `Event` property setters | Customize Form applied | _tbd_ |
| Role `Website Content Author` | exists + File/Tag perms | _tbd_ |
| Workspace "Website Content" | exists | _tbd_ |
| Migration `File` records | 20 | _tbd_ |
| `Website Route Redirect` | ~70 | _tbd_ |

---

## Verify current state (read-only, do this first)

Ask an OpsKit subagent to report: whether `Website Entry` and `Website Entry Tag` exist and
with which fields; the `Website Entry` record count by `entry_type`; which of the six `Event`
custom fields exist; any `Event` Property Setters; whether the `Website Content Author` role
and "Website Content" workspace exist; how many `File` records were created recently; the
`Website Route Redirect` count; any stale `.lock` files; and that the 13 Builder Pages, 11
Components and 50 Variables are unchanged with the site returning 200.

**Partial state is cheap to fix.** `route` is unique on `Website Entry`, so a re-run collides
loudly rather than duplicating silently. Finish whatever is missing rather than tearing down.

---

## The work

Definition file: `website-entry-doctype.json` (in this directory — authoritative, carries the
rationale). Migration script: `migrate_content.py`.

### Step 3 — schema
1. Child doctype `Website Entry Tag` (istable, one Link field to core `Tag`).
2. DocType **`Website Entry`** per the definition — field order, `depends_on` conditions,
   `unique` on `route`, `published` default 0, naming **hash** (NOT `field:route`, which would
   rename the record whenever a route changes and break every reference).
   *Module:* only the `frappe` and `builder` apps are installed, so a `Website` Module Def may
   not exist — create one or pick a suitable existing module, and record the choice.
3. `Event` Custom Fields: `publish_on_website`, `route`, `summary`, `banner`, `location`,
   `rsvp_url`.
4. Customize Form on `Event` to hide the calendar-operator clutter. **Check nothing depends on
   `event_type` before hiding it.**
5. Role **`Website Content Author`** — needs `File` create+write and `Tag` read+write on top of
   the two content doctypes, or image attachment and tagging silently fail. Must have **no**
   access to Builder Page / Component / Variable; test the permission rather than trusting config.
6. Workspace **"Website Content"**.

Not in scope: the route-collision guard (needs a Server Script). Just record whether
`server_script_enabled` is set in site_config.

### Step 4 — migration
Regenerate the data if it isn't to hand:
```bash
python3 -m venv .venv && ./.venv/bin/pip install markdown pyyaml
./.venv/bin/python migrate_content.py --src ~/Projects/cascadesteam.github.io \
    --out entries.json --assets assets.json --report
```
Last clean dry run: **31 entries** (Group 7, Project 13, Person 3, Page 8), **20 assets**,
**70 redirects**, zero route collisions, zero missing assets.

1. Upload the 20 assets as public Frappe Files; verify each sha256 against the local copy.
2. Insert the 31 `Website Entry` records. Direct field mapping, plus: **merge the `skills`
   array into `tags`** (they were tags in the source; splitting them was a migration artifact),
   create any missing core `Tag` records, and for `entry_type == "Person"` also set
   `role_title`, `email`, `linkedin`, `photo`. Ignore `_source_file`, `_legacy_routes`,
   `_aliases` as fields.
3. Create `Website Route Redirect` records for every `_legacy_routes` and `_aliases` value,
   pointing at the entry's `route`. Skip self-pointing and pre-existing ones.

---

## Non-negotiable while working this site

- **All live access goes through an OpsKit subagent** using `bin/frappe-exec.py`
  (`--site new.cascadesteam.org --container cs-erpnext-v2-backend-1 --ssh-alias cs-erpnext`).
  The `cs` `env.yml` has no `frappe:` block, so those flags are required.
- **CS-0061 is open: all background jobs fail** (RQ workers can't authenticate to MariaDB). So
  `queue_action` locks documents and never releases them, and caches never clear. For every
  save: clear any stale `.lock` first, then call `clear_website_cache()` and
  `frappe.clear_cache()` synchronously. Leave the locks dir empty.
- **Never modify existing Builder Pages, Components or Variables** in this step.
- The site is **not public** — visible breakage is acceptable and the owner prefers seeing
  changes land. Backups (`20260801_040523`) and 13 snapshots are the net.

---

## Then

Step 5 — the 7 Builder pages with `page_data_script`s and repeater bindings. Read the repeater
rules in `README.md` first; all six failure modes are silent.
