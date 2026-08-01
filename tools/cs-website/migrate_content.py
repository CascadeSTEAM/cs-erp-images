#!/usr/bin/env python3
"""
Cascade STEAM content migration — CS-0055, step 4 (local phase).

Reads the legacy Quartz vault (~/Projects/cascadesteam.github.io) and emits
`Website Entry` records plus an asset manifest, ready for an OpsKit subagent to
insert into new.cascadesteam.org.

  ./migrate_content.py --src ~/Projects/cascadesteam.github.io \
                       --out entries.json --assets assets.json [--report]

Emits data only. Nothing here touches a live site.

Obsidian-isms handled, because Frappe understands none of them:
  ![[image.png]]            -> <img src="/files/image.png">
  ![[img.jpeg|image-right]] -> portrait (the legacy float is dropped; cs/profile-card)
  [[Page]] / [[Page|label]] -> <a href="/route">
  <!-- ... -->              -> stripped (draft content, not published)
"""

import argparse
import json
import pathlib
import re
import sys
import unicodedata

import markdown
import yaml

# Directory -> entry_type. Order matters: Leadership is checked before About.
TYPE_BY_DIR = [
    ("About/Leadership", "Person"),
    ("Groups", "Group"),
    ("Projects", "Project"),
    ("About", "Page"),
]

# Handled as purpose-built Builder pages, not Website Entry records.
SKIP = {"index.md", "Events/index.md", "About/Leadership/index.md",
        "Groups/index.md", "Projects/index.md", "About/index.md"}

# Quartz internals that leak into the public sitemap because ignorePatterns says
# "templates" while the directory is "_templates". Never migrate these.
NEVER = ("assets/", "internal/", "_templates", "fragments")

DOC_SUFFIXES = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".zip"}
IMG_SUFFIXES = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"}
ASSET_SUFFIXES = DOC_SUFFIXES | IMG_SUFFIXES

# Legacy section indexes -> the Builder pages that will serve them.
SECTION_ROUTES = {
    "groups": "community-groups",
    "projects": "community-projects",
    "events": "events",
    "about": "about",
    "about/leadership": "leadership",
    "leadership": "leadership",
}


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def split_frontmatter(raw):
    m = re.match(r"^---\n(.*?)\n---\n?", raw, re.S)
    if not m:
        return {}, raw
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        print(f"    ! unparseable frontmatter: {e}", file=sys.stderr)
        fm = {}
    return fm, raw[m.end():]


def pick_route(fm, path, entry_type):
    """Prefer the site's own alias — those are the live public URLs and keeping
    them preserves every inbound link. Fall back to a slug of the title."""
    for alias in (fm.get("aliases") or []):
        a = str(alias).strip().lstrip("/")
        if a:
            return a
    if fm.get("permalink"):
        return str(fm["permalink"]).strip().lstrip("/")
    return slugify(fm.get("title") or path.stem)


def legacy_routes(path):
    """Nested title-cased paths the sitemap exposes, e.g. Groups/Cyber. These become
    redirects so nothing 404s after cutover."""
    rel = path.with_suffix("")
    parts = [p for p in rel.parts if p not in (".",)]
    return ["/".join(parts)] if len(parts) > 1 else []


