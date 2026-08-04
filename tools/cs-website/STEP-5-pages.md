# STEP 5 — Builder pages, data scripts, repeater bindings (CS-0055)

Prepared 2026-07-31, after steps 3 + 4 landed. Composed locally; **an OpsKit subagent applies
it.** Read `README.md` "Traps that will bite you" first — every repeater failure mode is silent.

Prerequisite: `docs/cs-website-content-model.md` §5 is the design. This file records where the
source material contradicts it, and what to build instead.

---

## 1. The page inventory is 9, not 7

§5 lists 7 pages. Walking every public `index.md` in `~/Projects/cascadesteam.github.io`
against the migrated entries turns up **two the design missed**, both of which are live linked
URLs today.

| # | Page | Route | `dynamic_route` | Renders | In §5? |
|---|------|-------|-----------------|---------|--------|
| 1 | Home | `home` | no | Hero, mission, the two programme lists, community links | yes |
| 2 | Groups index | **`community-groups`** | no | `cs_card_grid` over `Group` entries | yes, but §5 says `groups` — see below |
| 3 | Projects index | **`community-projects`** | no | `cs_card_grid` over `Project` entries — **flat, see §3** | yes, but §5 says `projects` |
| 4 | **About** | `about` | no | `About/index.md` body; static prose | **NO — missed** |
| 5 | **Leadership** | `leadership` | no | `cs_card_grid` over `Person` entries | **NO — missed** |
| 6 | Entry detail | `:slug` | **yes** | Every Group, Project, Person, Page from one template | yes |
| 7 | Events index | `events` | no | Repeater over published `Event`s, upcoming first | yes |
| 8 | Event detail | `events/:slug` | **yes** | One template per event | yes |
| 9 | News index | `news` | no | Repeater over `News` entries | yes |

**Leadership matters most.** The 3 `Person` entries currently have **no listing page**, and
`/leadership` is linked from `About/Code-of-Conduct.md` — a governance document. Without it
that link 404s after cutover.

**Pages 7, 8 and 9 render empty.** Zero `Event` records exist and no News posts were ever
published (`assets/_templates/News.md` is a template, not a post). Build them for structure,
but do not treat an empty grid as a bug — and do not create `Event` data until the timezone
question is settled (see `README.md`).

---

### The two index routes are `community-*`, not `groups` / `projects`

§5 of the content model says `groups` and `projects`. **`migrate_content.py`'s `SECTION_ROUTES`
already decided otherwise** — it maps `groups → community-groups` and
`projects → community-projects`, and the 31 entry bodies now live on the site contain those
hrefs. Those are also the real legacy public URLs.

**Build the pages at `community-groups` and `community-projects`.** They win on all three
counts: legacy URL preserved, migrated bodies already point there, no re-run needed. Add
`groups` and `projects` as redirects so the design doc's names still work. This is the
opposite of what an earlier draft of this brief said.

---

## 2. Live internal links needing redirects

Every absolute `cascadesteam.org/...` link across the source vault, checked against the 31
entry routes plus all 70 redirects — **32 links, 5 uncovered**:

| Link | Fix |
|---|---|
| `community-groups` | **Served by page 2** — it is the page's own route. |
| `community-projects` | **Served by page 3.** |
| `leadership` | **Served by page 5.** |
| `groups` / `projects` | Redirects → `/community-groups` / `/community-projects`, so the content-model names resolve too. |
| `about/leadership` | Redirect → `/leadership`. |
| `calendar` | Redirect → `/events`. `Events/index.md` declares `aliases: [/events, /calendar, calendar]` with `permalink: events`. |
| `stormwater-monitoring` | Redirect → `/stormwater`. **Pre-existing legacy bug** — `Projects/Stormwater-Monitoring.md` declares only `aliases: [/stormwater]`, so the home page's link to `/stormwater-monitoring` is very likely already dead on the live site. Cheap to fix in passing. |

These are `Website Route Redirect` records, not code — five to add alongside the existing 39.

