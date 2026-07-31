# Cascade STEAM Website — Design System

**Scope:** the Frappe Builder site `new.cascadesteam.org` (staging hostname destined to
become `cascadesteam.org` + `www.cascadesteam.org`). See `cs-website-content-model.md` for
the authoring/content side.

**Tracking ticket:** CS-0055 — <https://support.cascadesteam.org/helpdesk/tickets/0055>

## Two sources of truth — and which governs what

Owner direction (2026-07-31): **the current Builder site's layout is better than the legacy
Quartz site's and is the direction to keep.** So the two sources are split by concern, and
mixing them up is the main way this spec could go wrong:

| Concern | Source of truth | Why |
|---------|-----------------|-----|
| **Layout & composition** — bands, measures, spacing rhythm, header behaviour, hero, type scale | **The current live site** `new.cascadesteam.org` (audited 2026-07-31) | Owner prefers it. It is already a coherent full-bleed banded system — see §4. |
| **Brand & palette & fonts** | Legacy Quartz config + the logo SVG | The only authoritative record of the brand colours and font stack. The current site already uses the right fonts. |
| **Interaction vocabulary** | Legacy `custom.scss` | The accent-orange-on-hover + small-move rule is worth carrying forward; the current site barely uses accent at all. |
| **Old-site chrome** — sidebar explorer nav, 2-level hover dropdowns, breadcrumbs, sidebar TOC | ❌ **Not ported** | This is precisely the layout the owner likes *less*. Earlier drafts of this spec wrongly listed these as components to build. |

Extraction paths:

| What | Where |
|------|-------|
| Current layout, measures, type scale | rendered HTML/CSS of `new.cascadesteam.org` |
| Colors, fonts | `~/Projects/cascadesteam.github.io/.github/quartz/quartz.config.ts` |
| Interaction vocabulary | `~/Projects/cascadesteam.github.io/.github/quartz/custom.scss` |
| Brand hexes | `assets/images/Cascade_STEAM_horizontal_logo_primary.svg` |
| Content-author contract | `assets/_templates/{Page,News}.md`, `Events/index.md` frontmatter |

Directive: **keep the CS brand, rebuild the system.** No palette is invented here. Values
marked *(inferred)* are proposed defaults not stated in either source.

---

## 1. Brand marks

The logo SVG contains exactly three colors — this is the brand triad:

| Token | Hex | Role |
|-------|-----|------|
| `brand/navy` | `#0a2c3f` | Deepest brand navy (logo wordmark) |
| `brand/cyan` | `#34b0bf` | Brand cyan — the current site's hero band |
| `brand/orange` | `#d46329` | Brand orange — the accent |

Assets in `assets/images/`: horizontal + vertical × primary / solid-dark / solid-white /
primary-darkBG, SVG + PNG. Use horizontal-primary in the header, `_darkBG` on dark bands.

---

## 2. Color tokens

Quartz's semantic names are misleading (`lightgray` is the orange used for rules). Renamed
below to what they *do*, preserving exact values.

### Light mode
| Token | Hex | Quartz origin | Used for |
|-------|-----|---------------|----------|
| `light/bg` | `#faf8f8` | `light` | Alternating band background A |
| `light/surface` | `#f2f1f2` | — (live site) | Alternating band background B + header |
| `light/text` | `#4e4e4e` | `darkgray` | Body copy |
| `light/primary` | `#284b63` | `dark` / `secondary` | Headings, links |
| `light/accent` | `#d46329` | `tertiary` / `lightgray` | Hovers, CTAs, active states |
| `light/muted` | `#b8b8b8` | `gray` | Meta text |
| `light/highlight` | `rgba(143,159,169,0.15)` | `highlight` | Nav-item hover background |
| `light/mark` | `#fff23688` | `textHighlight` | `==highlighted text==` |

### Dark mode
| Token | Hex | Quartz origin |
|-------|-----|---------------|
| `dark/bg` | `#050505` | `light` |
| `dark/text` | `#d4d4d4` | `darkgray` |
| `dark/primary` | `#34b0bf` | `dark` / `secondary` |
| `dark/accent` | `#d46329` | `tertiary` — unchanged across modes |
| `dark/muted` | `#646464` | `gray` |
| `dark/highlight` | `#34b1bf33` | `highlight` |
| `dark/mark` | `rgba(0,171,197,0.43)` | `textHighlight` |

**The rule that defines the site's feel:** `accent` (orange) never changes between modes;
`primary` shifts navy → cyan.

### Untokenized values found live — these need tokens
The current site hardcodes five derived colors with no variable behind them. Tokenizing these
is a concrete part of the theming overhaul:

| Hex | Where | Proposed token |
|-----|-------|----------------|
| `#21727c` | footer band background | `cyan/deep` (a darkened `brand/cyan`) |
| `#85cfd8`, `#a3dbe2` | cyan tints, links/text on dark bands | `cyan/tint-1`, `cyan/tint-2` |
| `#9d9c9d`, `#aeadae` | greys | fold into `light/muted` or add `grey/1`, `grey/2` |

---

## 3. Typography

Fonts load from Google Fonts and **already match the brand** on the live site:

| Token | Family | Role |
|-------|--------|------|
| `font/heading` | **Rubik** | Headings, nav, buttons |
| `font/body` | **Source Sans Pro** | Body copy |
| `font/mono` | **IBM Plex Mono** | Code, timestamps |

Full live stack: `Rubik, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, …emoji`.

### Scale — measured from the live site (no longer inferred)
| Token | Desktop | ≤576px | Weight / line-height |
|-------|---------|--------|----------------------|
| `type/h1` | **52px** | **36px** | 700 / 1.08 |
| `type/h2` | **34px** | — | 700 / 1.2 |
| `type/h3` | `24px` *(inferred)* | — | 600 / 1.3 |
| `type/body` | `1rem` | — | 400 / 1.6 |
| `type/small` | `0.95rem` | — | 400 |
| `type/meta` | `0.85rem` | — | 400/500 |
| `type/nav` | `0.9rem` | — | 600 |
| `type/eyebrow` | `0.65rem` | — | 700, uppercase, `letter-spacing 0.12em` |
| `type/timestamp` | `0.75rem` | — | mono, italic |

Note the current h2 has **no orange underline** — that was Quartz chrome. Introducing accent
at section headings is an open design choice (§10), not a port.

---

## 4. Layout system — the part to preserve

This is what the owner prefers, and it is already consistent across the live pages. Formalise
it as-is; it becomes the skeleton every template uses.

### The band pattern
Every section is a **full-bleed band** wrapping a **constrained inner column**:

```
<section>                     full width, display:flex, justify-content:center,
                              background-color: <band token>
  <div>                       max-width: <measure>, padding: 72px 24px,
                              box-sizing: border-box, display:flex,
                              flex-direction: column, gap: 16–20px
```

### Measures
| Token | Value | Used by |
|-------|-------|---------|
| `layout/measure-wide` | `1100px` | header inner |
| `layout/measure-prose` | `880px` | content bands |
| `layout/measure-hero` | `860px` | hero band |

### Band rhythm
Backgrounds **alternate** down the page — `surface` `#f2f1f2` ↔ `bg` `#faf8f8` — giving
section separation without rules or borders. Live home page order:

| # | Band | Background |
|---|------|------------|
| 1 | Sticky header | `surface` |
| 2 | Hero | `primary` cyan, text `surface` |
| 3 | Mission | `surface` |
| 4 | Programs | `bg` |
| 5 | Community Connection | `surface` |
| 6 | Code of Conduct | `bg` |
| 7 | Footer | `#21727c` (untokenized — see §2) |

### Header
**Sticky, not fixed:** `position: sticky; top: 0; z-index: 50`, background `surface`,
`border-bottom: 1px solid`. Inner: `max-width 1100px`, `padding 14px 24px`,
`justify-content: space-between` — logo left, link row right with `gap: 26px`
(`gap: 16px` + `flex-wrap` ≤576px). A **flat link row — no dropdowns.**

### Hero
Cyan band, centered, `max-width 860px`, `padding 72px 24px`, `gap 16px`, h1 at `type/h1`.
Currently text-only ("Cascade STEAM") — no logo or banner image.