class Body:
    """Converts one Obsidian markdown body to HTML, collecting asset references."""

    def __init__(self, route_index, asset_index, rel=None):
        self.routes = route_index
        self.assets = asset_index
        # The file being converted, so `index` / `index.md` can resolve against the
        # section that contains it rather than defaulting to the site root.
        self.section = str(rel.parent).strip(".").strip("/").lower() if rel else ""
        # Destinations this converter itself emits. `rewrite_links()` runs over the
        # HTML *after* the wikilink pass, so without this it re-resolves links that
        # were already rewritten — `[[Projects/index]]` becomes `/community-projects`
        # and is then reported unresolved because that is a destination, not a source.
        self.known_routes = ({str(r).lower() for r in route_index.values()}
                             | {v.lower() for v in SECTION_ROUTES.values()})
        self.used_assets = set()
        self.unresolved_links = []
        self.dropped_tag_links = []
        self.portrait = None

    def _index_route(self, ref):
        """`index`, `index.md`, `Section/index` -> the section's Builder page.

        A bare `index` is NOT the site root: `Groups/Engineering.md` says
        "[Community Group](index.md)", meaning the Groups index. Resolve it against
        the containing directory and only fall back to `/` at the vault root.
        """
        low = ref.lower().rstrip("/")
        if low in ("index", "index.md"):
            sect = self.section
        elif low.endswith(("/index", "/index.md")):
            sect = low.rsplit("/", 1)[0]
        else:
            return None
        if not sect:
            return "/"
        route = SECTION_ROUTES.get(sect)
        return f"/{route}" if route else None

    def _asset_href(self, name):
        base = name.split("/")[-1]
        self.used_assets.add(base)
        return f"/files/{base}"

    def _embed(self, m):
        target = m.group(1)
        name, _, alias = target.partition("|")
        name = name.strip()
        if alias.strip() == "image-right":
            # Legacy float; the portrait now belongs to cs/profile-card, so pull it
            # out of the flow rather than emitting the old right-floated <img>.
            self.portrait = self._asset_href(name)
            return ""
        return f'<img src="{self._asset_href(name)}" alt="{pathlib.Path(name).stem}">'

    def _link(self, m):
        target = m.group(1)
        name, _, label = target.partition("|")
        name = name.strip()
        text = (label.strip() or name.split("/")[-1])

        # Document links. Obsidian uses the same [[..]] syntax for pages and files,
        # so a PDF/doc target must be routed to /files or the org's prospectus,
        # bylaws, articles of incorporation and flyers silently become plain text.
        if pathlib.Path(name).suffix.lower() in DOC_SUFFIXES:
            base = name.split("/")[-1]
            if base in self.assets:
                self.used_assets.add(base)
                stem = pathlib.Path(base).stem
                return (f'<a href="/files/{base}" target="_blank" '
                        f'rel="noopener">{text if label.strip() else stem}</a>')
            self.unresolved_links.append(name)
            return text

        idx = self._index_route(name)
        if idx:
            return f'<a href="{idx}">{text}</a>'

        key = slugify(name.split("/")[-1])
        route = self.routes.get(key) or self.routes.get(slugify(name))
        if not route:
            self.unresolved_links.append(name)
            return text  # degrade to plain text rather than emit a dead link
        return f'<a href="/{route}">{text}</a>'

    # --- ordinary markdown links -------------------------------------------
    # [[wikilinks]] are only half the story. Plain markdown links
    # ([text](../Groups/Cyber)) survive conversion untouched and point at the
    # legacy nested paths, which do not exist on the new site. Left alone they
    # render as dead links, so they are rewritten after conversion.

    def _resolve_ref(self, raw):
        """Legacy href/src -> new URL, or None to unwrap the link entirely."""
        ref = raw.strip()
        if not ref or ref.startswith(
            ("http://", "https://", "mailto:", "tel:", "#", "/files/")
        ):
            return raw

        frag = ""
        if "#" in ref:
            ref, _, frag = ref.partition("#")
            frag = "#" + frag
        ref = re.sub(r"^(?:\.\./)+", "", ref).lstrip("/").rstrip("/")

        if not ref:
            return "/" + frag                       # the site root

        # Already an absolute link to a destination we own — leave it alone.
        if raw.strip().startswith("/") and ref.lower() in self.known_routes:
            return raw

        idx = self._index_route(ref)
        if idx:
            return idx + frag

        # Quartz tag pages have no equivalent here — unwrap to plain text.
        if ref.lower().startswith("tags/") or ref.lower() == "tags":
            self.dropped_tag_links.append(raw)
            return None

        # Assets: any path under assets/, or anything with a file extension.
        base = ref.split("/")[-1]
        if ref.lower().startswith("assets/") or (
            pathlib.Path(base).suffix.lower() in ASSET_SUFFIXES
        ):
            if base in self.assets:
                self.used_assets.add(base)
                return f"/files/{base}{frag}"
            self.unresolved_links.append(raw)
            return raw

        # Section indexes (Groups/, About/Leadership/, ...) before entry lookup,
        # so a bare section name doesn't slug-match an entry of the same name.
        sect = SECTION_ROUTES.get(ref.lower())
        if sect:
            return f"/{sect}{frag}"

        route = (self.routes.get(slugify(base))
                 or self.routes.get(slugify(ref)))
        if route:
            return f"/{route}{frag}"

        self.unresolved_links.append(raw)
        return raw

    def _rewrite_attr(self, m):
        attr, quote, value = m.group(1), m.group(2), m.group(3)
        new = self._resolve_ref(value)
        if new is None:
            return f'{attr}={quote}\x00DROP\x00{quote}'
        return f"{attr}={quote}{new}{quote}"

    def rewrite_links(self, html):
        html = re.sub(r'\b(href|src)=(["\'])(.*?)\2', self._rewrite_attr, html)
        # Unwrap anchors whose target has no equivalent, keeping their text.
        html = re.sub(r'<a\b[^>]*href=["\']\x00DROP\x00["\'][^>]*>(.*?)</a>',
                      r"\1", html, flags=re.S)
        return html

    def convert(self, text):
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)      # drop draft content
        text = re.sub(r"!\[\[([^\]]+)\]\]", self._embed, text)  # embeds first
        text = re.sub(r"(?<!!)\[\[([^\]]+)\]\]", self._link, text)
        html = markdown.markdown(
            text, extensions=["extra", "sane_lists", "nl2br"], output_format="html5"
        )
        return self.rewrite_links(html).strip()


