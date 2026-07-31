#!/usr/bin/env python3
"""
Cascade STEAM component library composer — CS-0055, step 2 (local phase).

Builds the `Builder Component` payloads for new.cascadesteam.org from the design
system spec, driven entirely by the applied token map so no colour or dimension is
hardcoded.

  ./cs_components.py --tokens cs-tokens-applied.json \
                     --out-dir components/ --preview preview.html

Publishing to the live instance is a separate step and runs via an OpsKit subagent.

Design source of truth:
  layout/composition -> the CURRENT live site (docs/cs-website-design-system.md §4)
  brand/palette/type -> legacy Quartz config
  interaction        -> legacy custom.scss (accent-only, per the owner decision)
"""

import argparse
import json
import pathlib
import uuid

# ---------------------------------------------------------------- token plumbing

TOKENS: dict = {}


def load_tokens(path):
    """Load the applied token map: name -> {uuid, value, dark_value, type}."""
    global TOKENS
    raw = json.loads(pathlib.Path(path).read_text())
    # Accept either a flat {name: {...}} map or a {"tokens": {...}} wrapper.
    TOKENS = raw.get("tokens", raw)
    missing = [n for n in REQUIRED_TOKENS if n not in TOKENS]
    if missing:
        raise SystemExit(
            "Token map is missing required tokens: "
            + ", ".join(sorted(missing))
            + "\nRun step 1 first, or check the name mapping."
        )
    return TOKENS


REQUIRED_TOKENS = [
    # colour
    "bg", "surface", "heading", "body", "accent", "muted", "hairline",
    "brand-cyan", "brand-navy", "cyan-deep", "cyan-tint-1",
    # dimension
    "measure-wide", "measure-prose", "measure-hero",
    "band-pad-y", "band-pad-x", "header-pad-y", "header-pad-x",
    "radius-md", "radius-lg", "radius-pill",
    "type-h1", "type-h2", "type-body", "type-nav",
    "space-2", "space-4", "space-5", "space-6",
]


def tok(name):
    """`var(--<uuid>, <literal>)` — the literal fallback means a token miss degrades
    to the right value instead of to nothing."""
    t = TOKENS[name]
    return f"var(--{t['uuid']}, {t['value']})"


def raw(name):
    """The literal token value, for places a var() cannot be used."""
    return TOKENS[name]["value"]


# ------------------------------------------------------- not storable as tokens
# Builder Variable.type accepts only Color and Dimension, so families, weights,
# unitless line-heights, shadows and easing live here and ship via component props
# plus one injected head_html stylesheet. Keep these in sync with cs-tokens.json.

FONT_HEAD = ('Rubik, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif')
FONT_BODY = ('"Source Sans Pro", system-ui, "Segoe UI", Roboto, Helvetica, '
             'Arial, sans-serif')
FONT_MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

WEIGHT = {"h1": "700", "h2": "700", "h3": "600", "body": "400", "nav": "600"}
LH = {"h1": "1.08", "h2": "1.2", "h3": "1.3", "body": "1.6"}
SHADOW = {
    "card": "0 2px 8px rgba(0,0,0,0.08)",
    "dropdown": "0 4px 16px rgba(0,0,0,0.12)",
    "lift": "0 3px 6px rgba(0,0,0,0.2)",
}
MOTION_FAST = "0.15s ease"
MOTION_LIFT = "0.2s ease"


# ------------------------------------------------------------------- block DSL

def _id():
    return uuid.uuid4().hex[:10]


