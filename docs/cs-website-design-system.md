# Cascade STEAM Website — Design System

**Scope:** the Frappe Builder site `new.cascadesteam.org` (staging hostname destined to
become `cascadesteam.org` + `www.cascadesteam.org`). See `cs-website-content-model.md` for
the authoring/content side.

**Tracking ticket:** CS-0055 — <https://support.cascadesteam.org/helpdesk/tickets/0055>

**Source of truth for this spec:** the *existing live site's* own style guide, extracted
from `~/Projects/cascadesteam.github.io`:

| What | Where it came from |
|------|--------------------|
| Colors, fonts | `.github/quartz/quartz.config.ts` → `theme.typography` + `theme.colors` |
| Component styling + interaction vocabulary | `.github/quartz/custom.scss` (669 lines) |
| Brand hexes | `assets/fragments/site_logo.svg` / `assets/images/Cascade_STEAM_horizontal_logo_primary.svg` |
| Content-author contract | `assets/_templates/{Page,News}.md`, `Events/index.md` frontmatter |
| Reusable fragments already in use | `assets/fragments/global-{header,footer}.md` |

Directive: **keep the CS brand, rebuild the system.** Nothing here invents a palette —
every value below is lifted from the source. Values marked *(inferred)* are not stated in
the source and are proposed defaults.

---

## 1. Brand marks

The logo SVG contains exactly three colors — this is the brand triad:

| Token | Hex | Role |
|-------|-----|------|
| `brand/navy` | `#0a2c3f` | Deepest brand navy (logo wordmark) |
| `brand/cyan` | `#34b0bf` | Brand cyan (logo mark; primary in dark mode) |
| `brand/orange` | `#d46329` | Brand orange — the accent that carries every hover/rule/CTA |

Logo assets available in `assets/images/` (horizontal + vertical × primary / solid-dark /
solid-white / primary-darkBG, SVG + PNG). Use:
- **horizontal_logo_primary.svg** — light-mode header + hero
- **horizontal_logo_primary_darkBG.svg** — dark-mode header
- **vertical_logo_primary.svg** — square/social contexts

---

## 2. Color tokens

Quartz's semantic names are misleading (`lightgray` is actually the orange used for rules).
The mapping below renames them to what they *do*, preserving the exact values.

### Light mode
| Token | Hex | Quartz origin | Used for |
|-------|-----|---------------|----------|
| `light/bg` | `#faf8f8` | `light` | Page background |
| `light/surface` | `#ffffff` *(inferred)* | — | Cards raised off `bg` |
| `light/text` | `#4e4e4e` | `darkgray` | Body copy |
| `light/primary` | `#284b63` | `dark` / `secondary` | Headings, nav items, internal links |
| `light/accent` | `#d46329` | `tertiary` / `lightgray` | Hovers, rules, CTAs, active states |
| `light/muted` | `#b8b8b8` | `gray` | Breadcrumbs, eyebrows, meta text |
| `light/highlight` | `rgba(143,159,169,0.15)` | `highlight` | Nav-item hover background |
| `light/mark` | `#fff23688` | `textHighlight` | `==highlighted text==` |

### Dark mode
| Token | Hex | Quartz origin | Used for |
|-------|-----|---------------|----------|
| `dark/bg` | `#050505` | `light` | Page background |
| `dark/text` | `#d4d4d4` | `darkgray` | Body copy |
| `dark/primary` | `#34b0bf` | `dark` / `secondary` | Headings, nav items, internal links |
| `dark/accent` | `#d46329` | `tertiary` | Unchanged across modes — the constant |
| `dark/muted` | `#646464` | `gray` | Meta text |
| `dark/highlight` | `#34b1bf33` | `highlight` | Nav-item hover background |
| `dark/mark` | `rgba(0,171,197,0.43)` | `textHighlight` | Highlighted text |

**The one rule that defines the site's feel:** `accent` (orange) never changes between
modes; `primary` shifts navy → cyan. Every interactive element resolves to orange on hover.

---

## 3. Typography

Fonts are Google Fonts (`fontOrigin: "googleFonts"`, `cdnCaching: true`):

