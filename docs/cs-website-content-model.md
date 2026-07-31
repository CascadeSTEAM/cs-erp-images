# Cascade STEAM Website — Content Model & Authoring

**Scope:** how content gets onto `new.cascadesteam.org` without a content creator ever
opening the Builder canvas. Companion to `cs-website-design-system.md` (the theming side).

**Tracking ticket:** CS-0055 — <https://support.cascadesteam.org/helpdesk/tickets/0055>

## The two-tier rule

| Tier | Who | Where they work | What they touch |
|------|-----|-----------------|-----------------|
| **Design** | Theme engineers | Frappe Builder (`/builder`) | Builder Variables (tokens), Builder Components, page templates, data scripts |
| **Content** | Content creators & managers | ERPNext Desk form | Title, body text, images, dates, tags — nothing else |

A content creator's whole job is: open a form, type text, attach an image, tick
**Published**. Placement, spacing, color, and layout are decided by the template and are not
reachable from the form. This is the explicit requirement — *"content folx only have to add
raw text and images that are automatically placed in the site properly."*

---

## 1. Verified Builder capability (frappe/builder @ develop)

The plan below depends on four Builder features. All four are confirmed present in source,
not assumed:

| Capability | Evidence |
|------------|----------|
| **Server-side data script** | `Builder Page.page_data_script` (fieldtype `Code`). `builder_page.py::_get_page_data` runs it via `execute_script(...)` and does `page_data.update(_locals["data"])` — i.e. **the script assigns a dict to a local named `data`**. |
| **Dynamic routes** | `Builder Page.dynamic_route` (Check). Resolved by `evaluate_dynamic_routes([ColonRule(f"/{d.route}", …)], path)` — so the param syntax is **colon-style** (`groups/:slug`), *not* `[slug]`. Route variables arrive in `frappe.form_dict`. |
| **Block ↔ data binding** | `builder/utils.py::Block` carries `dataKey = {"key", "property", "type", "comesFrom": "dataScript"}` plus `dynamicValues: list[BlockDataKey]` for binding several properties on one block. |
| **Repeaters + conditionals + component props** | `Block.isRepeaterBlock: bool`, `Block.visibilityCondition`, `Block.props: dict`. `get_block_data()` also gives each repeater item its own `block` / `props` locals. |

Consequence: **components can take props, listings can repeat over a query, and detail pages
can be one template serving N records.** That is the whole architecture — no per-record pages.

---

## 2. Information architecture (from the live sitemap)

The legacy site has 42 routes in four sections. Grouped by *shape* rather than by section:

| Shape | Count | Live routes |
|-------|-------|-------------|
| **Group** | 7 | `Groups/{Artificial-Intelligence, Citizen-Science, Cyber, Data-Engineering, Engineering, Open-Source, Spectrum}` |
| **Project** | 13 | `Projects/{AI-Workshops, Breach, Collaborative-Internship, Consulting, Digital-Navigators, Educational-Robotics, Hack-Night, Help-Desk, LinuxFest-Northwest, Mentorship, Reuse, Service-Corps, Stormwater-Monitoring}` |
| **Person** | 3 | `About/Leadership/{Garth-Johnson, Josh-Buker, Michael-Gan}` |
| **Page** | 8 | `About/{Asks, Code-of-Conduct, Donate, Organization, Outreach, Partners, Sponsorship, get-involved}` |
| **Events** | 1 index | `Events/` (aliases `/events`, `/calendar`) |
| **News** | — | Template exists (`assets/_templates/News.md`, `tags: [news]`) but no posts published yet |

20 of these 42 routes are **Group** or **Project** — same shape, same fields, 20 hand-built
pages today. Those collapse to *one* template + 20 form records.

