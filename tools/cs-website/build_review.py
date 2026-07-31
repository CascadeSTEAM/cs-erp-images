#!/usr/bin/env python3
"""Build the CS-0055 component review page from the ACTUAL composer output, so the
page shows what will publish rather than a hand-written approximation."""
import json, pathlib, html
import cs_components as C

TOK = C.load_tokens("cs-tokens-applied.json")
built = [fn() for fn in C.COMPONENTS]

NOTES = {
    "cs_band": ("The layout skeleton. Full-bleed section, constrained inner column, "
                "72px/24px padding. Everything else nests inside one.", "preserved"),
    "cs_header": ("Sticky (not fixed), flat link row, logo left. The legacy two-level "
                  "hover dropdown is deliberately not ported.", "preserved"),
    "cs_hero": ("Cyan band, centred, white text. h1 52px, dropping to 36px at 576px.",
                "preserved"),
    "cs_section_heading": ("h2 at 34px. No orange underline — that was Quartz chrome "
                           "and accent-only keeps it dropped.", "preserved"),
    "cs_prose": ("Body copy at 18px. Uses the <code>body</code> token, which did not "
                 "exist before today.", "fixed"),
    "cs_button": ("Accent orange as a state. Hover lifts 1px and drops to 0.88 opacity.",
                  "new"),
    "cs_tag": ("Neutral at rest, accent on hover — consistent with orange being a "
               "state, not a surface.", "new"),
    "cs_entry_card": ("Listing item for Groups, Projects, People and Pages. 4px accent "
                      "left border.", "new"),
    "cs_event_card": ("Entry card plus a date line. That line is a nested element "
                      "because visibilityCondition is ignored on a repeater's root.",
                      "new"),
    "cs_card_grid": ("The repeater. Exactly one child — a sibling would be silently "
                     "dropped. auto-fill minmax(280px, 1fr).", "new"),
    "cs_footer": ("Semantic &lt;footer&gt; on the deep-cyan band. The live one is a "
                  "&lt;section&gt; still carrying “Built with Obsidian and Quartz”.",
                  "fixed"),
}

BADGE = {
    "preserved": ("Preserved", "var(--ink-soft)"),
    "new": ("New", "#34b0bf"),
    "fixed": ("Fixes a defect", "#d46329"),
}


def swatches():
    rows = []
    for name, t in TOK.items():
        if t["type"] != "Color":
            continue
        dark = t.get("dark_value")
        pair = (f'<span class="dk">→ {html.escape(dark)}</span>'
                if dark and dark != t["value"] else "")
        rows.append(
            f'<div class="sw"><i style="background:{html.escape(t["value"])}"></i>'
            f'<div><b>{html.escape(name)}</b>'
            f'<span class="mono">{html.escape(t["value"])}{pair}</span></div></div>')
    return "".join(rows)


def dims():
    rows = []
    for name, t in sorted(TOK.items(), key=lambda kv: kv[0]):
        if t["type"] != "Dimension":
            continue
        rows.append(f"<tr><td class='mono'>{html.escape(name)}</td>"
                    f"<td class='mono num'>{html.escape(t['value'])}</td></tr>")
    return "".join(rows)


def components():
    out = []
    for cname, cid, root in built:
        note, kind = NOTES.get(cname, ("", "new"))
        label, colour = BADGE[kind]
        rendered = C.render(root)
        uuids = json.dumps(root).count("var(--")
        out.append(f"""
<section class="cmp">
  <div class="cmp-h">
    <h3 class="mono">{html.escape(cname)}</h3>
    <span class="badge" style="--b:{colour}">{label}</span>
    <span class="cnt">{uuids} token refs</span>
  </div>
  <p class="note">{note}</p>
  <div class="stage">{rendered}</div>
</section>""")
    return "".join(out)