| Token | Family | Role |
|-------|--------|------|
| `font/heading` | **Rubik** | All headings, nav items, buttons |
| `font/body` | **Source Sans Pro** | Body copy |
| `font/mono` | **IBM Plex Mono** | Code, timestamps |

### Scale
Sizes below are taken from `custom.scss` where stated; the h1–h3 steps are *(inferred)*
because they live in Quartz's un-overridden `base.scss`.

| Token | Size | Weight | Notes |
|-------|------|--------|-------|
| `type/h1` | `2.25rem` *(inferred)* | 600 | line-height 1.2 |
| `type/h2` | `1.5rem` *(inferred)* | 600 | + orange underline, see §4.3 |
| `type/h3` | `1.25rem` *(inferred)* | 600 | |
| `type/body` | `1rem` | 400 | line-height **1.6** (stated) |
| `type/small` | `0.95rem` | 400 | footer copy, CTA labels (stated) |
| `type/meta` | `0.85rem` | 400/500 | breadcrumbs, dropdown items, tags (stated) |
| `type/nav` | `0.9rem` | 600 | top-level nav items (stated) |
| `type/submenu` | `0.875rem` | 500 | dropdown links (stated) |
| `type/eyebrow` | `0.65rem` | 700 | uppercase, `letter-spacing: 0.12em`, muted (stated) |
| `type/timestamp` | `0.75rem` | 400 | mono, italic, muted (stated) |

---

## 4. Component inventory

`custom.scss` is effectively an undocumented component library. Each subsection below is
one **Builder Component** to build. Values are verbatim from the source unless marked.

### 4.1 Site header / top nav — `cs/header`
The most opinionated piece in the source (≈300 lines of `custom.scss`).

- Fixed full-width bar, **height `52px`**, `background: bg`, `border-bottom: 1px solid accent`
- **Logo** anchored left: fixed, width `170px`, padding `0 1.25rem`, image height `30px`
- **Search/controls** anchored right: fixed, width `260px`, padding `0 1.25rem`, gap `0.5rem`
- Nav items inset between them (left padding `200px`, right padding `260px`)
- Item: `font/heading`, `type/nav`, color `primary`, padding `0 1rem`, full bar height
  - hover → color `accent`, `text-shadow: 0 2px 8px rgba(0,0,0,0.2)`, `translateY(-1px)`
- **Dropdown (depth 1):** absolute at `top: 52px`, `min-width: 200px`, `bg`,
  `1px solid accent` (no top border), `radius 0 0 8px 8px`, `shadow/dropdown`, padding `0.4rem 0`
  - item: `type/submenu`, color `text`, padding `0.45rem 1.2rem`;
    hover → `accent` + `translateX(3px)`
- **Fly-out (depth 2+):** absolute `top: 0; left: 100%`, `min-width: 180px`,
  `radius 0 8px 8px 8px`, `shadow: 4px 4px 16px rgba(0,0,0,0.12)`; parent gets a `›` suffix
  at `opacity 0.5`
- **Desktop only** — the whole horizontal-nav treatment is inside `@media (min-width: 801px)`.
  Below that, revert to a stacked/drawer nav.

### 4.2 Hero / banner — `cs/hero`
- Centered logo, `padding: 2rem 0`, image `max-height: 140px`, width auto
- The source's banner system is parameterised in frontmatter and must survive as component
  props: `banner`, `banner-display` (e.g. `80%`, `auto`), `banner-fade` (e.g. `-10`),
  `banner-x` / `banner-y` (focal point %), `banner-height` (px), `content-start` (px)

### 4.3 Section heading — `cs/section-heading`
- `h2`, `margin-top: 2rem`, `padding-bottom: 0.4rem`,
  `border-bottom: 2px solid accent`

### 4.4 Event card — `cs/event-card`
The source styles homepage blockquotes as event cards. This becomes a first-class component
(and the repeater item for the events listing, see content model §Events):
- `border-left: 4px solid accent`
- `background: color-mix(in srgb, accent 8%, bg)`
- `border-radius: 0 8px 8px 0`, `padding: 1rem 1.25rem`, `margin: 0.75rem 0`
- `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`
- body text `margin: 0`, `line-height: 1.6`
- trailing **pill CTA** ("Learn more →"): inline-block, `padding: 0.25rem 0.75rem`,
  `background: accent`, `color: bg`, `radius 20px`, `0.85rem/600`, hover `opacity 0.85`