def collect(src):
    src = pathlib.Path(src).expanduser()
    files = []
    for p in sorted(src.rglob("*.md")):
        rel = p.relative_to(src)
        s = str(rel)
        if s in SKIP or p.name == "README.md":
            continue
        if any(n in s for n in NEVER) or s.startswith("."):
            continue
        etype = next((t for d, t in TYPE_BY_DIR if s.startswith(d)), None)
        if etype:
            files.append((p, rel, etype))
    return src, files


def build_asset_index(src):
    idx = {}
    for p in src.rglob("*"):
        # ASSET_SUFFIXES, not a narrower literal set: a hardcoded list here
        # silently drops .pptx/.docx attachments that pages legitimately link to.
        if not p.is_file():
            continue
        # Anything under assets/ is by definition an attachment, whatever its
        # suffix — assets/groups/Open-Source/DNS/DNS_Presentation.md is markdown
        # slides that pages link to as a document. `.md` is deliberately NOT added
        # to ASSET_SUFFIXES: that set also drives the "any path with a file
        # extension is an asset" branch in _resolve_ref, so widening it there would
        # turn every ordinary markdown link into an asset lookup.
        under_assets = "assets" in (part.lower() for part in p.relative_to(src).parts[:-1])
        if p.suffix.lower() in ASSET_SUFFIXES or (under_assets and p.suffix.lower() == ".md"):
            idx.setdefault(p.name, p)
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", default="entries.json")
    ap.add_argument("--assets", default="assets.json")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()

    src, files = collect(a.src)
    asset_index = build_asset_index(src)

    # Pass 1 — routes, so wikilinks in pass 2 can resolve.
    meta = []
    route_index = {}
    for p, rel, etype in files:
        fm, body = split_frontmatter(p.read_text(encoding="utf-8"))
        route = pick_route(fm, rel, etype)
        meta.append((p, rel, etype, fm, body, route))
        route_index[slugify(fm.get("title") or p.stem)] = route
        route_index[slugify(p.stem)] = route
        route_index[slugify(str(rel.with_suffix("")))] = route

    # Pass 2 — convert.
    entries, all_assets, unresolved, dupes = [], set(), [], {}
    for p, rel, etype, fm, body, route in meta:
        conv = Body(route_index, asset_index, rel)
        html = conv.convert(body)
        all_assets |= conv.used_assets
        unresolved += [(str(rel), u) for u in conv.unresolved_links]
        dupes.setdefault(route, []).append(str(rel))

        # Obsidian writes inline tags as `#artificial-intelligence`; the leading
        # hash is syntax, not part of the tag. Left on, it mints a distinct core
        # `Tag` record that will never match the same tag written without it.
        tags = [str(t).lstrip("#").strip() for t in (fm.get("tags") or [])]
        tags = [t for t in tags if t]
        entry = {
            "doctype": "Website Entry",
            "title": fm.get("title") or p.stem,
            "entry_type": etype,
            "route": route,
            "summary": fm.get("description") or "",
            "body": html,
            # 31 of 37 banners are the same logo, so a per-page banner is only
            # recorded when the page actually embeds distinct art.
            "banner": conv.portrait or None,
            "tags": [t for t in tags if not t.startswith("skills/")],
            "skills": [t.split("/", 1)[1] for t in tags if t.startswith("skills/")],
            "published": bool(fm.get("publish", True)) and not fm.get("draft"),
            "sort_order": 0,
            "_source_file": str(rel),
            "_legacy_routes": legacy_routes(rel),
            "_aliases": [str(x).lstrip("/") for x in (fm.get("aliases") or [])],
        }
        if etype == "Person":
            entry["role_title"] = fm.get("board_role") or ""
            entry["linkedin"] = fm.get("linked-in") or fm.get("linkedin") or ""
            entry["photo"] = conv.portrait
        entries.append(entry)

    missing = sorted(n for n in all_assets if n not in asset_index)
    assets = {
        "upload": [
            {"name": n, "source": str(asset_index[n].relative_to(src))}
            for n in sorted(all_assets) if n in asset_index
        ],
        "missing": missing,
    }

    pathlib.Path(a.out).write_text(json.dumps(entries, indent=2, ensure_ascii=False))
    pathlib.Path(a.assets).write_text(json.dumps(assets, indent=2))

    by_type = {}
    for e in entries:
        by_type[e["entry_type"]] = by_type.get(e["entry_type"], 0) + 1

    print(f"entries: {len(entries)}  -> {a.out}")
    for k in sorted(by_type):
        print(f"   {k:8s} {by_type[k]}")
    print(f"assets:  {len(assets['upload'])} to upload -> {a.assets}")

    collisions = {r: f for r, f in dupes.items() if len(f) > 1}
    unpublished = [e["_source_file"] for e in entries if not e["published"]]
    redirects = sum(len(e["_legacy_routes"]) + len(e["_aliases"]) for e in entries)

    print(f"redirects to create: {redirects}")
    if collisions:
        print(f"\n!! ROUTE COLLISIONS ({len(collisions)}) — must resolve before insert:")
        for r, f in collisions.items():
            print(f"   /{r}  <-  {', '.join(f)}")
    if missing:
        print(f"\n!! MISSING ASSETS ({len(missing)}): {', '.join(missing)}")
    if unpublished:
        print(f"\n   unpublished (publish:false/draft): {', '.join(unpublished)}")
    if unresolved and a.report:
        print(f"\n   unresolved wikilinks ({len(unresolved)}), rendered as plain text:")
        for f, u in unresolved[:20]:
            print(f"     {f}: [[{u}]]")

    if collisions or missing:
        print("\nExit 1 — resolve the issues above before the insert step.")
        return 1
    print("\nClean. Ready for the OpsKit insert step.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