def blk(element, *, styles=None, html=None, attrs=None, children=None, name=None,
        mobile=None, tablet=None, root=False, props=None, data_key=None,
        repeater=False, visibility=None):
    """One Builder block in the full native shape, so it round-trips exactly like
    Builder's own output. There is NO `blockType` key — `element` is the tag."""
    b = {
        "blockId": "root" if root else _id(),
        "element": element,
        "baseStyles": styles or {},
        "rawStyles": {},
        "mobileStyles": mobile or {},
        "tabletStyles": tablet or {},
        "classes": [],
        "attributes": attrs or {},
        "customAttributes": {},
        "children": children or [],
    }
    if root:
        b["originalElement"] = "body"
    if name:
        b["blockName"] = name
    if html is not None:
        b["innerHTML"] = html
    if props:
        b["props"] = props
    if data_key:
        b["dataKey"] = data_key
    if repeater:
        # is_repeater_block() requires isRepeaterBlock AND children AND dataKey.
        b["isRepeaterBlock"] = True
    if visibility:
        b["visibilityCondition"] = visibility
    return b


def repeater_over(key, item_block, *, name=None, styles=None, mobile=None):
    """A repeater container.

    Two renderer rules enforced here, both of which fail silently otherwise:
      - only children[0] is repeated, so exactly ONE child is allowed;
      - the loop iterates dataKey.key, so `property` must NOT be set here.
    """
    return blk("div", name=name or "Repeater", styles=styles or {}, mobile=mobile,
               children=[item_block], repeater=True,
               data_key={"key": key, "comesFrom": "dataScript"})


def bind_text(block, key):
    """Bind an item field to text content."""
    block["dataKey"] = {"key": key, "type": "key", "property": "innerHTML",
                        "comesFrom": "dataScript"}
    return block


def bind_attr(block, key, attribute):
    """Bind an item field to an attribute. src/href need type 'attribute', not 'key'."""
    block["dataKey"] = {"key": key, "type": "attribute", "property": attribute,
                        "comesFrom": "dataScript"}
    return block


# ------------------------------------------------------------------ components
# Each builder returns (component_name, component_id, root_block).

def c_band():
    """cs/band — the layout skeleton. Full-bleed section + constrained inner column.
    Every other component sits inside one."""
    inner = blk("div", name="Inner", styles={
        "display": "flex", "flexDirection": "column", "gap": tok("space-5"),
        "width": "100%", "maxWidth": tok("measure-prose"),
        "padding": f"{tok('band-pad-y')} {tok('band-pad-x')}",
        "boxSizing": "border-box",
    })
    root = blk("section", name="Band", root=True, styles={
        "display": "flex", "justifyContent": "center", "width": "100%",
        "backgroundColor": tok("surface"),
    }, children=[inner])
    return "cs_band", "cs-band", root


def c_header():
    """cs/header — sticky (not fixed), flat link row, logo left. No dropdowns:
    the legacy two-level hover menu is deliberately not ported."""
    logo = blk("a", name="Logo", attrs={"href": "/"}, children=[
        blk("img", attrs={
            "src": "/files/Cascade_STEAM_horizontal_logo_primary.svg",
            "alt": "Cascade STEAM",
        }, styles={"height": "30px", "width": "auto"})
    ], styles={"display": "flex", "alignItems": "center"})

    nav = blk("nav", name="Nav", styles={
        "display": "flex", "alignItems": "center", "gap": tok("space-6"),
    }, mobile={"gap": tok("space-4"), "flexWrap": "wrap"})

    inner = blk("div", name="Header Inner", styles={
        "display": "flex", "alignItems": "center", "justifyContent": "space-between",
        "width": "100%", "maxWidth": tok("measure-wide"),
        "padding": f"{tok('header-pad-y')} {tok('header-pad-x')}",
        "boxSizing": "border-box",
    }, mobile={"flexWrap": "wrap", "gap": tok("space-2")},
        children=[logo, nav])

    root = blk("section", name="Header", root=True, styles={
        "display": "flex", "justifyContent": "center", "width": "100%",
        "backgroundColor": tok("surface"),
        "position": "sticky", "top": "0px", "zIndex": "50",
        "borderBottomWidth": "1px", "borderBottomStyle": "solid",
        "borderBottomColor": tok("hairline"),
    }, children=[inner])
    return "cs_header", "cs-header", root