### 4.5 CTA button — `cs/button`
Source triggers this on a paragraph whose only child is an external link
(`[> Report Form <](…)`). As a component it becomes an explicit button:
- `padding: 0.55rem 1.4rem`, `background: accent`, `color: bg`, `radius 6px`,
  `0.95rem/600`, no underline, `margin: 0.5rem 0`
- hover → `opacity 0.88`, `translateY(-1px)`; active → `translateY(0)`

### 4.6 Tag pill — `cs/tag`
- Pill; hover → `background: accent`, `color: bg`, `0.15s ease`

### 4.7 Inline link — `cs/link` (style rule, not a component)
- color `primary`, `underline`, `text-decoration-color: accent`,
  `text-underline-offset: 2px`
- hover → color **and** underline both `accent`

### 4.8 Breadcrumbs — `cs/breadcrumbs`
- `type/meta`, color `muted`, hover `accent`
- First crumb gets a home icon: `0.85em` square, `currentColor` via CSS mask, inline SVG
  data-URI (house outline, `stroke-width 2`, round caps), `margin-right: 0.3em`,
  `vertical-align: -0.1em`

### 4.9 Volunteer footer — `cs/footer`
Ports `assets/fragments/global-footer.md` (already a reusable fragment on the live site):
- centered, `margin-top: 2rem`, `padding: 1.5rem`, copy at `0.95rem/1.6`
- bold lead-in, `info@cascadesteam.org` mailto, link to the Community Hub
  (`hub.cascadesteam.org`, new tab)
- **Donate badge** → PayPal `hosted_button_id=CLBXLN2E2ZU7C`, new tab,
  `margin-top: 10px`, hover `scale(1.05)` over `0.2s ease`

### 4.10 Profile image — `cs/profile-image`
Used by `About/Leadership/*`: `float: right`, `margin: 0 0 1rem 1.5rem`,
`max-width: 200px`, `radius 6px`. (Source selector: `img[alt="image-right"]`.)

### 4.11 Table of contents — `cs/toc`
Explicitly **unboxed**: no border, no background, no shadow, no outline.
Links hover → `accent`, `translateX(2px)`, `text-shadow: 0 2px 6px rgba(0,0,0,0.15)`.

### 4.12 Card grid — `cs/card-grid` *(new — derived)*
Not in the source (Groups/Projects are prose link-lists today). Needed as the repeater
container for the Groups, Projects, News and Events listings. Build it from the existing
event-card vocabulary so it reads as native: same radius, shadow, and accent left-border.

### 4.13 Social icon row — `cs/social`
Icons hover → `accent`, `translateY(-3px)`,
`filter: drop-shadow(0 3px 6px rgba(0,0,0,0.2))`, `0.2s ease`.

### 4.14 Timestamp — `cs/timestamp`
`margin-top: 1rem`, `padding-top: 0.5rem`, `border-top: 1px solid muted`,
`type/timestamp` (mono, italic, muted).

---

## 5. Primitive tokens

### Radius
| Token | Value | Where |
|-------|-------|-------|
| `radius/sm` | `4px` | nav item hover chips |
| `radius/md` | `6px` | buttons, profile images |
| `radius/lg` | `8px` | cards, dropdowns |
| `radius/pill` | `20px` | pill CTAs, tags |

### Shadow
| Token | Value | Where |
|-------|-------|-------|
| `shadow/card` | `0 2px 8px rgba(0,0,0,0.08)` | cards |
| `shadow/dropdown` | `0 4px 16px rgba(0,0,0,0.12)` | nav dropdowns |
| `shadow/flyout` | `4px 4px 16px rgba(0,0,0,0.12)` | depth-2 fly-outs |
| `shadow/lift` | `0 3px 6px rgba(0,0,0,0.2)` | social icon hover |
| `shadow/text` | `0 2px 8px rgba(0,0,0,0.2)` | nav hover text-shadow |

