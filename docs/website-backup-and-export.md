# Backing up & downloading a Frappe Builder website

How to back up, export, or download a website running on a Frappe/ERPNext instance
with **Frappe Builder** (e.g. `new.cascadesteam.org`). There are three levels, each
for a different purpose — pick by what you actually need.

> **Access note:** the `bench` commands below run on the live server. Per this repo's
> policy ([`AGENTS.md`](../AGENTS.md)), they are executed **via a subagent in the
> OpsKit project**, not directly. The commands are shown here so you know what's run
> and can reproduce them.

## At a glance

| Level | What you get | Editable? | Use it for |
|-------|--------------|-----------|-----------|
| **1. Full site backup** (Frappe) | Whole database + all uploaded files | Yes (restore to a Frappe site) | Disaster recovery, migration, "real" backup |
| **2. Builder export** (Builder/Frappe) | The Builder pages/components/tokens as JSON | Yes (re-publish to any Builder) | Move/clone the *website* between instances |
| **3. Static HTML snapshot** | Rendered HTML + assets | No | Archive, offline copy, screenshots |

---

## 1. Full site backup — the real backup (Frappe)

This is the authoritative backup. Everything the website consists of — all
**Builder Pages, Components, and Variables**, plus every other doctype and all
uploaded files — lives in the site's database and file store, so one site backup
captures the lot.

```bash
bench --site new.cascadesteam.org backup --with-files
```

Produces, in `sites/new.cascadesteam.org/private/backups/`:

- `*-database.sql.gz` — the full database (contains all Builder content)
- `*-files.tar` — public files (images, the logo, uploads)
- `*-private-files.tar` — private files

**Download the archive** from the web UI: in the Desk, search **"Download Backups"**
in the awesomebar (or **Settings → Download Backups**) to grab the latest set without
shell access.

**Restore** onto a Frappe site:

```bash
bench --site <target-site> restore <...-database.sql.gz> \
  --with-public-files <...-files.tar> \
  --with-private-files <...-private-files.tar>
```

**Automate it.** Frappe's scheduler can take **daily backups** automatically, and they
can be pushed **offsite** (S3, Dropbox, or Google Drive via built-in/community
integrations). Recommended for anything you'd hate to lose.

---

## 2. Builder export — the editable website (Builder / Frappe)

The website's building blocks are ordinary Frappe doctypes:

- **Builder Page** — one per route; the layout lives in its `blocks` JSON
- **Builder Component** — reusable pieces (e.g. the shared header/footer)
- **Builder Variable** — design tokens (the brand palette, referenced as `var(--…)`)

You can export just these (portable to another Builder instance) in any of these ways:

- **Desk list view** → open the *Builder Page* / *Builder Component* / *Builder
  Variable* list → **Menu → Export** (JSON/CSV).
- **Fixtures** — in developer mode, `bench export-fixtures` writes the records to JSON.
- **REST API** — `GET /api/resource/Builder Page/<name>` returns the page including its
  `blocks`.

### You already have a re-publishable export

The `builder-site-deploy` pipeline (in `.opencode/skills/builder-site-deploy/`) produces
exactly this, as portable JSON:

```
<site-build>/
  index.json          route → page mapping
  pages-json/*.json   one Builder block tree per page
  components.json     header/footer components
  tokens.json         design-token (Builder Variable) definitions
```

`create-pages.py --index <index.json>` re-publishes that set onto **any** Frappe Builder
instance (uploading assets, creating tokens/components, publishing pages, setting the
home page). So this JSON *is* a backup of the editable website — keep a copy somewhere
durable (git, object storage) if you want to rebuild the exact site without re-crawling.

---

## 3. Static HTML snapshot — an offline mirror

Published Builder pages are server-rendered HTML, so you can pull a static copy:

```bash
# generic tools
wget --mirror --convert-links --page-requisites https://new.cascadesteam.org/
# or httrack https://new.cascadesteam.org/

# or the skill's crawler (content only, follows internal links, skips JS)
./crawl.py https://new.cascadesteam.org /path/to/snapshot
```

This gives HTML + CSS + images you can archive or view offline. It is **not** editable
in Builder — it's a snapshot of the rendered result, not the block definitions.

---

## Which should I use?

- **Protect against loss / move the whole instance** → **Level 1** (full site backup),
  and schedule it.
- **Copy or clone the *website* to another Builder instance** → **Level 2** (Builder
  export JSON — you already have the pipeline output).
- **Keep an offline/archived copy of how it looks** → **Level 3** (static snapshot).

For most "back up the website" intents, do **Level 1 with `--with-files` on a schedule**,
and additionally stash the **Level 2** JSON export so the editable site is reproducible.