**Built so far on `new.cascadesteam.org` (audited 2026-07-31):** 13 Builder pages — `home`,
all 7 Groups, `community-groups`, `community-projects`, `service-corps`,
`collaborative-internship`. Each is a **hand-built page**, which is exactly the duplication
this model removes. **Not built at all:** the 8 `About/*` pages, `Events`, the 3 Leadership
profiles, and 11 of the 13 Projects — so most of the site is still missing, and building the
remainder by hand is what the content model is meant to prevent.

---

## 3. Preserve the existing author contract

Creators already author via Obsidian frontmatter. The live templates define the contract —
so the Desk form should use **the same field names and the same mental model**, which is why
the learning curve is near zero.

From `assets/_templates/Page.md` / `News.md` / `Events/index.md`:

| Existing frontmatter | New form field | Note |
|----------------------|----------------|------|
| `title` | `title` | |
| `description` | `summary` | doubles as `meta_description` |
| `banner` | `banner` (Attach Image) | defaults to the horizontal logo, as today |
| `banner-display` | `banner_display` | `80%` / `auto` |
| `banner-fade` | `banner_fade` | e.g. `-10` |
| `banner-x` / `banner-y` | `banner_focus_x` / `banner_focus_y` | focal point % |
| `banner-height` | `banner_height` | px |
| `content-start` | `content_start` | px |
| `tags` | `tags` (Table MultiSelect → `Tag`) | native Frappe `Tag` doctype |
| `permalink` / `aliases` | `route` + `Website Route Redirect` | native redirect doctype covers aliases |
| `layout` | *dropped* | the template decides layout now — that's the point |

---

## 4. Doctypes — maximise built-ins

Ordered by preference: native doctype → Customize Form on a native doctype → custom doctype
built through the Desk UI (still no app code).

### 4.1 `Website Entry` — Groups, Projects, People, Pages, News  *(custom, Desk-built)*

**One form to learn.** A single `entry_type` Select drives which listing it joins and which
Builder template renders it. Conditional fields use native `depends_on` so a creator only
ever sees the handful of fields relevant to what they picked.

| Field | Type | Notes |
|-------|------|-------|
| `title` | Data | required |
| `entry_type` | Select | `Group` / `Project` / `Person` / `Page` / `News` |
| `route` | Data | auto-slugged from title, editable; unique |
| `summary` | Small Text | card blurb + meta description |
| `banner` | Attach Image | default = horizontal logo |
| `banner_display`, `banner_fade`, `banner_focus_x`, `banner_focus_y`, `banner_height`, `content_start` | Data / Int | §3; collapsed into a **"Banner options"** section, collapsed by default |
| `body` | Text Editor | the page copy |
| `tags` | Table MultiSelect → `Tag` | native |
| `published` | Check | replaces Quartz's `RemoveDrafts` |
| `featured` | Check | surfaces on the homepage "Happening Now" band |
| `sort_order` | Int | manual ordering within a listing |
| `published_on` | Date | `depends_on: entry_type=="News"` |
| `role_title`, `email`, `linkedin`, `photo` | Data / Attach Image | `depends_on: entry_type=="Person"` |
| `parent_entry` | Link → `Website Entry` | optional; lets a Project point at its Group |

### 4.2 Events — core `Event` + Custom Fields  *(recommended)*

Frappe core already ships an `Event` doctype (`subject`, `starts_on`, `ends_on`, `all_day`,
`description`, `event_category`, `event_type` Public/Private, `color`) **with a built-in
Calendar view**. Rather than a parallel custom doctype, extend it:

- **Custom Fields:** `publish_on_website` (Check), `banner` (Attach Image),
  `summary` (Small Text), `location` (Data), `rsvp_url` (Data), `route` (Data)
- **Customize Form** to hide the clutter content creators don't need (participants, repeat
  rules, reminder settings) and to reorder what's left — this is native ERPNext
  functionality, not code.
- Creators get the familiar month/week **Calendar view** for free.

#### Decision: ERPNext becomes canonical (owner, 2026-07-31)