### Vertical rhythm
`padding: 72px 24px` per band; `gap: 20px` between blocks in a content band, `16px` in the
hero. Single breakpoint: **576px** (Builder's mobile boundary — see §10).

---

## 5. Component inventory

Each is one **Builder Component**. Derived from the current site (§4) for structure, with the
brand/interaction layer from the legacy source. Only `cs_header` and `cs_footer` exist today.

### Structural — formalise what's live
| Component | Spec |
|-----------|------|
| `cs/band` | The §4 wrapper: full-bleed section + constrained inner. Props: background token, measure, padding. **Every other component sits inside one.** |
| `cs/header` | §4 Header. Sticky, flat link row, logo left. Needs a mobile treatment (§10). |
| `cs/hero` | §4 Hero. Props: background token, heading, optional sub-copy, optional CTA. |
| `cs/section-heading` | `h2` at `type/h2`, Rubik 700/1.2. |
| `cs/prose` | Body copy block, `type/body`, line-height 1.6, inline links per `cs/link`. |
| `cs/footer` | Currently a `<section>` on `#21727c` with address, "Connect" links, Donate/GitHub/LinkedIn/Calendar. Rebuild as semantic `<footer>`, tokenize the background, and **fix the stale attribution** (§10). |

### New — needed by the content model
| Component | Spec |
|-----------|------|
| `cs/card-grid` | Repeater container for Groups, Projects, News, Events listings. Today these are prose link-lists; cards are the upgrade. Responsive columns inside the prose measure. |
| `cs/entry-card` | Listing item: optional banner, title, summary, tag row. Left `4px solid accent` border, `radius/lg`, `shadow/card` — carried from the legacy event-card idea, restyled to the current band system. |
| `cs/event-card` | `cs/entry-card` + date, location, RSVP link. |
| `cs/button` | `padding 0.55rem 1.4rem`, background `accent`, color `bg`, `radius/md`, `0.95rem/600`; hover `opacity 0.88` + `translateY(-1px)`. |
| `cs/pill` | `radius/pill`, `padding 0.25rem 0.75rem`, `0.85rem/600`, background `accent`. |
| `cs/tag` | Pill; hover → background `accent`, color `bg`. |
| `cs/social` | Icon row; hover `accent` + `translateY(-3px)` + `shadow/lift`. |
| `cs/profile-card` | Leadership profiles: portrait, name, role, contact links. Replaces the legacy `float: right` image hack with a proper card. |
| `cs/timestamp` | `border-top: 1px solid muted`, `type/timestamp`. |
| `cs/link` | *(style rule)* color `primary`, underline in `accent`, `text-underline-offset 2px`; hover → both `accent`. |

### Explicitly not ported
Sidebar explorer nav · two-level hover dropdowns · fixed 52px bar · breadcrumbs with masked
home icon · sidebar table of contents · `img[alt="image-right"]` float. All legacy chrome the
owner likes less than the current layout.

---

## 6. Primitive tokens

### Radius
`radius/sm` `4px` · `radius/md` `6px` · `radius/lg` `8px` · `radius/pill` `20px`

### Shadow
| Token | Value |
|-------|-------|
| `shadow/card` | `0 2px 8px rgba(0,0,0,0.08)` |
| `shadow/dropdown` | `0 4px 16px rgba(0,0,0,0.12)` |
| `shadow/lift` | `0 3px 6px rgba(0,0,0,0.2)` |

### Motion
`motion/fast` `0.15s ease` (color, background) · `motion/lift` `0.2s ease` (transform, filter)

### Spacing
Live values are `14 / 16 / 20 / 24 / 26 / 72 px`. Normalised scale *(inferred)*:
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 72 px`.

### Layout
`layout/band-padding` `72px 24px` · `layout/header-padding` `14px 24px` ·
`layout/measure-wide` `1100px` · `layout/measure-prose` `880px` ·
`layout/measure-hero` `860px` · `layout/header-z` `50` · `layout/bp-mobile` `576px`

---

## 7. Interaction vocabulary

From the legacy source; the current site under-uses it. Encode once in components:

1. **Color → `accent`** on hover, always.
2. **Move 1–3px** toward reading direction: nav/buttons `translateY(-1px)`, list items
   `translateX(2–3px)`, social icons `translateY(-3px)`.
3. **`motion/fast`** for color, **`motion/lift`** for transforms.

---

## 8. Current live state (audited 2026-07-31)

Site has `installed_apps = ['frappe', 'builder']`.

**Builder Variables — 8 records, `type: Color` only.** No typography, spacing, radius,
shadow, or motion tokens. They *are* wired up correctly: the home page alone contains **50
`var(--uuid, #hex)` references** with accurate hex fallbacks.

| Existing name | UUID prefix | Value | Reconciles to |
|---------------|-------------|-------|---------------|
| `primary` | `8e20a552-…` | `#34b0bf` | `brand/cyan` — used as the hero band |
| `secondary` | `67fe875a-…` | `#0a2c3f` | `brand/navy` |
| `accent` | `a6799e33-…` | `#d46329` | `light/accent` ✅ |
| `bg` | `d468b163-…` | `#faf8f8` | `light/bg` ✅ |
| `surface` | `0f20e602-…` | `#f2f1f2` | `light/surface` ✅ |
| `text` | `b1bda67c-…` | `#284b63` | **`light/primary`** — a heading/link colour, not body text |
| `muted` | `d22dab48-…` | `#b8b8b8` | `light/muted` ✅ |
| `border` | `2b042064-…` | `#d4d4d4` | not in the source palette |

⚠️ **The real token gaps:**
1. `text` = `#284b63` is the *heading/link* colour. Actual body copy `#4e4e4e` **has no
   token**, so body text is hardcoded or wrong.
2. Five derived colours are hardcoded with no variable at all (§2).
3. No non-colour tokens exist — the whole type/space/radius/shadow layer is ad-hoc.

### Token strategy — revised (supersedes the earlier "full reset")

The earlier full-reset decision rested on the premise that the 13 existing pages were
throwaway hand-built duplicates. **That premise is wrong** — the owner prefers the current
layout, so those pages are the reference implementation, not scrap. Revised plan:

- **Rename and remap in place.** Fix `text` → `heading`, add `body` = `#4e4e4e`, and rename
  `primary` → `brand-cyan` to stop it reading as "the light-mode primary". Renaming is safe:
  the UUID is the reference, so the 50 existing `var()` calls keep resolving.
- **Add the missing tokens** — body colour, the five untokenized hexes, and the whole
  type/space/radius/shadow/motion layer.
- **Do not delete the 8.** Deleting them orphans 50+ live references per page; they would
  fall back to the correct hex, but there is no upside to churning them.
- **Sweep for hardcoded values** afterwards and repoint them at tokens.
- Still take a **Builder Snapshot + site backup** before any of it.

**Builder Components — 2 records:** `cs_header`, `cs_footer`. §5's other components don't
exist. (Schema: `component_name, block, for_web_page, component_id, component_data_script` —
no `is_global`.)

**Builder Pages — 13, all published; 1 template** (`cascadesteam-starter`,
`template_group: cascadesteam`). `Website Settings.home_page = "home"`. Routes flat and
lowercase. Built: `home`, 7 Groups, `community-groups`, `community-projects`,
`service-corps`, `collaborative-internship`. **Not built:** 8 `About/*` pages, `Events`,
3 Leadership profiles, 11 of 13 Projects. Also 4 `Builder Snapshot`, 21 stock
`Block Template`, 0 client scripts.

**`developer_mode = 0`** — yet `cascadesteam-starter` has `is_template=1`. The recorded
"templates require developer_mode" rule is **narrower than believed**; retest before assuming
the enable/disable dance is needed.

---

## 9. Builder implementation notes

Per the standing owner rule, every build ships **tokens + components + a page template**.

- **Tokens → `Builder Variable`**, referenced as `var(--<uuid>, #fallback)`. Always emit the
  literal hex fallback so a token mismatch degrades to the right colour.
  - ⚠️ `Builder Variable` **ignores a client-supplied `name`** and mints its own UUID on
    insert. Create, read back the UUID, then write `var(--uuid)`.
  - ⚠️ All 8 existing records are `type: Color`. Confirm what other `type` values this build
    accepts before assuming non-colour tokens are storable; if colour-only, carry
    type/space/radius via component props plus one injected `head_html` stylesheet.
- **Components → `Builder Component`.** Pages hold thin references. Build `cs/band` first —
  everything else nests inside it.
- **Template → `Builder Page`** with `is_template=1` in the existing
  `template_group: cascadesteam`; extend `cascadesteam-starter` rather than adding a rival.
- **Dark mode:** the legacy source ships a full dark palette but the current site implements
  only light. Building dark is net-new work — confirm it is in scope.
- All publishing to the live instance runs **via an OpsKit subagent**; compose and preview
  locally.

---

## 10. Known gaps to resolve

| Gap | Note |
|-----|------|
| **Stale footer attribution** | The live footer still reads *"Built with Obsidian and Quartz \| © 2026 Cascade STEAM"* — and the string appears **twice**. Wrong on a Builder site. Fix during the footer rebuild. |
| **Breakpoint ceiling** | Builder hardcodes `MOBILE_BREAKPOINT = 576`, `TABLET_BREAKPOINT = 768`, `DESKTOP_BREAKPOINT = 1024` (`builder_page.py`). A block's `mobileStyles`/`tabletStyles` map to those. The live site only uses 576, so there is **no tablet treatment** — 577–1024px gets the desktop layout. Worth adding at 768. |
| **Mobile nav** | The flat link row wraps at ≤576px. With Events, About, Projects and Leadership added, the row gets much longer — needs a real drawer/disclosure rather than wrapping. |
| **Nav is incomplete** | Header lists Home, Community Groups, Community Projects, only 4 of 7 groups, and Donate. Missing About, Events, and all Projects children. Needs an information-architecture pass, not just styling. |
| **Hero has no logo** | Legacy hero centred the horizontal logo; the current hero is text-only. Confirm which is wanted. |
| **Accent is barely used** | The current site is cyan/grey; brand orange is nearly absent despite being the legacy accent. Decide deliberately how much orange returns. |
| **Dark mode** | Palette exists in the legacy source, unimplemented live. In scope or not? |
| **Search** | Legacy header reserved 260px for Quartz client-side search. The current header has none. Decide: Frappe website search, or drop it. |
| **Google Fonts** | Loaded from the Google CDN. Confirm whether to self-host on the Frappe site. |
| **`h3` and below** | Live pages only use h1/h2. Sizes below h2 are still inferred. |
