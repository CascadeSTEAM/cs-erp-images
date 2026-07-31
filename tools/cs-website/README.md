# Cascade STEAM website tooling — CS-0055

Local composition tooling for the `new.cascadesteam.org` theming overhaul and templated
content model. **Nothing here touches a live site** — these scripts emit data, and an
OpsKit subagent applies it (see the repo `AGENTS.md` hard rule).

Design docs: `docs/cs-website-design-system.md` · `docs/cs-website-content-model.md`
Tracking ticket: **CS-0055** — <https://support.cascadesteam.org/helpdesk/tickets/0055>

---

## Where the project actually stands (2026-07-31)

| Step | State |
|------|-------|
| 0 · Backup + snapshots | **Done.** Backup set `20260801_040523` (on-box + off-box on cspve2), 13 manual Builder Snapshots `SNAP-0005`–`SNAP-0017`, JSON state export attached to CS-0055. |
| 1 · Design tokens | **Done.** 50 `Builder Variable` records live (17 Color + 33 Dimension). 4 renamed in place, 8+4 minted. |
| 2 · Component library | **Done.** 11 components published. `cs_header` / `cs_footer` restyled in place; the other 9 are new. |
| 3 · `Website Entry` doctype | **Not started.** Definition ready in `website-entry-doctype.json`. |
| 4 · Content migration | **Script done, not run.** Dry run: 31 entries, 20 assets, 70 redirects, zero collisions. |
| 5 · Builder pages + data scripts | **Not started.** |
| 6 · Page template | **Not started.** |
| 7 · ICS feed, redirects, go-live | **Not started.** |

**Open defects found along the way** (all filed, all High unless noted):
- **CS-0061** — all background jobs on the site fail; RQ workers can't authenticate to
  MariaDB. This is why `queue_action` leaves permanent doc locks and why page caches must be
  cleared synchronously by hand after every component save.
- **CS-0062** — Builder emits malformed `font-family` CSS (unmatched quote), so **no brand
  font renders anywhere**; every page falls back to the browser default.
- **CS-0059** (Medium) — webfonts load from the Google CDN; should be self-hosted. Blocked
  behind CS-0062 for any visible benefit.
- **CS-0063** (Medium) — splash/hero treatment featuring the logo, assigned to Brittin Kellar.
  Note they are **not** an `HD Agent`, so they may not see it in the `/helpdesk` portal.

---

## Scripts

All need a venv with `markdown` + `pyyaml`:
```bash
python3 -m venv .venv && ./.venv/bin/pip install markdown pyyaml
```

### `cs_components.py` — component library composer
Builds `Builder Component` payloads from the live token map. Fully token-driven; emits zero
hardcoded colours (every value is `var(--uuid, <literal>)`, the literal being the fallback).
```bash
./cs_components.py --tokens cs-tokens-applied.json --out-dir components/ --preview preview.html
```
`cs-tokens-applied.json` is **not in this repo** — it holds live system state and is attached
to CS-0055. Regenerate it by reading the `Builder Variable` table back from the site.

### `migrate_content.py` — legacy content migration
Reads the Quartz vault at `~/Projects/cascadesteam.github.io`, emits `Website Entry` records
plus an asset manifest.
```bash
./migrate_content.py --src ~/Projects/cascadesteam.github.io \
    --out entries.json --assets assets.json --report
```
Handles the Obsidian-isms Frappe knows nothing about: `![[embeds]]`, `[[wikilinks]]` resolved
against a route index built in a first pass, `|image-right` portraits lifted out for
`cs/profile-card`, and HTML-commented draft content stripped. Exits non-zero on route
collisions or missing assets.

### `build_review.py` — review page
Generates a review artifact from the *actual* composer output, so the page shows what will
publish rather than a hand-written approximation.

### `website-entry-doctype.json` — step 3 definition
`Website Entry` + its tag child table, the `Event` Custom Fields and Customize Form list, the
`Website Content Author` role, and the workspace. Ready for an OpsKit subagent to apply.

### `cs-tokens.json` — token manifest
The design intent: what to rename, what to keep, what to mint, and what cannot be a token at
all. `cs-tokens-applied.json` is the *result* of applying it.

---

## Traps that will bite you (all learned the hard way)

**Never replace an in-use component's `block` with a freshly-composed tree.** Pages do not
embed component content — each carries a mirror of *empty override shells* keyed by
`referenceBlockId`, and `extend_block()` builds the rendered children from those shells,
matching on `blockId`. A component authored with fresh ids matches nothing, so every interior
node collapses to `element=None`. `BuilderComponent.on_update` does **not** call
`sync_component()`, so nothing repairs it. Either preserve the original blockIds and restyle
in place, or run `ComponentSyncer` across every page that uses the component.

**A composed component is a structural skeleton.** It carries no content, so swapping one in
also drops nav links, addresses, and everything else the live tree holds.

**Repeater rules** (`builder_page.py`), each of which fails silently:
- needs `isRepeaterBlock` **and** `children` **and** `dataKey`, or it renders as a normal block
- only `children[0]` is repeated — any sibling is silently ignored
- the loop iterates `dataKey.key`; setting `property` on the container binds the container itself
- `src`/`href` need `type: "attribute"`, not `type: "key"`
- the same binding in both `dataKey` and `dynamicValues` leaks the raw Jinja expression
- `visibilityCondition` is **not** evaluated on a repeater's immediate child

**`Builder Variable.type` accepts only `Color` and `Dimension`.** Font families, weights,
unitless line-heights, shadows and easing cannot be tokens — they ship as component props plus
one injected `head_html` stylesheet. `dark_value` lives on the same record; when it differs
Builder emits `light-dark()`.

**`Builder Component` is `autoname: field:component_id`** and Frappe force-syncs that field to
`name`, so the two cannot diverge — and must not, since pages reference by `name` while
`clear_page_cache()` matches on `component_id`.

**Page caches will not clear themselves** while CS-0061 is open. After any component save:
clear the stale `.lock`, then call `clear_page_cache()`, `clear_website_cache()` and
`frappe.clear_cache()` synchronously.

---

## Resuming

Read the two design docs first, then this file's status table. `cs-tokens-applied.json` and
the Builder state export both live on CS-0055 as attachments. The site is **not public** —
real traffic is still on the Quartz site at the apex and `www`, so visible breakage on
`new.` is acceptable and the owner prefers seeing changes land live.