Events move into ERPNext and are rendered by Builder. **The Google Calendar iframe is
retired.** Whoever manages events switches to the ERPNext Event form + Calendar view, and
every event can have its own templated page.

This is the higher-effort option, and it has consequences that must be handled rather than
discovered at go-live:

| Consequence | Handling |
|-------------|----------|
| **Existing calendar subscribers break.** The live page offers *"add our calendar to your calendar"* via a Google `cid` link. Retiring the embed silently kills those subscriptions. | Publish an **ICS feed** from ERPNext and replace the subscribe link with it. Frappe has no built-in public ICS endpoint — this is the one piece likely to need a small custom method. Confirm before committing, and keep the Google calendar alive read-only until the ICS feed is verified. |
| **Meetup still owns RSVPs.** | Keep it: the `rsvp_url` Custom Field links each event out to Meetup. No RSVP handling is built in ERPNext. |
| **Partner events** currently appear via the shared Google calendar. | They must now be entered as ERPNext Events, or the site loses them. Flag to whoever curates the calendar — this is a real added workload. |
| **Historical events** in the Google calendar. | Decide whether to migrate past events or start clean from cutover. Starting clean is cheaper and probably fine for a public site. |
| Google Calendar is the single point of failure today; ERPNext becomes it instead. | Covered by the existing nightly backup of the bench. |

Events get their own detail route and listing, so `Website Event` needs `route` + a Builder
dynamic page just like `Website Entry` (§5).

### 4.3 News — `Website Entry` now, native `Blog Post` available later

Native **Blog Post** (+ `Blogger`, `Blog Category`) is genuinely good: rich editor,
`published`/`published_on`, `blog_intro`, `meta_image`, auto routing, RSS, comments. But it
brings its *own* routing and templates, which fights the Builder-rendered look, and it is a
*second* form for creators to learn. Since no news posts exist yet, start News as an
`entry_type` on `Website Entry` and revisit if RSS/comments are actually wanted.

### 4.4 Rejected options

| Option | Why not |
|--------|---------|
| `Web Page` per route | No structured fields, no listings — just re-creates today's 42 hand-maintained pages. |
| `Wiki Page` (frappe/wiki) | **Not installed on this site** — `new.cascadesteam.org` has `installed_apps = ['frappe', 'builder']` only. It ships in the `cs` *image*, so installing it is possible, but it brings its own sidebar/theme and can't feed card listings. Reconsider only if the org wants a genuinely wiki-shaped knowledge area — and note it would be an app install (OpsKit subagent). |
| One custom doctype per shape (Group, Project, Person…) | 5 forms to learn instead of 1, 5× the schema to maintain, for identical fields. |

---

## 5. Rendering — 7 Builder pages serve all 42 routes

Each listing is one page with a repeater; each detail view is one dynamic-route page.

| Builder page | Route | `dynamic_route` | Renders |
|--------------|-------|-----------------|---------|
| Home | `home` | no | Hero, mission, featured entries, community links (set as `Website Settings.home_page`) |
| Groups index | `groups` | no | `cs/card-grid` repeating `cs/event-card` over all `Group` entries |
| Projects index | `projects` | no | same, over `Project` entries, split by the source's Community Building / Community Service grouping |
| Entry detail | `:slug` | **yes** | Serves every Group, Project, Person and Page from one template |
| Events index | `events` | no | Repeater over published `Event` records, upcoming first, as `cs/event-card`s. Google Calendar embed retired (§4.2); add the ICS subscribe link here |
| Event detail | `events/:slug` | **yes** | One template for every event page |
| News index | `news` | no | Repeater over `News` entries, newest first |

### Data script shape
`page_data_script` runs server-side and must assign a dict to a local named **`data`**:

```python
# Groups index — page_data_script
data = {
    "entries": frappe.get_all(
        "Website Entry",
        filters={"entry_type": "Group", "published": 1},
        fields=["title", "route", "summary", "banner"],
        order_by="sort_order asc, title asc",
    )
}
```