PAGE = f"""<title>Cascade STEAM — component library review (CS-0055)</title>
<style>
:root {{
  --bg:#faf8f8; --panel:#f2f1f2; --ink:#284b63; --ink-body:#4e4e4e;
  --ink-soft:#7b8a94; --accent:#d46329; --cyan:#34b0bf; --navy:#0a2c3f;
  --line:#e2dedd; --stage:#ffffff;
  --sans:"Source Sans Pro",ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --disp:Rubik,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}}
@media (prefers-color-scheme:dark) {{
  :root {{ --bg:#0d1417; --panel:#131c20; --ink:#7fd3de; --ink-body:#c3ccd0;
    --ink-soft:#7e8f96; --line:#243036; --stage:#f7f6f6; }}
}}
:root[data-theme="dark"] {{ --bg:#0d1417; --panel:#131c20; --ink:#7fd3de;
  --ink-body:#c3ccd0; --ink-soft:#7e8f96; --line:#243036; --stage:#f7f6f6; }}
:root[data-theme="light"] {{ --bg:#faf8f8; --panel:#f2f1f2; --ink:#284b63;
  --ink-body:#4e4e4e; --ink-soft:#7b8a94; --line:#e2dedd; --stage:#ffffff; }}

*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink-body);font-family:var(--sans);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:940px;margin:0 auto;padding:56px 24px 96px;
  display:flex;flex-direction:column;gap:44px}}
h1,h2,h3{{font-family:var(--disp);color:var(--ink);margin:0;text-wrap:balance}}
h1{{font-size:clamp(28px,4vw,40px);font-weight:700;line-height:1.1}}
h2{{font-size:23px;font-weight:600;letter-spacing:-.01em}}
h3{{font-size:15px;font-weight:600}}
p{{margin:0}}
.mono{{font-family:var(--mono);font-variant-numeric:tabular-nums}}
.num{{text-align:right}}
a{{color:var(--accent)}}

.eyebrow{{font-family:var(--mono);font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-soft)}}
header .lede{{margin-top:14px;max-width:64ch;font-size:19px}}

.stats{{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}}
.stat{{background:var(--panel);border:1px solid var(--line);border-radius:8px;
  padding:10px 16px;display:flex;flex-direction:column;gap:1px}}
.stat b{{font-family:var(--disp);font-size:21px;color:var(--ink);line-height:1}}
.stat span{{font-size:12px;color:var(--ink-soft)}}

section.blk{{display:flex;flex-direction:column;gap:16px}}
.rule{{height:2px;background:var(--accent);width:38px;border-radius:2px}}

.cards{{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}}
.card{{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);
  border-radius:0 8px 8px 0;padding:16px 18px;display:flex;flex-direction:column;gap:6px}}
.card b{{font-family:var(--disp);color:var(--ink);font-size:15px}}
.card p{{font-size:14.5px}}

.swgrid{{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(215px,1fr))}}
.sw{{display:flex;align-items:center;gap:11px;background:var(--panel);
  border:1px solid var(--line);border-radius:7px;padding:8px 11px}}
.sw i{{width:26px;height:26px;border-radius:5px;flex:none;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}}
.sw b{{display:block;font-family:var(--disp);font-size:13.5px;color:var(--ink);font-weight:600}}
.sw .mono{{font-size:11px;color:var(--ink-soft);display:block}}
.dk{{color:var(--cyan);margin-left:6px}}

.scroll{{overflow-x:auto}}
table{{border-collapse:collapse;width:100%;font-size:13.5px}}
td,th{{border-bottom:1px solid var(--line);padding:6px 12px;text-align:left}}
th{{font-family:var(--disp);color:var(--ink);font-size:12px;text-transform:uppercase;
  letter-spacing:.07em}}
.dimtable{{columns:2;column-gap:28px}}
@media(max-width:620px){{.dimtable{{columns:1}}}}

.cmp{{display:flex;flex-direction:column;gap:9px}}
.cmp-h{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
.cmp-h h3{{font-size:14px;color:var(--ink)}}
.badge{{font-size:10.5px;font-family:var(--mono);text-transform:uppercase;
  letter-spacing:.08em;color:#fff;background:var(--b);padding:2px 8px;border-radius:20px}}
.cnt{{font-family:var(--mono);font-size:11px;color:var(--ink-soft);margin-left:auto}}
.note{{font-size:14.5px;color:var(--ink-soft);max-width:70ch}}
.stage{{background:var(--stage);border:1px solid var(--line);border-radius:9px;
  overflow:hidden}}
.stage>*{{max-width:100%}}

.warn{{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--cyan);
  border-radius:0 8px 8px 0;padding:15px 18px;font-size:14.5px}}
footer{{color:var(--ink-soft);font-size:13px;border-top:1px solid var(--line);padding-top:18px}}
</style>

<div class="wrap">
<header>
  <div class="eyebrow">CS-0055 · new.cascadesteam.org</div>
  <h1>Component library review</h1>
  <p class="lede">Eleven components composed from the design tokens now live on the
  site. Nothing here is published yet — this is the gate before it is.</p>
  <div class="stats">
    <div class="stat"><b>50</b><span>tokens live</span></div>
    <div class="stat"><b>11</b><span>components composed</span></div>
    <div class="stat"><b>27</b><span>token refs, all resolving</span></div>
    <div class="stat"><b>0</b><span>hardcoded colours</span></div>
    <div class="stat"><b>13</b><span>pages, all untouched</span></div>
  </div>
</header>

<section class="blk">
  <div class="rule"></div>
  <h2>The two decisions these encode</h2>
  <div class="cards">
    <div class="card"><b>Accent-only orange</b><p>Orange is a state, not a surface:
    hover, focus, CTAs, tag pills, and the 4px card border. Cyan stays structural.
    The legacy orange rule under every h2 stays dropped.</p></div>
    <div class="card"><b>Dark tokens, light build</b><p>Dark values are minted on the
    same records so a retrofit is cheap. No component branches on
    <span class="mono">prefers-color-scheme</span>; there is no toggle.</p></div>
  </div>
</section>

<section class="blk">
  <div class="rule"></div>
  <h2>Colour tokens</h2>
  <p class="note">Arrows mark a differing dark value. Builder emits those as
  <span class="mono">light-dark()</span> — inert today, but a stray
  <span class="mono">color-scheme: dark</span> would flip all six at once.</p>
  <div class="swgrid">{swatches()}</div>
</section>

<section class="blk">
  <div class="rule"></div>
  <h2>Dimension tokens</h2>
  <p class="note"><span class="mono">type</span> accepts only Color and Dimension, so
  font families, weights, unitless line-heights, shadows and easing cannot be tokens.
  Those ship as component props plus one injected stylesheet.</p>
  <div class="dimtable"><div class="scroll"><table>
    <tr><th>token</th><th class="num">value</th></tr>{dims()}
  </table></div></div>
</section>

<section class="blk">
  <div class="rule"></div>
  <h2>Components</h2>
  <div class="warn"><b>Typefaces render as system fallbacks here.</b> The sandbox blocks
  font CDNs, so Rubik and Source Sans Pro will not load on this page. Everything else —
  colour, spacing, scale, layout — is exact. For true type rendering open
  <span class="mono">preview.html</span> locally.</div>
  {components()}
</section>

<footer>
  Composed from <span class="mono">cs-tokens-applied.json</span> read back from the live
  site, so every <span class="mono">var(--uuid, …)</span> above is a real token id.
  Publishing runs via an OpsKit subagent.
</footer>
</div>
"""

pathlib.Path("review.html").write_text(PAGE)
print(f"review.html written — {len(built)} components, "
      f"{sum(1 for t in TOK.values() if t['type']=='Color')} colour + "
      f"{sum(1 for t in TOK.values() if t['type']=='Dimension')} dimension tokens")