def nav_link(label, href):
    """A header nav item. Accent on hover + 1px lift — the interaction vocabulary."""
    return blk("a", html=label, attrs={"href": href}, name="Nav Link", styles={
        "fontFamily": FONT_HEAD, "fontSize": tok("type-nav"), "fontWeight": WEIGHT["nav"],
        "color": tok("heading"), "textDecoration": "none", "whiteSpace": "nowrap",
        "transition": f"color {MOTION_FAST}, transform {MOTION_LIFT}",
        "hover:color": tok("accent"),
        "hover:transform": "translateY(-1px)",
    })


def c_hero():
    """cs/hero — cyan band, centred, white text."""
    h1 = blk("h1", html="Cascade STEAM", name="Hero Heading", styles={
        "fontFamily": FONT_HEAD, "fontSize": tok("type-h1"), "fontWeight": WEIGHT["h1"],
        "lineHeight": LH["h1"], "margin": "0", "color": tok("surface"),
    }, mobile={"fontSize": raw("type-h1-mobile")})

    inner = blk("div", name="Hero Inner", styles={
        "display": "flex", "flexDirection": "column", "alignItems": "center",
        "textAlign": "center", "gap": tok("space-4"), "width": "100%",
        "maxWidth": tok("measure-hero"),
        "padding": f"{tok('band-pad-y')} {tok('band-pad-x')}",
        "boxSizing": "border-box",
    }, children=[h1])

    root = blk("section", name="Hero", root=True, styles={
        "display": "flex", "justifyContent": "center", "width": "100%",
        "backgroundColor": tok("brand-cyan"), "color": tok("surface"),
    }, children=[inner])
    return "cs_hero", "cs-hero", root


def c_section_heading():
    """cs/section-heading — h2. No orange underline: that was Quartz chrome and the
    accent-only decision keeps it dropped."""
    root = blk("h2", html="Section", name="Section Heading", root=True, styles={
        "fontFamily": FONT_HEAD, "fontSize": tok("type-h2"), "fontWeight": WEIGHT["h2"],
        "lineHeight": LH["h2"], "margin": "0", "color": tok("heading"),
    })
    return "cs_section_heading", "cs-section-heading", root


def c_prose():
    """cs/prose — body copy. Uses the `body` token, the one that never existed."""
    root = blk("div", name="Prose", root=True, html="", styles={
        "fontFamily": FONT_BODY, "fontSize": tok("type-body"),
        "lineHeight": LH["body"], "color": tok("body"),
    })
    return "cs_prose", "cs-prose", root


def c_button():
    """cs/button — accent. Orange as a STATE, per the accent-only decision."""
    root = blk("a", html="Learn more", attrs={"href": "#"}, name="Button", root=True,
               styles={
                   "display": "inline-block", "width": "fit-content",
                   "fontFamily": FONT_HEAD, "fontSize": "15px", "fontWeight": "600",
                   "textDecoration": "none",
                   "padding": f"{tok('space-2')} {tok('space-6')}",
                   "backgroundColor": tok("accent"), "color": tok("bg"),
                   "borderRadius": tok("radius-md"),
                   "transition": f"opacity {MOTION_FAST}, transform {MOTION_LIFT}",
                   "hover:opacity": "0.88",
                   "hover:transform": "translateY(-1px)",
                   "active:transform": "translateY(0)",
               })
    return "cs_button", "cs-button", root


def c_tag():
    """cs/tag — pill. Neutral at rest, accent on hover."""
    root = blk("a", html="tag", attrs={"href": "#"}, name="Tag", root=True, styles={
        "display": "inline-block", "width": "fit-content",
        "fontFamily": FONT_BODY, "fontSize": "13px", "fontWeight": "600",
        "textDecoration": "none", "padding": "4px 12px",
        "backgroundColor": tok("surface"), "color": tok("heading"),
        "borderRadius": tok("radius-pill"),
        "transition": f"background-color {MOTION_FAST}, color {MOTION_FAST}",
        "hover:backgroundColor": tok("accent"),
        "hover:color": tok("bg"),
    })
    return "cs_tag", "cs-tag", root