**Route scheme — flat and lowercase.** The live public URLs are flat
(`cascadesteam.org/artificial-intelligence`), and the 13 existing Builder pages already use
flat routes. Keep that: it preserves every inbound link and SEO signal. So entry detail is a
single catch-all `:slug` page — Frappe's path resolver matches static/published routes first
and only falls through to dynamic routes, so `home`, `groups`, `events` etc. still win.
The nested legacy paths (`Groups/Artificial-Intelligence`) become redirects (§7).

*If* a flat catch-all proves too greedy in practice (it becomes the de-facto 404 handler),
the fallback is section-prefixed detail pages — `groups/:slug`, `projects/:slug`,
`about/:slug` — plus redirects from the flat routes. That trades URL stability for
predictability; only take it if the catch-all misbehaves.

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

Binding: the repeater container gets `isRepeaterBlock: true` with
`dataKey = {"key": "entries", "property": "innerHTML", "type": "key", "comesFrom": "dataScript"}`;
child blocks bind their `innerHTML` / `src` / `href` to item fields via `dataKey` or
`dynamicValues`. Optional elements (a missing banner, an absent RSVP link) use
`visibilityCondition` rather than a second template.

---

## 6. Guardrails that keep creators safe

All native Frappe features — no code:

- **Role `Website Content Author`** with read/write on `Website Entry` + `Event` only, and
  **no** access to `Builder Page`, `Builder Component`, or `Builder Variable`. This is the
  hard boundary that makes the two-tier split real rather than a convention.
- **Workspace "Website Content"** — a Desk landing page with just the shortcuts they need,
  so they never navigate the wider ERPNext menu.
- **`published` as the gate** — nothing is public until ticked. Add a **Workflow** if
  manager review before publish is wanted.
- **Naming/route uniqueness** enforced on the doctype, so a creator cannot collide routes.
- **Website Route Redirect** for every legacy alias, so existing inbound links survive the
  Quartz → Builder cutover.

---

## 7. Migration

20 Groups/Projects + 3 People + 8 Pages already exist as markdown with frontmatter in
`~/Projects/cascadesteam.github.io`. Migration is a one-off script: parse frontmatter + body,
map per §3, convert markdown body → HTML, insert `Website Entry` records, upload banner
images as Frappe Files. Run it via an **OpsKit subagent** (it writes to the live site).

Legacy routes are title-cased and nested (`Groups/Artificial-Intelligence`) while the live
site also answers flat lowercase (`/artificial-intelligence`). Capture **both** as redirects
so nothing 404s.

---

## 8. Build order

0. **Snapshot + site backup** — the token reset deletes all 8 existing `Builder Variable`
   records and the 13 pages get rebuilt. Take a `Builder Snapshot` and a site backup first.
1. Tokens → `Builder Variable`, full clean mint (design system §2, §5, §7 decision) — read
   back every minted UUID before referencing it. Delete the old 8 only after the new set reads
   back correctly.
2. Components → `Builder Component` (design system §4). Rebuild `cs_header` / `cs_footer` on
   the new tokens first, then the 12 missing components.
3. `Website Entry` doctype + `Event` Custom Fields & Customize Form + `Website Content Author`
   role + Workspace.
4. Migration script → populate real content from `~/Projects/cascadesteam.github.io`.
5. The 7 Builder pages + `page_data_script`s + repeater bindings; rebuild the 13 existing
   pages as template instances rather than hand-built one-offs.
6. `is_template=1` page template in `template_group: cascadesteam` — retest whether
   `developer_mode` is actually required (design system §7 suggests it may not be).
7. ICS feed for events (§4.2) + `Website Route Redirect` for every legacy alias, then go-live:
   bind `cascadesteam.org` + `www`, DNS cutover, retire Quartz and the Google Calendar embed.

Steps 0 and 3–7 touch the live instance → **OpsKit subagent**. Steps 1–2 and 5 are composed
and previewed locally in this repo first.