**Post-fix state of the migrated bodies:** every internal href across all 31 entries now
resolves to an entry route, an existing redirect, or one of the nine pages above. Verified by
sweeping the regenerated `entries.json` — 17 distinct internal hrefs, **zero dead.**

---

## 3. The Projects index is flat — §5 is wrong here

§5 says the Projects index is "split by the source's Community Building / Community Service
grouping." That grouping is real (7 Building + 6 Service = the 13 `Project` entries exactly),
but it lives in **`index.md`, the home page** — as prose bullet lists. The actual
`Projects/index.md` is a **flat alphabetical list with no split at all.**

No `Website Entry` field carries the grouping; `sort_order` is `0` on all 13 and the tags don't
encode it.

**Build the Projects index flat**, matching the real source page. Keep the Building/Service
split as home-page content. Only if the split is wanted on the index later is a
`category` Select (`Community Building` / `Community Service`) on `Website Entry` justified —
that is a schema change, so it is a decision, not a gap-fill.

---

## 4. Data scripts

`page_data_script` runs server-side and must assign a dict to a local named **`data`**.

**Bind hrefs with a leading slash.** Entry routes are stored bare (`artificial-intelligence`).
`cs_entry_card` binds `item.route` straight into `href` via `bind_attr`, so a bare value is a
*relative* link — correct from `/groups`, wrong from any path with a trailing segment. Prefix
in the data script rather than editing the published component.

```python
# Groups index — page_data_script
entries = frappe.get_all(
    "Website Entry",
    filters={"entry_type": "Group", "published": 1},
    fields=["title", "route", "summary", "banner"],
    order_by="sort_order asc, title asc",
)
for e in entries:
    e["route"] = "/" + e["route"].lstrip("/")   # absolute; see note above
data = {"entries": entries}
```

Projects index and Leadership are the same with `entry_type` `"Project"` / `"Person"`.

```python
# Entry detail — dynamic route ":slug"
slug = frappe.form_dict.get("slug")
entry = frappe.get_all(
    "Website Entry",
    filters={"route": slug, "published": 1},
    fields=["*"],
    limit=1,
)
if not entry:
    frappe.throw("Not found", frappe.DoesNotExistError)
data = {"entry": entry[0], "page_title": entry[0].title}
```

---

## 5. Binding rules (all six fail silently)

- Repeater container needs `isRepeaterBlock` **and** `children` **and** `dataKey`; use
  `repeater_over()` in `cs_components.py`, which enforces this.
- `dataKey = {"key": "entries", "comesFrom": "dataScript"}` — **`key` is the iterator**; never
  set `property` on the container.
- **Exactly one child.** Any sibling is silently dropped.
- Text binds `type: "key"`; `src` / `href` bind `type: "attribute"`.
- Never put the same binding in both `dataKey` and `dynamicValues` — leaks raw Jinja.
- `visibilityCondition` is **not** evaluated on a repeater's immediate child. Put it on
  elements nested inside the card, never on the card root.

---

## 6. Verify the page-block shape before composing nine pages

**Do not guess this.** Pages do not embed component content — they carry empty override shells
keyed by `referenceBlockId`, and `extend_block()` builds children by matching `blockId`. The
correct shape for a *newly created* page block that extends a published component
(`extendedFromComponent`, and whether `children` must be `[]` or pre-seeded shells) must be read
off `builder_page.py` / `extend_block()` in the live container **first**. Composing nine pages
against a guess and finding every interior node collapsed to `element=None` is the expensive
failure here, and it is silent.

---

## 7. Ordering — do not retire the legacy pages yet

Nine entry routes are shadowed by the legacy hand-built Builder Pages (all 7 Groups plus
`collaborative-internship` and `service-corps`). Static routes win over dynamic ones, so those
entries stay inert until `:slug` exists. Sequence: build `:slug` → verify each of the nine
renders from its `Website Entry` → **then** retire the old page, one at a time. Retiring first
404s nine live URLs.

§8 of the content model also asks that the 13 existing pages be re-expressed as template
instances **preserving their current layout, which is the reference design.** Capture a
`Builder Snapshot` before touching any of them.