def _card_inner(kind):
    """Shared card body. `kind` is 'entry' or 'event'."""
    title = bind_text(blk("h3", name="Card Title", styles={
        "fontFamily": FONT_HEAD, "fontSize": "20px", "fontWeight": WEIGHT["h3"],
        "lineHeight": LH["h3"], "margin": "0", "color": tok("heading"),
    }), "item.title")

    kids = []
    if kind == "event":
        # visibilityCondition works on nested elements, NOT on the card root —
        # render_repeater_children never sets visibility_key.
        meta = bind_text(blk("div", name="Event Meta", styles={
            "fontFamily": FONT_MONO, "fontSize": "13px", "color": tok("muted"),
        }, visibility="item.when"), "item.when")
        kids.append(meta)

    kids.append(title)
    kids.append(bind_text(blk("p", name="Card Summary", styles={
        "fontFamily": FONT_BODY, "fontSize": "15px", "lineHeight": LH["body"],
        "margin": "0", "color": tok("body"),
    }), "item.summary"))
    return kids


def _card(kind, name):
    """Card root: accent left border, per the accent-only decision."""
    link = bind_attr(blk("a", name="Card Link", attrs={"href": "#"}, styles={
        "textDecoration": "none", "display": "flex", "flexDirection": "column",
        "gap": tok("space-2"),
    }, children=_card_inner(kind)), "item.route", "href")

    return blk("div", name=name, styles={
        "display": "flex", "flexDirection": "column",
        "padding": f"{tok('space-4')} {tok('space-5')}",
        "backgroundColor": tok("bg"),
        "borderLeftWidth": "4px", "borderLeftStyle": "solid",
        "borderLeftColor": tok("accent"),
        "borderRadius": f"0 {tok('radius-lg')} {tok('radius-lg')} 0",
        "boxShadow": SHADOW["card"],
        "transition": f"transform {MOTION_LIFT}, box-shadow {MOTION_LIFT}",
        "hover:transform": "translateY(-2px)",
        "hover:boxShadow": SHADOW["lift"],
    }, children=[link])


def c_entry_card():
    return "cs_entry_card", "cs-entry-card", dict(_card("entry", "Entry Card"),
                                                  blockId="root",
                                                  originalElement="body")


def c_event_card():
    return "cs_event_card", "cs-event-card", dict(_card("event", "Event Card"),
                                                  blockId="root",
                                                  originalElement="body")


def c_card_grid():
    """cs/card-grid — the repeater container for every listing.
    Exactly one child: the card. Any sibling would be silently dropped."""
    root = repeater_over("entries", _card("entry", "Entry Card"), name="Card Grid",
                         styles={
                             "display": "grid",
                             "gridTemplateColumns": "repeat(auto-fill, minmax(280px, 1fr))",
                             "gap": tok("space-5"), "width": "100%",
                         },
                         mobile={"gridTemplateColumns": "1fr"})
    root["blockId"] = "root"
    root["originalElement"] = "body"
    return "cs_card_grid", "cs-card-grid", root