### Motion
| Token | Value | Where |
|-------|-------|-------|
| `motion/fast` | `0.15s ease` | color, background, text-decoration |
| `motion/lift` | `0.2s ease` | transform, filter |

### Spacing *(inferred — normalising the ad-hoc values in the source)*
`0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2 / 3 rem`

### Layout
| Token | Value | Source |
|-------|-------|--------|
| `layout/nav-height` | `52px` | `$nav-height` |
| `layout/logo-width` | `170px` | `$nav-logo-width` |
| `layout/nav-logo-offset` | `200px` | `$nav-logo-offset` |
| `layout/nav-search-width` | `260px` | `$nav-search-width` |
| `layout/bp-desktop` | `801px` | `@media (min-width: 801px)` — ⚠️ see below |
| `layout/measure` | `750px` *(inferred)* | prose column width |

---

## 6. Interaction vocabulary (the through-line)

Every interactive element in the source obeys the same three-part rule. Keep it — it is
what makes the site feel coherent, and it is cheap to encode once in components:

1. **Color → `accent`** on hover, always.
2. **Move 1–3px** in the direction of reading: nav/buttons `translateY(-1px)`,
   list/TOC items `translateX(2–3px)`, social icons `translateY(-3px)`.
3. **`motion/fast` (0.15s ease)** for color, **`motion/lift` (0.2s ease)** for transforms.

---

## 7. Current live state (audited 2026-07-31, `new.cascadesteam.org`)

This is the gap the overhaul closes. Site has `installed_apps = ['frappe', 'builder']`.

**Builder Variables — 8 records, `type: Color`, nothing else.** No typography, spacing,
radius, shadow, or motion tokens exist at all. Existing UUIDs (reuse these, don't re-mint):

| Existing name | UUID prefix | Value | Reconciles to §2 as |
|---------------|-------------|-------|---------------------|
| `primary` | `8e20a552-…` | `#34b0bf` | **`dark/primary`** — this is the *dark-mode* primary |
| `secondary` | `67fe875a-…` | `#0a2c3f` | `brand/navy` |
| `accent` | `a6799e33-…` | `#d46329` | `light/accent` = `dark/accent` ✅ correct |
| `bg` | `d468b163-…` | `#faf8f8` | `light/bg` ✅ correct |
| `surface` | `0f20e602-…` | `#f2f1f2` | `light/surface` (source has none; this was invented) |
| `text` | `b1bda67c-…` | `#284b63` | **`light/primary`** — this is a *heading/link* color, not body text |
| `muted` | `d22dab48-…` | `#b8b8b8` | `light/muted` ✅ correct |
| `border` | `2b042064-…` | `#d4d4d4` | ✗ not in the source palette (`#d4d4d4` is the *dark-mode text* value) |

### Decision: full reset (owner, 2026-07-31)

**Delete all 8 existing variables, mint the complete token set from §2/§5, and rebuild the 13
pages from the new template.** Rationale: only 13 of 42 routes exist, the 13 are hand-built
duplicates that the content model replaces with templates anyway, and two of the 8 tokens
carry actively wrong semantics. Patching around them would bake the mismatch into the new
component library.

Consequences to plan for:
- The 13 pages' `var(--uuid)` references all die with the old variables. Because every
  emitted `var()` carries a literal hex fallback, a page whose token vanishes degrades to the
  right colour rather than to nothing — but they are being rebuilt regardless.
- **Snapshot first.** 4 `Builder Snapshot` records exist; take a fresh one (plus a site
  backup) before deleting variables, so the current look is recoverable.
- Rebuild order matters: mint tokens → build components → rebuild pages from the template.
  Do not delete the old variables until the new set is minted and read back.

⚠️ **The two semantic mismatches that drove this decision:**
1. `text` = `#284b63` is the style guide's *heading/nav/link* color (`light/primary`). The
   actual body-copy color, `#4e4e4e`, **has no token at all** — so body text is currently
   either hardcoded or wrong.
2. `primary` = `#34b0bf` is the *dark-mode* primary. Light mode's primary is `#284b63`.
   Using `primary` in light-mode blocks yields cyan where the source uses navy.

`border` = `#d4d4d4` is a stray; the source draws rules in **accent orange** (§2 note).
Renaming a token is safe — the UUID is the reference — but every `var(--uuid)` usage must be
re-checked when the *meaning* changes.

**Builder Components — 2 records:** `cs_header`, `cs_footer`. That is the entire reusable
library; §4's other 12 components do not exist. (Schema on this build:
`component_name, block, for_web_page, component_id, component_data_script` — no `is_global`.)

**Builder Pages — 13, all published; 1 template** (`cascadesteam-starter`,
`template_group: cascadesteam`). `Website Settings.home_page = "home"`. Routes are **flat and
lowercase** (`artificial-intelligence`, `service-corps`), matching the live site's flat
aliases rather than its nested `Groups/…` paths. Covered today: `home`, the 7 groups,
`community-groups`, `community-projects`, `service-corps`, `collaborative-internship`.
**Not built:** all 8 `About/*` pages, `Events`, the 3 Leadership profiles, and 11 of 13
Projects. Also present: 4 `Builder Snapshot`, 21 stock `Block Template`, 0 client scripts.

**`developer_mode = 0`** — yet `cascadesteam-starter` has `is_template=1`. So the recorded
"templates require developer_mode" rule is **narrower than believed** (likely UI-side
template creation only, not the stored flag). Re-test before assuming the enable/disable
dance is needed.

---

## 8. Builder implementation notes

Per the standing owner rule, every site build ships **tokens + components + a page
template** — never raw per-page styles.

- **Tokens → `Builder Variable`.** One variable per token above, referenced in blocks as
  `var(--<uuid>, #fallback)`. Per the §7 decision this is a **clean mint** of the full set —
  colour, typography, spacing, radius, shadow, motion — replacing the 8 colour-only records.
  - ⚠️ `Builder Variable` **ignores a client-supplied `name`** and mints its own UUID on
    insert. Create the variable, read back the server UUID, then rewrite `var(--uuid)` in
    every page/component. Always emit the literal hex as the CSS fallback so a token
    mismatch degrades to the right color instead of to nothing.
  - ⚠️ All 8 existing variables are `type: Color`. Confirm what other `type` values this
    build accepts before assuming non-color tokens are storable; if it is colour-only, carry
    type/space/radius via component props and a single injected `head_html` stylesheet.
- **Components → `Builder Component`.** Pages hold thin references, not copies. §4 is the
  build list; only `cs_header` and `cs_footer` exist so far.
- **Template → `Builder Page` with `is_template=1` + `template_group`.** Extend the existing
  `cascadesteam-starter` / `template_group: cascadesteam` rather than adding a rival group.
- **Dark mode:** the source ships a full dark palette, so build both. Emit light values as
  the base and dark values under `prefers-color-scheme: dark`.
- All publishing to the live instance runs **via an OpsKit subagent** — compose and preview
  locally.

---

## 9. Known gaps to resolve

| Gap | Note |
|-----|------|
| h1–h3 sizes, prose measure | Live in Quartz `base.scss`, never overridden. Measure the rendered live site rather than guessing before finalising. |
| **Breakpoint mismatch** | Builder hardcodes its own breakpoints — `builder_page.py` defines `MOBILE_BREAKPOINT = 576`, `TABLET_BREAKPOINT = 768`, `DESKTOP_BREAKPOINT = 1024`. A block's `mobileStyles` / `tabletStyles` map to *those*, so the source's `801px` desktop-nav breakpoint **cannot be expressed** through them. Either re-cut the nav to Builder's 768px tablet boundary (preferred — stays inside the tooling) or ship the `801px` media query as raw CSS via the page's `head_html`. |
| Mobile nav | The source only defines the desktop bar (`≥801px`); below that Quartz's own sidebar handles it. Builder has no equivalent — a mobile drawer must be designed, cut to Builder's own breakpoints (see above). |
| `light/surface` | Source has no distinct card surface (cards tint the accent instead). Confirm whether to introduce one. |
| Search | The header reserves `260px` for Quartz's client-side search. Builder has no drop-in equivalent — decide: Frappe website search, or drop the affordance and reclaim the space. |
| Google Fonts | Source loads Rubik / Source Sans Pro / IBM Plex Mono from the Google CDN. Confirm whether to self-host on the Frappe site. |