def c_footer():
    """cs/footer — semantic <footer> on the deep-cyan band. The live version is a
    <section> and still carries stale 'Built with Obsidian and Quartz' attribution;
    both are fixed here."""
    contact = blk("p", name="Footer Contact", styles={
        "fontFamily": FONT_BODY, "fontSize": "15px", "lineHeight": LH["body"],
        "margin": "0", "color": tok("cyan-tint-1"), "textAlign": "center",
    }, html=('Interested in getting involved? '
             '<a href="mailto:info@cascadesteam.org" '
             'style="color:inherit;text-decoration:underline">info@cascadesteam.org</a>'))

    colophon = blk("p", name="Colophon", styles={
        "fontFamily": FONT_BODY, "fontSize": "13px", "margin": "0",
        "color": tok("cyan-tint-1"), "textAlign": "center", "opacity": "0.8",
    }, html="© 2026 Cascade STEAM. All rights reserved.")

    inner = blk("div", name="Footer Inner", styles={
        "display": "flex", "flexDirection": "column", "alignItems": "center",
        "gap": tok("space-4"), "width": "100%", "maxWidth": tok("measure-prose"),
        "padding": f"{tok('band-pad-y')} {tok('band-pad-x')}",
        "boxSizing": "border-box",
    }, children=[contact, colophon])

    root = blk("footer", name="Footer", root=True, styles={
        "display": "flex", "justifyContent": "center", "width": "100%",
        "backgroundColor": tok("cyan-deep"),
    }, children=[inner])
    return "cs_footer", "cs-footer", root


COMPONENTS = [
    c_band, c_header, c_hero, c_section_heading, c_prose,
    c_button, c_tag, c_entry_card, c_event_card, c_card_grid, c_footer,
]


# --------------------------------------------------------------------- preview

def _css(styles):
    out = []
    for k, v in styles.items():
        if ":" in k:          # hover:/active: pseudo states — skipped in preview
            continue
        prop = "".join("-" + c.lower() if c.isupper() else c for c in k)
        out.append(f"{prop}:{v}")
    return ";".join(out)


def render(block):
    el = block.get("element", "div")
    style = _css(block.get("baseStyles", {}))
    attrs = "".join(f' {k}="{v}"' for k, v in (block.get("attributes") or {}).items())
    inner = block.get("innerHTML", "")
    kids = "".join(render(c) for c in (block.get("children") or []))
    if el == "img":
        return f'<img{attrs} style="{style}">'
    return f'<{el}{attrs} style="{style}">{inner}{kids}</{el}>'


def preview_html(built):
    parts = []
    for cname, cid, root in built:
        parts.append(
            f'<div style="margin:0 0 8px"><code style="font:12px monospace;'
            f'background:#eee;padding:2px 6px;border-radius:4px">{cname}</code></div>'
            f'<div style="border:1px dashed #ccc;margin:0 0 40px">{render(root)}</div>'
        )
    return (
        '<meta charset="utf-8">'
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700'
        '&family=Source+Sans+Pro:wght@400;600;700&family=IBM+Plex+Mono&display=swap" '
        'rel="stylesheet">'
        '<body style="margin:0;font-family:system-ui;background:#fff">'
        '<div style="padding:24px"><h1 style="font:700 20px Rubik">Cascade STEAM — '
        'component library preview</h1><p style="color:#666;font:14px system-ui">'
        'CS-0055 · hover states are not rendered here</p></div>'
        + "".join(parts) + "</body>"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tokens", required=True, help="cs-tokens-applied.json from step 1")
    ap.add_argument("--out-dir", default="components")
    ap.add_argument("--preview")
    a = ap.parse_args()

    load_tokens(a.tokens)
    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    built = [fn() for fn in COMPONENTS]
    for cname, _cid, root in built:
        # `Builder Component` is autoname: field:component_id, and Frappe's
        # _sync_autoname_field() force-rewrites component_id to equal `name` on
        # insert — the two cannot diverge. They must also stay equal because page
        # blocks reference a component by record NAME (extendedFromComponent) while
        # clear_page_cache()/sync_component() match on component_id; if those
        # differed, cache invalidation would silently no-op.
        payload = {
            "component_name": cname,
            "component_id": cname,
            "for_web_page": None,
            "block": json.dumps(root),
        }
        (out / f"{cname}.json").write_text(json.dumps(payload, indent=2))
        print(f"  {cname:22s} -> {out / (cname + '.json')}")

    if a.preview:
        pathlib.Path(a.preview).write_text(preview_html(built))
        print(f"\npreview: {a.preview}")
    print(f"\n{len(built)} components composed. Publishing runs via an OpsKit subagent.")


if __name__ == "__main__":
    main()
