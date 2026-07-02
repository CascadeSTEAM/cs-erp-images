(function () {
  'use strict';

  const API = '/api/plugin/erp-images';

  const DEFAULT_HELP = `# 🐳 ERP Images

Manage Frappe/ERPNext Docker images for your environments — all from inside DocWright.

## What this plugin does

- **Create use cases** — define a named combination of Frappe apps (e.g. *helpdesk*, *cs*, *nonprofit*)
- **Build locally** — test your image on this machine before publishing
- **Version automatically** — tags follow \`v{frappe}.{release}.{patch}\` (see ⓘ versioning in the Deploy panel)
- **Deploy** — push to a configured target environment via Ansible (coming soon)
- **Publish** — open a GitHub PR to add the use case to the shared image registry

## Getting started

1. Click **➕ New Use Case** in the left panel
2. Name it, pick apps, click **💾 Save locally**
3. Select it in the left panel and click **🔨 Build**
4. Once built, click **🚀 Deploy** to push it to a target

## Tag format

\`\`\`
v16.1.0
│  │ └── patch  — rebuild with dependency/security updates only (safe drop-in)
│  └────── release — app list changed or breaking config (existing deploys may need rebuild)
└────────── Frappe major version
\`\`\`

---
*Edit this page with the ✏️ button above.*`;

  // ── State ──────────────────────────────────────────────────────────────────

  const state = {
    view: 'help',   // 'help' | 'create' | 'detail'

    sidebar: {
      localOpen:      true,
      remoteOpen:     false,
      localExpanded:  new Set(),
      remoteExpanded: new Set(),
      selUc:    null,   // selected use-case name
      selTag:   null,   // selected tag string
      selSource: null,  // 'local' | 'remote'
    },

    local:  { loading: true,  useCases: [], error: null },
    remote: { loading: false, packages: [], available: false, error: null, loaded: false },

    help: { content: null, editing: false, editContent: '', saving: false },

    create: {
      phase: 'loading',
      catalogue: [], name: '', description: '', frappeMajor: '16',
      selectedApps: new Map(), nextVersion: null,
      loadError: null, saveResult: null, saving: false,
      editMode: false, editName: null,
      originalAppSet: new Set(), showChangeWarning: false,
    },

    detail: {
      targets: [], target: 'local',
      nextBuildTag: '', deployTag: '',
      building: false, buildLog: [], buildDone: false, buildFailed: false,
      confirmDelete: null, deleting: false,
      confirmDeleteTag: null, deletingTag: false,
      updateCheck: null,   // null=unchecked, {loading, hasUpdates, updates, imageCreated}
    },

    deploy: {
      // pre-filled from detail view
      ucName: null, tag: null,
      // saved sites
      sites: [], loadingSites: false,
      // form — new or editing saved site
      selectedSite: '',   // '' = new, or site.name
      name: '', host: '', user: 'root', proxy: '', workdir: '/home/frappe', notes: '',
      saving: false, saveError: null,
      // run
      running: false, log: [], done: false, failed: false,
      showVars: false,
    },
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const root = () => document.getElementById('plugin-root');

  // ── Top-level render ───────────────────────────────────────────────────────

  // ── Plugin registry ────────────────────────────────────────────────────────
  // Registers with DocWright via registerView() so the layout calls mount(el)
  // when the activity bar icon is activated — no getElementById needed.

  let _sidebarEl = null; // element provided by DocWright's ViewContainerMount

  function mountSidebar() {
    if (!_sidebarEl) return;
    _sidebarEl.innerHTML = renderSidebar();
    bindSidebar();
  }

  function registerPlugin() {
    window.__docwright?.registerView('erp-images', {
      mount(el)    { _sidebarEl = el; mountSidebar(); },
      unmount()    { if (_sidebarEl) _sidebarEl.innerHTML = ''; _sidebarEl = null; },
      onActivate() { mountSidebar(); autoNavigate(); },
    });
  }

  // ── Bridge accessor ────────────────────────────────────────────────────────
  // Falls back through older DocWright host shapes, but only accepts a
  // candidate that actually exposes bridge methods — otherwise unguarded
  // callers like `bridge()?.toast(...)` would throw instead of no-op'ing.
  const isBridgeLike = b => !!b && (
    typeof b.toast === 'function' || typeof b.notify === 'function' ||
    typeof b.navigate === 'function' || typeof b.goto === 'function' ||
    typeof b.claimRightPanel === 'function' || typeof b.setRightPanel === 'function'
  );
  const bridge = () =>
    [window.__docwright?.bridge, window.__docwright_host, window.__docwright].find(isBridgeLike) ?? null;

  function autoNavigate() {
    const b = bridge();
    const nav = b?.navigate || b?.goto;
    if (nav && window.location.pathname !== '/plugin/erp-images') {
      nav.call(b, '/plugin/erp-images' + window.location.search);
    }
  }

  function renderApp() {
    // Main content into #plugin-root (only when on plugin page)
    const mainEl = root();
    if (mainEl) mainEl.innerHTML = renderMain();

    // Refresh sidebar if it's already mounted
    mountSidebar();

    bindAll();
  }

  function renderMain() {
    if (state.view === 'create')  return renderCreateView();
    if (state.view === 'detail')  return renderDetailView();
    if (state.view === 'deploy')  return renderDeployView();
    return renderHelpView();
  }

  // ── SIDEBAR ────────────────────────────────────────────────────────────────

  function renderSidebar() {
    const { sidebar, local, remote } = state;
    return `
      <div class="erp-panel-inner">
        <button class="erp-new-btn" id="erp-new">➕ New Use Case</button>

        <div class="erp-s-section">
          <div class="erp-s-hdr" data-toggle="local">
            <span class="erp-caret">${sidebar.localOpen ? '▼' : '▶'}</span>
            Local
            ${local.loading ? '<span class="erp-s-spin">⟳</span>' : `<span class="erp-s-count">${local.useCases.length}</span>`}
          </div>
          ${sidebar.localOpen ? renderLocalList() : ''}
        </div>

        <div class="erp-s-section">
          <div class="erp-s-hdr" data-toggle="remote">
            <span class="erp-caret">${sidebar.remoteOpen ? '▼' : '▶'}</span>
            Remote (GHCR)
            ${remote.loading ? '<span class="erp-s-spin">⟳</span>'
              : remote.available ? `<span class="erp-s-count">${remote.packages.length}</span>`
              : '<span class="erp-s-muted">token required</span>'}
          </div>
          ${sidebar.remoteOpen ? renderRemoteList() : ''}
        </div>
      </div>`;
  }

  function renderLocalList() {
    const { local, sidebar } = state;
    if (local.error) return `<div class="erp-s-error">${esc(local.error)}</div>`;
    if (!local.useCases.length) return `<div class="erp-s-empty">No local use cases yet</div>`;
    return local.useCases.map(uc => {
      const exp   = sidebar.localExpanded.has(uc.name);
      const isSel = sidebar.selSource === 'local' && sidebar.selUc === uc.name;
      return `
        <div class="erp-s-uc">
          <div class="erp-s-uc-hdr ${isSel && !sidebar.selTag ? 'erp-s-sel' : ''}"
               data-uc="${esc(uc.name)}" data-source="local">
            <span class="erp-caret">${exp ? '▼' : '▶'}</span>
            <span class="erp-s-uc-name">${esc(uc.name)}</span>
            <button class="erp-s-icon" data-edit="${esc(uc.name)}" title="Edit">✏️</button>
            <button class="erp-s-icon erp-s-del" data-del="${esc(uc.name)}" title="Delete">🗑️</button>
          </div>
          ${exp ? `
            <div class="erp-s-tags">
              ${uc.builtTags.length
                ? uc.builtTags.map(t => `
                  <div class="erp-s-tag ${sidebar.selSource==='local'&&sidebar.selUc===uc.name&&sidebar.selTag===t ? 'erp-s-sel' : ''}"
                       data-uc="${esc(uc.name)}" data-tag="${esc(t)}" data-source="local">${esc(t)}</div>`
                ).join('')
                : `<div class="erp-s-no-tags">No builds yet — select to build</div>`}
            </div>` : ''}
        </div>`;
    }).join('');
  }

  function renderRemoteList() {
    const { remote } = state;
    if (!remote.available) return `<div class="erp-s-empty">Add <code>GITHUB_TOKEN</code> to <code>.env</code> to browse GHCR images</div>`;
    if (remote.error)     return `<div class="erp-s-error">${esc(remote.error)}</div>`;
    if (!remote.packages.length) return `<div class="erp-s-empty">No erp-* packages found</div>`;
    return remote.packages.map(pkg => {
      const exp   = state.sidebar.remoteExpanded.has(pkg.name);
      const isSel = state.sidebar.selSource === 'remote' && state.sidebar.selUc === pkg.name;
      return `
        <div class="erp-s-uc">
          <div class="erp-s-uc-hdr ${isSel && !state.sidebar.selTag ? 'erp-s-sel' : ''}"
               data-uc="${esc(pkg.name)}" data-source="remote">
            <span class="erp-caret">${exp ? '▼' : '▶'}</span>
            <span class="erp-s-uc-name">${esc(pkg.name)}</span>
          </div>
          ${exp ? `
            <div class="erp-s-tags">
              ${pkg.tags.map(t => `
                <div class="erp-s-tag ${state.sidebar.selSource==='remote'&&state.sidebar.selUc===pkg.name&&state.sidebar.selTag===t ? 'erp-s-sel' : ''}"
                     data-uc="${esc(pkg.name)}" data-tag="${esc(t)}" data-source="remote">${esc(t)}</div>`
              ).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
  }

  // ── HELP VIEW ──────────────────────────────────────────────────────────────

  function renderHelpView() {
    const h = state.help;
    const content = h.content ?? DEFAULT_HELP;
    if (h.editing) {
      return `
        <div class="erp-help">
          <div class="erp-help-toolbar">
            <span class="erp-help-title">Edit help page</span>
            <button class="erp-btn erp-btn-ghost" id="help-cancel">Cancel</button>
            <button class="erp-btn erp-btn-save" id="help-save" ${h.saving ? 'disabled' : ''}>
              ${h.saving ? '⏳ Saving…' : '💾 Save'}
            </button>
            ${h.content !== null
              ? `<button class="erp-btn erp-btn-ghost" id="help-reset">↺ Reset to default</button>`
              : ''}
          </div>
          <textarea class="erp-help-editor" id="help-editor">${esc(content)}</textarea>
        </div>`;
    }
    return `
      <div class="erp-help">
        <div class="erp-help-toolbar">
          <span class="erp-help-title">ERP Images</span>
          <button class="erp-btn erp-btn-ghost" id="help-edit">✏️ Edit</button>
        </div>
        <div class="erp-help-body">${renderMarkdown(content)}</div>
      </div>`;
  }

  function renderMarkdown(md) {
    // Minimal markdown → HTML (headings, code blocks, inline code, bold, paragraphs)
    return md
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/```([\s\S]*?)```/g, (_,c) => `<pre class="erp-code">${c.trim()}</pre>`)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/^(?!<[hup]|<li|<pre|<hr)(.+)$/gm, '$1')
      .replace(/^(.)/m, '<p>$1')
      + '</p>';
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────

  function renderDetailView() {
    const { sidebar, detail, local } = state;
    const { selUc, selTag, selSource } = sidebar;
    const uc = local.useCases.find(u => u.name === selUc);
    const isBuilt = uc && uc.builtTags.length > 0;

    return `
      <div class="erp-detail">

        ${/* ── Header: name + quick-delete ── */''}
        <div class="erp-dh">
          <div class="erp-dh-left">
            <span class="erp-dh-name">${esc(selUc)}</span>
            ${selSource === 'remote' ? '<span class="erp-badge erp-badge-remote">GHCR</span>' : ''}
            ${uc ? `<span class="erp-dh-meta">${uc.apps.length} app${uc.apps.length!==1?'s':''} · Frappe v${esc(sidebar.selTag?.match(/^v(\d+)/)?.[1] || '16')}</span>` : ''}
          </div>
          ${selSource === 'local' ? `<button class="erp-btn-icon-danger" id="dp-delete-uc" title="Delete use case">🗑️</button>` : ''}
        </div>

        ${/* ── Delete confirmation ── */''}
        ${detail.confirmDelete ? `
        <div class="erp-warn-dialog">
          <div class="erp-warn-dialog-icon">🗑️</div>
          <div class="erp-warn-dialog-body">
            <div class="erp-warn-dialog-title">Delete <code>${esc(selUc)}</code>?</div>
            <div class="erp-warn-dialog-msg">Removes <code>use-cases/${esc(selUc)}/</code> and all local Docker images. Use cases pushed to GitHub are protected.</div>
          </div>
          <div class="erp-warn-dialog-actions">
            <button class="erp-btn erp-btn-ghost" id="dp-del-cancel">Cancel</button>
            <button class="erp-btn erp-btn-danger" id="dp-del-confirm" ${detail.deleting?'disabled':''}>
              ${detail.deleting ? '⏳ Deleting…' : '🗑️ Delete permanently'}
            </button>
          </div>
        </div>` : ''}

        ${/* ── Status card: selected tag ── */''}
        <div class="erp-status-card ${isBuilt ? 'erp-status-built' : 'erp-status-unbuilt'}">
          ${isBuilt
            ? (selTag
                ? `<div class="erp-status-tag-row">
                 <span class="erp-status-tag">✅ ${esc(selTag)}</span>
                 ${selSource === 'local' ? `<button class="erp-tag-del-btn" id="dp-del-tag" title="Remove this local image">🗑️ Remove</button>` : ''}
               </div>
               ${detail.confirmDeleteTag ? `
               <div class="erp-tag-del-confirm">
                 Remove local image <code>${esc(selTag)}</code>? The use case definition stays. Cannot be undone.
                 <div class="erp-tag-del-confirm-btns">
                   <button class="erp-btn erp-btn-ghost erp-btn-sm" id="dp-del-tag-cancel">Cancel</button>
                   <button class="erp-btn erp-btn-danger erp-btn-sm" id="dp-del-tag-confirm" ${detail.deletingTag?'disabled':''}>
                     ${detail.deletingTag ? '⏳ Removing…' : '🗑️ Remove'}
                   </button>
                 </div>
               </div>` : ''}
               <span class="erp-status-note">see Properties panel for details</span>`
                : `<div class="erp-status-tags-row">
                    ${uc.builtTags.map(t => `
                      <label class="erp-tag-chip ${t===detail.deployTag?'erp-tag-chip-sel':''}">
                        <input type="radio" name="dp-tag-pick" value="${esc(t)}" ${t===detail.deployTag?'checked':''}/>
                        ${esc(t)}
                      </label>`).join('')}
                   </div>`)
            : `<span class="erp-status-unbuilt-msg">○ No builds yet — build this use case to deploy it</span>`}
        </div>

        ${selSource === 'local' ? renderLocalActions(uc) : renderRemoteActions()}

        ${/* ── Build output ── */''}
        ${(detail.building || detail.buildLog.length > 0) ? `
        <div class="erp-build-output">
          <div class="erp-build-status ${detail.buildDone?'erp-build-ok':detail.buildFailed?'erp-build-fail':'erp-build-running'}">
            ${detail.buildDone ? '✅ Build complete' : detail.buildFailed ? '❌ Build failed' : '⏳ Building…'}
          </div>
          <pre class="erp-build-log" id="dp-log">${esc(detail.buildLog.join(''))}</pre>
        </div>` : ''}

      </div>`;
  }

  function buildDisabled(d, isBuilt) {
    if (d.building || !d.nextBuildTag) return true;
    if (!isBuilt) return false; // first build — always allow
    const uc = d.updateCheck;
    if (!uc || uc.loading) return true;  // still checking
    return !uc.hasUpdates;               // no updates available
  }

  function renderUpdateStatus(d) {
    const uc = d.updateCheck;
    if (!uc || uc.loading) {
      return `<div class="erp-update-row erp-update-checking">⟳ Checking for updates…</div>`;
    }
    if (!uc.hasImage) return '';
    if (!uc.hasUpdates) {
      return `<div class="erp-update-row erp-update-current">✓ Up to date — no new commits on any branch</div>`;
    }
    const changed = (uc.updates || []).filter(u => u.hasUpdate);
    return `<div class="erp-update-row erp-update-available">
      ⬆ ${changed.length} app${changed.length!==1?'s':''} have new commits:
      ${changed.map(u => `<span class="erp-update-app" title="${esc(u.message||'')}">
        ${esc(u.repo.split('/')[1])}
        ${u.sha ? `<code>${esc(u.sha)}</code>` : ''}
      </span>`).join('')}
    </div>`;
  }

  function renderLocalActions(uc) {
    const d = state.detail;
    const isBuilt = uc && uc.builtTags.length > 0;
    const target = d.targets.find(t => t.id === d.target);
    const targetName = target?.name || d.target;

    return `<div class="erp-da">

      ${/* ── Deploy (primary — shown first when built) ── */isBuilt ? `
      <div class="erp-da-section">
        <div class="erp-da-label">Deploy</div>
        <div class="erp-da-deploy-row">
          <span class="erp-da-to">to</span>
          <select class="erp-select erp-target-select" id="dp-target-select">
            ${d.targets.map(t=>`<option value="${esc(t.id)}" ${t.id===d.target?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
          <button class="erp-btn erp-btn-primary erp-btn-deploy" id="dp-deploy"
            ${(d.building||!d.deployTag)?'disabled':''}>
            🚀 Deploy
          </button>
        </div>
      </div>` : ''}

      ${/* ── Build / Rebuild ── */''}
      <div class="erp-da-section">
        <div class="erp-da-label">
          ${isBuilt ? 'Rebuild' : 'Build'}
          <span class="erp-ver-help" id="dp-ver-help-toggle">ⓘ versioning</span>
        </div>
        <div id="dp-ver-legend" class="erp-ver-legend" style="display:none">
          <strong>v{frappe}.{release}.{patch}</strong><br>
          <span><code>frappe</code> Frappe major version</span><br>
          <span><code>release</code> App list or config changed — may require redeploy</span><br>
          <span><code>patch</code> Updates only — safe drop-in replacement</span><br>
          <em>e.g. v16.1.0 → v16.1.3 → v16.2.0</em>
        </div>
        ${isBuilt ? renderUpdateStatus(d) : ''}
        <div class="erp-da-build-row">
          <div class="erp-da-next">
            <span class="erp-da-next-label">Next tag</span>
            <code class="erp-tag-preview">${esc(d.nextBuildTag || '…')}</code>
          </div>
          <button class="erp-btn erp-btn-build" id="dp-build"
            ${buildDisabled(d, isBuilt) ? 'disabled' : ''}>
            ${d.building ? '⏳ Building…' : isBuilt ? '🔨 Rebuild' : '🔨 Build'}
          </button>
        </div>
      </div>

    </div>`;
  }

  function renderRemoteActions() {
    const d = state.detail;
    const target = d.targets.find(t => t.id === d.target);
    return `<div class="erp-da">
      <div class="erp-da-section">
        <div class="erp-da-label">Deploy</div>
        <div class="erp-da-deploy-row">
          <span class="erp-da-to">to</span>
          <select class="erp-select erp-target-select" id="dp-target-select">
            ${d.targets.map(t=>`<option value="${esc(t.id)}" ${t.id===d.target?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
          <button class="erp-btn erp-btn-primary" id="dp-deploy">🚀 Deploy</button>
        </div>
      </div>
    </div>`;
  }

  // ── DEPLOY VIEW ────────────────────────────────────────────────────────────

  function renderDeployView() {
    const d = state.deploy;
    const image = `ghcr.io/cascadesteam/erp-${d.ucName}:${d.tag}`;
    const site  = d.selectedSite ? d.sites.find(s => s.name === d.selectedSite) : null;
    const host  = site ? site.host  : d.host;
    const user  = site ? site.user  : d.user;
    const proxy = site ? site.proxy : d.proxy;
    const wdir  = site ? site.workdir : d.workdir;

    const sshCmd = [
      'ssh',
      proxy ? `-J ${proxy}` : null,
      `${user || 'root'}@${host || '<host>'}`,
      `"cd ${wdir} && docker compose pull ${image} && docker compose up -d"`,
    ].filter(Boolean).join(' ');

    const ready = !!(d.ucName && d.tag && host);

    return `<div class="erp-wrap">
      <div class="erp-header">
        <span class="erp-header-icon">🚀</span>
        <div>
          <div class="erp-header-title">Deploy</div>
          <div class="erp-header-sub">
            <code>ghcr.io/cascadesteam/erp-${esc(d.ucName)}:${esc(d.tag)}</code>
          </div>
        </div>
        <button class="erp-btn erp-btn-ghost" id="dp2-back" style="margin-left:auto">← Back</button>
      </div>

      ${/* ── Site picker ── */''}
      <div class="erp-section-label" style="margin-top:4px">Target Site</div>
      <div class="erp-field">
        <label class="erp-label" for="dp2-site-sel">Saved sites</label>
        <select id="dp2-site-sel" class="erp-select">
          <option value="">— New site —</option>
          ${d.sites.map(s => `<option value="${esc(s.name)}" ${d.selectedSite===s.name?'selected':''}>${esc(s.name)} (${esc(s.host)})</option>`).join('')}
        </select>
      </div>

      ${/* ── Site form ── */''}
      <form id="dp2-form" class="erp-form" autocomplete="off">
        <div class="erp-row2">
          <div class="erp-field">
            <label class="erp-label" for="dp2-name">Site name <span class="erp-hint">(label)</span></label>
            <input id="dp2-name" class="erp-input" type="text" placeholder="support.cascadesteam.org"
              value="${esc(site ? site.name : d.name)}" ${d.selectedSite ? 'readonly style="opacity:.6"' : ''}/>
          </div>
          <div class="erp-field">
            <label class="erp-label" for="dp2-host">Host IP / hostname</label>
            <input id="dp2-host" class="erp-input" type="text" placeholder="10.10.10.25"
              value="${esc(host)}"/>
          </div>
        </div>
        <div class="erp-row2">
          <div class="erp-field">
            <label class="erp-label" for="dp2-user">SSH user</label>
            <input id="dp2-user" class="erp-input" type="text" placeholder="root" value="${esc(user)}"/>
          </div>
          <div class="erp-field">
            <label class="erp-label" for="dp2-proxy">ProxyJump <span class="erp-hint">(optional)</span></label>
            <input id="dp2-proxy" class="erp-input" type="text" placeholder="vpn.example.org:666" value="${esc(proxy)}"/>
          </div>
        </div>
        <div class="erp-field">
          <label class="erp-label" for="dp2-workdir">Working directory</label>
          <input id="dp2-workdir" class="erp-input" type="text" value="${esc(wdir)}"/>
        </div>
        <div class="erp-field">
          <label class="erp-label" for="dp2-notes">Notes <span class="erp-hint">(optional)</span></label>
          <input id="dp2-notes" class="erp-input" type="text" value="${esc(site ? site.notes : d.notes)}"/>
        </div>
        <div class="erp-actions" style="gap:8px">
          <button type="button" id="dp2-save-site" class="erp-btn erp-btn-ghost"
            ${d.saving ? 'disabled' : ''}>${d.saving ? '⏳ Saving…' : '💾 Save site'}</button>
          ${d.selectedSite ? `<button type="button" id="dp2-del-site" class="erp-btn erp-btn-ghost" style="color:#da3633;border-color:#da3633">🗑 Remove</button>` : ''}
          ${d.saveError ? `<span class="erp-s-error">${esc(d.saveError)}</span>` : ''}
        </div>
      </form>

      ${/* ── Command preview ── */''}
      <div class="erp-section-label" style="margin-top:12px">
        Deploy command
        <button class="erp-copy-btn" id="dp2-copy" title="Copy to clipboard">📋</button>
      </div>
      <pre class="erp-deploy-cmd ${!ready?'erp-deploy-cmd-dim':''}">${esc(sshCmd)}</pre>

      ${/* ── Ansible vars (collapsible) ── */''}
      <div class="erp-section-label" style="cursor:pointer" id="dp2-vars-toggle">
        Ansible vars <span class="erp-ver-help">${d.showVars ? '▲ hide' : '▼ show'}</span>
      </div>
      ${d.showVars ? `
      <pre class="erp-deploy-cmd">${esc(JSON.stringify({
        frappe_image: image,
        site_host:    host || '<host>',
        deploy_user:  user || 'root',
        workdir:      wdir,
      }, null, 2))}</pre>` : ''}

      ${/* ── Run button + log ── */''}
      <div class="erp-actions" style="margin-top:12px">
        <button id="dp2-run" class="erp-btn erp-btn-build"
          ${(!ready || d.running) ? 'disabled' : ''}>
          ${d.running ? '⏳ Deploying…' : '🚀 Run deploy'}
        </button>
        ${!ready ? `<span class="erp-s-muted" style="font-size:11px">Fill in host to enable</span>` : ''}
      </div>

      ${(d.running || d.log.length > 0) ? `
      <div class="erp-build-output">
        <div class="erp-build-status ${d.done?'erp-build-ok':d.failed?'erp-build-fail':'erp-build-running'}">
          ${d.done ? '✅ Deploy complete' : d.failed ? '❌ Deploy failed' : '⏳ Deploying…'}
        </div>
        <pre class="erp-build-log" id="dp2-log">${esc(d.log.join(''))}</pre>
      </div>` : ''}

    </div>`;
  }

  // ── CREATE VIEW ────────────────────────────────────────────────────────────

  function renderCreateView() {
    const c = state.create;
    if (c.phase === 'loading') return '<div class="erp-loading">Loading app catalogue…</div>';
    return `<div class="erp-wrap">
      <div class="erp-header">
        <span class="erp-header-icon">${c.editMode ? '✏️' : '📦'}</span>
        <div>
          <div class="erp-header-title">${c.editMode ? `Edit: ${esc(c.editName)}` : 'New Use Case'}</div>
          <div class="erp-header-sub">${c.editMode ? 'Editing a local use case' : 'Define apps → save locally → build → deploy'}</div>
        </div>
        ${c.editMode ? `<button class="erp-btn erp-btn-ghost" id="eg-cancel-edit" style="margin-left:auto">✕ Cancel</button>` : ''}
      </div>

      ${c.loadError ? `<div class="erp-error">${esc(c.loadError)}</div>` : ''}

      <form id="eg-form" class="erp-form" autocomplete="off">
        <div class="erp-section-label">Use Case</div>
        <div class="erp-row2">
          <div class="erp-field">
            <label class="erp-label" for="eg-name">Name <span class="erp-hint">(kebab-case)</span></label>
            <input id="eg-name" class="erp-input" type="text" placeholder="my-use-case"
              value="${esc(c.name)}" autocomplete="off" spellcheck="false"
              ${c.editMode ? 'readonly style="opacity:.6;cursor:not-allowed"' : ''}/>
          </div>
          <div class="erp-field">
            <label class="erp-label" for="eg-frappe">Frappe</label>
            <select id="eg-frappe" class="erp-select">
              ${['15','16','17'].map(v=>`<option value="${v}" ${c.frappeMajor===v?'selected':''}>v${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="erp-field">
          <label class="erp-label" for="eg-desc">Description</label>
          <textarea id="eg-desc" class="erp-textarea" rows="2" placeholder="What is this image for?">${esc(c.description)}</textarea>
        </div>

        <div class="erp-section-label">App Selection <span class="erp-sel-count">${c.selectedApps.size} selected</span></div>
        ${renderCatalogue()}

        <div class="erp-section-label">Preview</div>
        <div id="eg-preview-wrap">${renderPreview()}</div>

        ${c.saveResult ? `
        <div class="erp-saved">
          <div class="erp-saved-title">✅ Saved → <code>${esc(c.saveResult.path)}</code></div>
          ${c.saveResult.nextTag ? `
          <div class="erp-saved-tag">
            Next tag: <code>${esc(c.saveResult.nextTag)}</code>
            <span class="erp-bump-badge erp-bump-${esc(c.saveResult.bumpType)}">
              ${{initial:'🟢 v{frappe}.1.0 — first build', patch:'⚡ patch rebuild', release:'⚠️ release — check deployments'}[c.saveResult.bumpType]||c.saveResult.bumpType}
            </span>
          </div>` : ''}
        </div>` : ''}

        ${c.showChangeWarning ? `
        <div class="erp-warn-dialog">
          <div class="erp-warn-dialog-icon">⚠️</div>
          <div class="erp-warn-dialog-body">
            <div class="erp-warn-dialog-title">App list changed — breaking change</div>
            <div class="erp-warn-dialog-msg">Existing deployments of <strong>${esc(c.editName)}</strong> may behave differently. This requires a <strong>release version bump</strong>.</div>
          </div>
          <div class="erp-warn-dialog-actions">
            <button class="erp-btn erp-btn-ghost" id="eg-warn-cancel">Cancel</button>
            <button class="erp-btn erp-btn-danger" id="eg-warn-confirm">Understood — save with release bump</button>
          </div>
        </div>` : ''}

        <div class="erp-actions">
          <button type="button" id="eg-save" class="erp-btn erp-btn-save"
            ${(c.saving||!c.name||c.selectedApps.size===0)?'disabled':''}>
            ${c.saving ? '⏳ Saving…' : c.editMode ? '💾 Save changes' : '💾 Save locally'}
          </button>
        </div>
      </form>
    </div>`;
  }

  function renderCatalogue() {
    const c = state.create;
    if (!c.catalogue.length) return '<div class="erp-notice">No apps loaded.</div>';
    return c.catalogue.map(cat => `
      <div class="erp-cat">
        <div class="erp-cat-name">${esc(cat.name)}</div>
        <div class="erp-app-list">
          ${cat.apps.map(app => {
            const checked = c.selectedApps.has(app.repo);
            return `<label class="erp-app ${checked?'erp-app-checked':''}">
              <input type="checkbox" class="eg-app-cb"
                data-repo="${esc(app.repo)}" data-branch="${esc(app.branch)}" data-name="${esc(app.name)}"
                ${checked?'checked':''}/>
              <span class="erp-app-icon">${app.statusIcon}</span>
              <span class="erp-app-name">${esc(app.name)}</span>
              <span class="erp-app-ref">${esc(app.repo)}@${esc(app.branch)}</span>
            </label>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  function renderPreview() {
    const c = state.create;
    if (!c.name && c.selectedApps.size === 0) return '<div class="erp-notice">Fill in a name and select apps to see the preview.</div>';
    const json = JSON.stringify([...c.selectedApps.values()].map(a=>({url:`https://github.com/${a.repo}`,branch:a.branch})),null,2);
    return `<div class="erp-preview">
      <div class="erp-preview-meta">${c.nextVersion ? `Next tag: <strong>${esc(c.nextVersion)}</strong>` : 'Fetching next version…'}</div>
      <pre class="erp-code">${esc(json)}</pre>
    </div>`;
  }

  // ── EVENT BINDING ──────────────────────────────────────────────────────────

  function bindAll() {
    // Sidebar binds separately via mountSidebar/watchForSidebar
    if (state.view === 'create') bindCreate();
    if (state.view === 'detail') bindDetail();
    if (state.view === 'help')   bindHelp();
    if (state.view === 'deploy') bindDeploy();
  }

  function bindSidebar() {
    document.querySelector('[data-toggle="local"]')?.addEventListener('click', () => {
      state.sidebar.localOpen = !state.sidebar.localOpen; renderApp();
    });
    document.querySelector('[data-toggle="remote"]')?.addEventListener('click', () => {
      state.sidebar.remoteOpen = !state.sidebar.remoteOpen;
      if (state.sidebar.remoteOpen && !state.remote.loaded) loadRemote();
      renderApp();
    });

    document.getElementById('erp-new')?.addEventListener('click', () => {
      const c = state.create;
      c.editMode = false; c.editName = null; c.name = ''; c.description = '';
      c.selectedApps.clear(); c.saveResult = null; c.showChangeWarning = false;
      state.view = 'create'; autoNavigate(); renderApp(); fetchNextVersion();
    });

    // Use case header click → expand/collapse (or open detail if no tags)
    document.querySelectorAll('.erp-s-uc-hdr').forEach(hdr => {
      hdr.addEventListener('click', e => {
        if (e.target.closest('.erp-s-icon')) return;
        const name   = hdr.dataset.uc;
        const source = hdr.dataset.source;
        const expSet = source === 'local' ? state.sidebar.localExpanded : state.sidebar.remoteExpanded;
        if (expSet.has(name)) expSet.delete(name); else expSet.add(name);
        // If local and no tags, select it and show detail
        const uc = state.local.useCases.find(u => u.name === name);
        if (source === 'local' && uc && uc.builtTags.length === 0) selectUc(name, null, 'local');
        renderApp();
      });
    });

    // Tag click → select + show detail
    document.querySelectorAll('.erp-s-tag').forEach(tag => {
      tag.addEventListener('click', () => selectUc(tag.dataset.uc, tag.dataset.tag, tag.dataset.source));
    });

    // No-tags row click in expanded uc
    document.querySelectorAll('.erp-s-no-tags').forEach(el => {
      el.addEventListener('click', () => {
        const uc = el.closest('.erp-s-uc').querySelector('.erp-s-uc-hdr');
        if (uc) selectUc(uc.dataset.uc, null, 'local');
      });
    });

    // Edit button
    document.querySelectorAll('.erp-s-icon[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); loadUseCase(btn.dataset.edit); });
    });

    // Delete button
    document.querySelectorAll('.erp-s-icon[data-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        selectUc(btn.dataset.del, null, 'local');
        state.detail.confirmDelete = btn.dataset.del;
        renderApp();
      });
    });
  }

  function selectUc(name, tag, source) {
    // Write state to URL so it survives refresh and can be shared
    const url = new URL(window.location.href);
    url.searchParams.set('uc', name);
    if (tag) url.searchParams.set('tag', tag);
    else url.searchParams.delete('tag');
    history.pushState(null, '', url.toString());

    const sb = state.sidebar;
    sb.selUc = name; sb.selTag = tag; sb.selSource = source;
    state.view = 'detail';
    const d = state.detail;
    d.buildLog = []; d.buildDone = false; d.buildFailed = false;
    d.building = false; d.confirmDelete = null; d.nextBuildTag = ''; d.deployTag = '';
    d.updateCheck = null;
    const uc = state.local.useCases.find(u => u.name === name);
    d.deployTag = tag || (uc?.builtTags ?? [])[0] || '';
    if (!d.targets.length) loadTargets();
    if (source === 'local') loadNextBuildTag(name);
    autoNavigate();
    renderApp();
    pushRightPanel(uc ?? null, tag);
    if (source === 'local' && (tag || d.deployTag)) checkUpdates(name, tag || d.deployTag);
  }

  function bindHelp() {
    document.getElementById('help-edit')?.addEventListener('click', () => {
      state.help.editing = true;
      state.help.editContent = state.help.content ?? DEFAULT_HELP;
      renderApp();
    });
    document.getElementById('help-cancel')?.addEventListener('click', () => {
      state.help.editing = false; renderApp();
    });
    document.getElementById('help-save')?.addEventListener('click', async () => {
      const content = document.getElementById('help-editor')?.value ?? '';
      state.help.saving = true; renderApp();
      try {
        await fetch(`${API}/api/help`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content}) });
        state.help.content = content;
      } catch { /* non-fatal */ }
      state.help.saving = false; state.help.editing = false; renderApp();
    });
    document.getElementById('help-reset')?.addEventListener('click', async () => {
      await fetch(`${API}/api/help`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content:''}) });
      state.help.content = null; state.help.editing = false; renderApp();
    });
  }

  function bindDetail() {
    const d = state.detail;
    document.getElementById('dp-ver-help-toggle')?.addEventListener('click', () => {
      const el = document.getElementById('dp-ver-legend');
      if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('dp-build')?.addEventListener('click', () => {
      if (!state.sidebar.selUc || d.building || !d.nextBuildTag) return;
      startBuild(state.sidebar.selUc, d.nextBuildTag);
    });
    // Tag chips in status card (no specific sidebar tag selected)
    document.querySelectorAll('input[name="dp-tag-pick"]').forEach(r => {
      r.addEventListener('change', e => {
        d.deployTag = e.target.value;
        renderApp();
        const uc = state.local.useCases.find(u => u.name === state.sidebar.selUc);
        pushRightPanel(uc ?? null, e.target.value);
      });
    });
    // Target dropdown
    document.getElementById('dp-target-select')?.addEventListener('change', e => { d.target = e.target.value; });
    document.getElementById('dp-deploy')?.addEventListener('click', () => {
      const dp = state.deploy;
      dp.ucName = state.sidebar.selUc;
      dp.tag    = state.detail.deployTag || state.sidebar.selTag;
      dp.log    = []; dp.done = false; dp.failed = false; dp.running = false;
      state.view = 'deploy';
      loadDeploySites().then(() => renderApp());
    });
    document.getElementById('dp-del-tag')?.addEventListener('click', () => {
      d.confirmDeleteTag = state.sidebar.selTag; renderApp();
    });
    document.getElementById('dp-del-tag-cancel')?.addEventListener('click', () => {
      d.confirmDeleteTag = null; renderApp();
    });
    document.getElementById('dp-del-tag-confirm')?.addEventListener('click', async () => {
      const name = state.sidebar.selUc;
      const tag  = d.confirmDeleteTag;
      d.deletingTag = true; renderApp();
      try {
        const res  = await fetch(`${API}/api/delete-tag`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, tag }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        d.confirmDeleteTag = null; d.deletingTag = false;
        // Clear selection back to use case name (tag is gone)
        state.sidebar.selTag = null; d.deployTag = '';
        bridge()?.toast(`Removed ${tag}`, 3000);
        await loadLocal();
        loadNextBuildTag(name);
      } catch (err) {
        d.deletingTag = false;
        bridge()?.notify({ type: 'error', title: 'Remove failed', message: err.message });
        renderApp();
      }
    });

    document.getElementById('dp-delete-uc')?.addEventListener('click', () => {
      d.confirmDelete = state.sidebar.selUc; renderApp();
    });
    document.getElementById('dp-del-cancel')?.addEventListener('click', () => { d.confirmDelete = null; renderApp(); });
    document.getElementById('dp-del-confirm')?.addEventListener('click', async () => {
      const name = d.confirmDelete;
      d.deleting = true; renderApp();
      try {
        const res  = await fetch(`${API}/api/delete-local`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name}) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        d.confirmDelete = null; d.deleting = false;
        state.sidebar.selUc = null; state.sidebar.selTag = null;
        state.view = 'help';
        deployLoaded = false;
        loadLocal();
        bridge()?.toast(`Deleted "${name}"${data.removedImages?.length?` + ${data.removedImages.length} image(s)`:''}`, 4000);
      } catch (err) {
        d.deleting = false;
        bridge()?.notify({ type:'error', title:'Delete failed', message: err.message });
        renderApp();
      }
    });
  }

  function bindCreate() {
    const c = state.create;
    document.getElementById('eg-cancel-edit')?.addEventListener('click', () => {
      c.editMode = false; c.editName = null; c.showChangeWarning = false;
      state.view = state.sidebar.selUc ? 'detail' : 'help'; renderApp();
    });
    document.getElementById('eg-warn-cancel')?.addEventListener('click', () => { c.showChangeWarning = false; renderApp(); });
    document.getElementById('eg-warn-confirm')?.addEventListener('click', () => { c.showChangeWarning = false; doSave(true); });

    document.getElementById('eg-name')?.addEventListener('input', e => {
      c.name = e.target.value.trim(); partialRenderPreview(); updateSaveBtn();
    });
    document.getElementById('eg-desc')?.addEventListener('input', e => { c.description = e.target.value; });
    document.getElementById('eg-frappe')?.addEventListener('change', e => {
      c.frappeMajor = e.target.value; c.nextVersion = null; scheduleVersionFetch(); partialRenderPreview();
    });
    document.querySelectorAll('.eg-app-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        const { repo, branch, name } = e.target.dataset;
        e.target.checked ? c.selectedApps.set(repo,{repo,branch,name}) : c.selectedApps.delete(repo);
        const label = e.target.closest('.erp-app');
        if (label) label.classList.toggle('erp-app-checked', e.target.checked);
        const countEl = document.querySelector('.erp-sel-count');
        if (countEl) countEl.textContent = `${c.selectedApps.size} selected`;
        partialRenderPreview(); updateSaveBtn();
      });
    });
    document.getElementById('eg-save')?.addEventListener('click', () => {
      if (!c.name || c.selectedApps.size === 0) return;
      if (c.editMode) {
        const cur  = new Set(c.selectedApps.keys());
        const diff = cur.size !== c.originalAppSet.size || [...cur].some(r => !c.originalAppSet.has(r));
        if (diff) { c.showChangeWarning = true; renderApp(); return; }
      }
      doSave(false);
    });
  }

  // ── DEPLOY helpers ─────────────────────────────────────────────────────────

  function bindDeploy() {
    const d = state.deploy;

    document.getElementById('dp2-back')?.addEventListener('click', () => {
      state.view = 'detail'; renderApp();
    });

    document.getElementById('dp2-site-sel')?.addEventListener('change', e => {
      d.selectedSite = e.target.value;
      const site = d.sites.find(s => s.name === d.selectedSite);
      if (site) {
        d.name = site.name; d.host = site.host; d.user = site.user;
        d.proxy = site.proxy; d.workdir = site.workdir; d.notes = site.notes;
      }
      renderApp();
    });

    // Sync form fields into state so command preview updates live
    ['dp2-name','dp2-host','dp2-user','dp2-proxy','dp2-workdir','dp2-notes'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', e => {
        const key = { 'dp2-name':'name','dp2-host':'host','dp2-user':'user',
                      'dp2-proxy':'proxy','dp2-workdir':'workdir','dp2-notes':'notes' }[id];
        d[key] = e.target.value;
        // Rebuild command preview inline without full re-render
        const cmd  = buildSshCmd(d);
        const pre  = document.querySelector('.erp-deploy-cmd');
        if (pre) pre.textContent = cmd;
        if (pre) pre.classList.toggle('erp-deploy-cmd-dim', !deployReady(d));
      });
    });

    document.getElementById('dp2-save-site')?.addEventListener('click', async () => {
      const name = d.selectedSite || d.name;
      if (!name || !d.host) { d.saveError = 'Name and host are required'; renderApp(); return; }
      d.saving = true; d.saveError = null; renderApp();
      try {
        const res = await fetch(`${API}/api/deploy-sites`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, host: d.host, user: d.user, proxy: d.proxy, workdir: d.workdir, notes: d.notes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        d.selectedSite = name;
        await loadDeploySites();
      } catch (e) { d.saveError = e.message; }
      d.saving = false; renderApp();
    });

    document.getElementById('dp2-del-site')?.addEventListener('click', async () => {
      if (!d.selectedSite) return;
      await fetch(`${API}/api/delete-deploy-site`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.selectedSite }),
      });
      d.selectedSite = ''; d.name = ''; d.host = '';
      await loadDeploySites(); renderApp();
    });

    document.getElementById('dp2-copy')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(buildSshCmd(d)).then(() => bridge()?.toast('Command copied', 2000));
    });

    document.getElementById('dp2-vars-toggle')?.addEventListener('click', () => {
      d.showVars = !d.showVars; renderApp();
    });

    document.getElementById('dp2-run')?.addEventListener('click', () => {
      if (!deployReady(d) || d.running) return;
      startDeploy(d);
    });
  }

  function deployReady(d) {
    const site = d.selectedSite ? d.sites.find(s => s.name === d.selectedSite) : null;
    return !!(d.ucName && d.tag && (site ? site.host : d.host));
  }

  function buildSshCmd(d) {
    const site  = d.selectedSite ? d.sites.find(s => s.name === d.selectedSite) : null;
    const host  = site ? site.host    : d.host;
    const user  = site ? site.user    : d.user;
    const proxy = site ? site.proxy   : d.proxy;
    const wdir  = site ? site.workdir : d.workdir;
    const image = `ghcr.io/cascadesteam/erp-${d.ucName}:${d.tag}`;
    return [
      'ssh',
      proxy ? `-J ${proxy}` : null,
      `${user || 'root'}@${host || '<host>'}`,
      `"cd ${wdir} && docker compose pull ${image} && docker compose up -d"`,
    ].filter(Boolean).join(' ');
  }

  function startDeploy(d) {
    const site   = d.selectedSite ? d.sites.find(s => s.name === d.selectedSite) : null;
    const host   = encodeURIComponent(site ? site.host    : d.host);
    const user   = encodeURIComponent(site ? site.user    : d.user);
    const proxy  = encodeURIComponent(site ? site.proxy   : d.proxy);
    const workdir = encodeURIComponent(site ? site.workdir : d.workdir);
    const name   = encodeURIComponent(d.ucName);
    const tag    = encodeURIComponent(d.tag);

    d.running = true; d.log = []; d.done = false; d.failed = false;
    renderApp();

    const url = `${API}/api/deploy-run?name=${name}&tag=${tag}&host=${host}&user=${user}&proxy=${proxy}&workdir=${workdir}`;
    const es  = new EventSource(url);
    es.onmessage = e => {
      const { line } = JSON.parse(e.data);
      d.log.push(line);
      const logEl = document.getElementById('dp2-log');
      if (logEl) { logEl.textContent += line; logEl.scrollTop = logEl.scrollHeight; }
    };
    es.addEventListener('done', e => {
      const { code } = JSON.parse(e.data);
      d.running = false; d.done = code === 0; d.failed = code !== 0;
      es.close(); renderApp();
      if (code === 0) bridge()?.toast(`Deployed ${d.ucName}:${d.tag}`, 4000);
    });
    es.addEventListener('error', () => { d.running = false; d.failed = true; es.close(); renderApp(); });
  }

  async function loadDeploySites() {
    state.deploy.loadingSites = true;
    try {
      state.deploy.sites = await fetch(`${API}/api/deploy-sites`).then(r => r.json());
    } catch { state.deploy.sites = []; }
    state.deploy.loadingSites = false;
  }

  // ── CREATE helpers ─────────────────────────────────────────────────────────

  function updateSaveBtn() {
    const c = state.create;
    const btn = document.getElementById('eg-save');
    if (btn) btn.disabled = !c.name || c.selectedApps.size === 0 || c.saving;
  }
  function partialRenderPreview() {
    const w = document.getElementById('eg-preview-wrap');
    if (w) w.innerHTML = renderPreview();
  }

  let versionDebounce = null;
  function scheduleVersionFetch() { clearTimeout(versionDebounce); versionDebounce = setTimeout(fetchNextVersion,400); }

  async function doSave(majorBump) {
    const c = state.create;
    c.saving = true; c.saveResult = null; renderApp();
    try {
      const res  = await fetch(`${API}/api/save-local`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:c.name, description:c.description, frappeMajor:c.frappeMajor, apps:[...c.selectedApps.values()], majorBump }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      c.saveResult = data; c.saving = false;
      if (c.editMode) c.originalAppSet = new Set(c.selectedApps.keys());
      // Switch to detail for the saved use case
      loadLocal().then(() => selectUc(c.name, null, 'local'));
    } catch (err) {
      c.saving = false; c.loadError = `Save failed: ${err.message}`; renderApp();
    }
  }

  async function loadUseCase(name) {
    const res  = await fetch(`${API}/api/use-case?name=${encodeURIComponent(name)}`);
    if (!res.ok) { bridge()?.toast(`Could not load ${name}`,3000); return; }
    const data = await res.json();
    const c    = state.create;
    c.name = data.name; c.description = data.description || ''; c.selectedApps.clear();
    for (const app of data.apps) {
      const repo = (app.url||'').replace('https://github.com/','');
      if (!repo) continue;
      let displayName = repo.split('/')[1] || repo;
      for (const cat of c.catalogue) { const f = cat.apps.find(a => a.repo===repo); if (f) { displayName = f.name; break; } }
      c.selectedApps.set(repo, { repo, branch: app.branch, name: displayName });
    }
    c.originalAppSet = new Set(c.selectedApps.keys());
    c.editMode = true; c.editName = name; c.saveResult = null; c.showChangeWarning = false;
    state.view = 'create'; renderApp(); fetchNextVersion();
  }

  // ── Right panel properties ────────────────────────────────────────────────

  function renderProperties(uc, tag, info) {
    const apps = uc?.apps ?? [];
    const built = tag ? (info?.created ? new Date(info.created).toLocaleString() : '—') : null;
    const row = (key, val) =>
      `<div class="erp-p-row"><span class="erp-p-key">${esc(key)}</span><span class="erp-p-val">${val}</span></div>`;
    return `
      <div class="erp-p-header">${esc(uc?.name ?? '—')}</div>
      ${row('Image', `<code>ghcr.io/cascadesteam/erp-${esc(uc?.name)}</code>`)}
      ${row('Tag',   tag  ? `<code>${esc(tag)}</code>`  : '<span class="erp-p-muted">not built</span>')}
      ${row('Built', built ?? '<span class="erp-p-muted">not built</span>')}
      ${info?.size ? row('Size', esc(info.size)) : ''}
      ${info?.arch ? row('Arch', esc(info.arch)) : ''}
      <div class="erp-p-section">Apps (${apps.length})</div>
      ${apps.map(a => {
        const repo = (a.url ?? '').replace('https://github.com/', '');
        return `<div class="erp-p-app"><code>${esc(repo)}</code><span class="erp-p-branch">@${esc(a.branch)}</span></div>`;
      }).join('')}
    `;
  }

  async function pushRightPanel(uc, tag) {
    const b = bridge();
    const claim = b?.claimRightPanel || b?.setRightPanel;
    if (!claim) return;
    claim.call(b, renderProperties(uc, tag, null), 'Properties');
    if (tag && uc) {
      try {
        const info = await fetch(`${API}/api/image-info?name=${encodeURIComponent(uc.name)}&tag=${encodeURIComponent(tag)}`).then(r => r.json());
        if (state.sidebar.selUc === uc.name && state.sidebar.selTag === tag) {
          claim.call(b, renderProperties(uc, tag, info), 'Properties');
        }
      } catch { /* non-fatal */ }
    }
  }

  // ── BUILD streaming ────────────────────────────────────────────────────────

  function startBuild(name, tag) {
    const d = state.detail;
    d.building = true; d.buildLog = []; d.buildDone = false; d.buildFailed = false;
    renderApp();
    const es = new EventSource(`${API}/api/build?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`);
    es.onmessage = e => {
      const { line } = JSON.parse(e.data);
      d.buildLog.push(line);
      const logEl = document.getElementById('dp-log');
      if (logEl) { logEl.textContent += line; logEl.scrollTop = logEl.scrollHeight; }
    };
    es.addEventListener('done', e => {
      const { code } = JSON.parse(e.data);
      const justBuilt = tag;
      d.building = false; d.buildDone = code===0; d.buildFailed = code!==0;
      es.close();
      loadLocal().then(() => {
        if (code===0) {
          d.deployTag = justBuilt;
          loadNextBuildTag(name);
          checkUpdates(name, justBuilt); // new image is now the baseline
        }
        renderApp();
      }).catch(() => renderApp());
    });
    es.addEventListener('error', () => { d.building=false; d.buildFailed=true; es.close(); renderApp(); });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  let deployLoaded = false;

  async function loadLocal() {
    state.local.loading = true;
    try {
      const ucs = await fetch(`${API}/api/use-cases`).then(r => r.json());
      state.local.useCases = ucs;
      // Re-expand any use case that had tags and now has more
      for (const uc of ucs) if (uc.builtTags.length > 0) state.sidebar.localExpanded.add(uc.name);
    } catch (e) { state.local.error = e.message; }
    state.local.loading = false;
    deployLoaded = true;
    renderApp();
    return state.local.useCases;
  }

  async function loadRemote() {
    state.remote.loading = true; renderApp();
    try {
      const data = await fetch(`${API}/api/remote-images`).then(r => r.json());
      state.remote.available = data.available;
      state.remote.packages  = data.packages || [];
      state.remote.error     = data.error || null;
    } catch (e) { state.remote.error = e.message; }
    state.remote.loading = false; state.remote.loaded = true;
    renderApp();
  }

  async function loadTargets() {
    try {
      state.detail.targets = await fetch(`${API}/api/targets`).then(r => r.json());
    } catch { /* use empty */ }
  }

  async function checkUpdates(name, tag) {
    if (!tag) return; // no built tag selected — nothing to check against
    state.detail.updateCheck = { loading: true };
    renderApp();
    try {
      const data = await fetch(`${API}/api/check-updates?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`).then(r => r.json());
      if (state.sidebar.selUc === name && state.sidebar.selTag === tag) {
        state.detail.updateCheck = { loading: false, ...data };
        renderApp();
      }
    } catch {
      state.detail.updateCheck = { loading: false, hasUpdates: true, updates: [] }; // fail open
      renderApp();
    }
  }

  async function loadNextBuildTag(name) {
    try {
      const data = await fetch(`${API}/api/next-tag?name=${encodeURIComponent(name)}&major=16`).then(r=>r.json());
      if (state.sidebar.selUc === name) { state.detail.nextBuildTag = data.tag; renderApp(); }
    } catch { /* non-fatal */ }
  }

  async function fetchNextVersion() {
    const c = state.create;
    try {
      const v = await fetch(`${API}/api/next-version?major=${encodeURIComponent(c.frappeMajor)}`).then(r=>r.json());
      c.nextVersion = v.tag; partialRenderPreview();
    } catch { /* non-fatal */ }
  }

  async function initCreate() {
    const c = state.create;
    try {
      const [, cat] = await Promise.all([fetch(`${API}/api/status`).then(r=>r.json()), fetch(`${API}/api/catalogue`).then(r=>r.json())]);
      c.catalogue = cat;
    } catch (e) { c.loadError = e.message; }
    c.phase = 'form';
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    /* Sidebar (rendered into DocWright's left panel) */
    .erp-panel-inner { display:flex; flex-direction:column; gap:0; padding:8px 0; height:100%; }
    /* Sidebar */
    .erp-new-btn { width:calc(100% - 16px); margin:0 8px 10px; padding:7px; background:#1e3a6e; border:1px solid #2a5aba; border-radius:6px; color:#7ab0ff; font-size:12px; font-weight:600; cursor:pointer; }
    .erp-new-btn:hover { background:#253e7e; }
    .erp-s-section { border-top:1px solid var(--border,#1e2030); }
    .erp-s-hdr { display:flex; align-items:center; gap:5px; padding:7px 10px; font-size:11px; font-weight:600; color:var(--muted,#666); text-transform:uppercase; letter-spacing:.4px; cursor:pointer; user-select:none; }
    .erp-s-hdr:hover { background:var(--bg-2,#1a1a1a); }
    .erp-caret { font-size:9px; flex-shrink:0; }
    .erp-s-count { margin-left:auto; font-size:10px; background:var(--bg-2,#222); padding:1px 5px; border-radius:8px; }
    .erp-s-muted { margin-left:auto; font-size:10px; font-style:italic; text-transform:none; letter-spacing:0; }
    .erp-s-spin { margin-left:auto; animation:spin .8s linear infinite; display:inline-block; }
    .erp-s-uc-hdr { display:flex; align-items:center; gap:4px; padding:5px 10px 5px 14px; cursor:pointer; font-size:12px; color:var(--fg,#ccc); }
    .erp-s-uc-hdr:hover { background:var(--bg-2,#1a1a1a); }
    .erp-s-uc-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .erp-s-icon { background:none; border:none; cursor:pointer; font-size:12px; padding:1px 2px; opacity:.5; }
    .erp-s-icon:hover { opacity:1; }
    .erp-s-del:hover { color:#da3633; }
    .erp-s-tags { padding:0 0 4px 0; }
    .erp-s-tag { padding:4px 10px 4px 30px; font-size:11px; font-family:monospace; color:var(--muted,#888); cursor:pointer; }
    .erp-s-tag:hover { background:var(--bg-2,#1a1a1a); color:var(--fg,#ccc); }
    .erp-s-no-tags { padding:4px 10px 4px 30px; font-size:11px; color:var(--muted,#555); font-style:italic; cursor:pointer; }
    .erp-s-empty { padding:8px 14px; font-size:11px; color:var(--muted,#555); }
    .erp-s-error { padding:8px 14px; font-size:11px; color:#da3633; }
    .erp-s-sel { background:rgba(88,166,255,.1) !important; color:#58a6ff !important; border-left:2px solid #58a6ff; }
    /* Help */
    .erp-help { display:flex; flex-direction:column; height:100%; }
    .erp-help-toolbar { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--border,#1e2030); flex-shrink:0; }
    .erp-help-title { font-size:14px; font-weight:700; color:var(--fg,#e0e0f0); flex:1; }
    .erp-help-body { padding:20px 24px; flex:1; overflow-y:auto; font-size:13px; line-height:1.7; color:var(--fg,#ddd); }
    .erp-help-body h1 { font-size:20px; margin:0 0 12px; }
    .erp-help-body h2 { font-size:15px; margin:20px 0 8px; color:var(--fg,#e0e0f0); }
    .erp-help-body h3 { font-size:13px; margin:16px 0 6px; }
    .erp-help-body ul { padding-left:20px; margin:4px 0; }
    .erp-help-body li { margin:3px 0; }
    .erp-help-body code { font-family:monospace; font-size:12px; background:rgba(88,166,255,.1); padding:1px 5px; border-radius:3px; color:#58a6ff; }
    .erp-help-body pre.erp-code { background:var(--bg-2,#0d0d1e); padding:12px; border-radius:6px; border:1px solid var(--border,#2a2a4a); overflow-x:auto; font-size:12px; color:var(--fg,#cce0ff); }
    .erp-help-body hr { border:none; border-top:1px solid var(--border,#1e2030); margin:16px 0; }
    .erp-help-editor { flex:1; background:var(--bg-2,#0d0d1e); border:none; color:var(--fg,#e0e0f0); font-family:monospace; font-size:12px; padding:16px; resize:none; width:100%; box-sizing:border-box; min-height:400px; }
    .erp-help-editor:focus { outline:none; }
    /* Detail */
    .erp-detail { padding:20px 24px; display:flex; flex-direction:column; gap:16px; }
    .erp-dh { display:flex; align-items:flex-start; gap:8px; }
    .erp-dh-left { flex:1; display:flex; flex-direction:column; gap:3px; }
    .erp-dh-name { font-size:18px; font-weight:700; color:var(--fg,#e0e0f0); }
    .erp-dh-meta { font-size:12px; color:var(--muted,#666); }
    .erp-badge-remote { font-size:10px; background:rgba(88,166,255,.15); color:#58a6ff; border:1px solid rgba(88,166,255,.3); padding:1px 6px; border-radius:8px; }
    .erp-btn-icon-danger { background:none; border:none; cursor:pointer; font-size:16px; opacity:.4; padding:2px; }
    .erp-btn-icon-danger:hover { opacity:1; }
    /* Status card */
    .erp-status-card { border-radius:6px; padding:10px 14px; border:1px solid; }
    .erp-status-built { background:rgba(63,185,80,.05); border-color:rgba(63,185,80,.2); }
    .erp-status-unbuilt { background:rgba(255,255,255,.03); border-color:var(--border,#2a2a4a); }
    .erp-status-tag-row { display:flex; align-items:center; gap:10px; }
    .erp-status-tag { font-size:13px; font-weight:600; color:#4caf50; font-family:monospace; }
    .erp-status-note { font-size:11px; color:var(--muted,#666); }
    .erp-tag-del-btn { background:none; border:1px solid rgba(218,54,51,.3); border-radius:4px; color:rgba(218,54,51,.7); font-size:11px; padding:2px 8px; cursor:pointer; }
    .erp-tag-del-btn:hover { border-color:#da3633; color:#da3633; }
    .erp-tag-del-confirm { margin-top:8px; padding:8px 10px; background:rgba(218,54,51,.07); border-radius:4px; border:1px solid rgba(218,54,51,.25); font-size:12px; color:var(--fg,#ccc); }
    .erp-tag-del-confirm code { font-family:monospace; font-size:11px; color:#da3633; }
    .erp-tag-del-confirm-btns { display:flex; gap:6px; margin-top:8px; }
    .erp-btn-sm { padding:3px 10px; font-size:11px; }
    .erp-status-unbuilt-msg { font-size:12px; color:var(--muted,#666); }
    .erp-status-tags-row { display:flex; gap:6px; flex-wrap:wrap; }
    .erp-tag-chip { display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:12px; border:1px solid var(--border,#2a2a4a); cursor:pointer; font-size:12px; font-family:monospace; color:var(--muted,#888); }
    .erp-tag-chip input { display:none; }
    .erp-tag-chip:hover { border-color:#58a6ff; color:var(--fg,#ccc); }
    .erp-tag-chip-sel { border-color:#58a6ff; color:#58a6ff; background:rgba(88,166,255,.1); }
    /* Actions */
    .erp-da { display:flex; flex-direction:column; gap:14px; }
    .erp-da-section { display:flex; flex-direction:column; gap:8px; }
    .erp-da-label { font-size:11px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.4px; display:flex; align-items:center; gap:6px; }
    .erp-da-deploy-row { display:flex; align-items:center; gap:8px; }
    .erp-da-to { font-size:12px; color:var(--muted,#666); }
    .erp-target-select { flex:1; max-width:200px; font-size:12px; padding:6px 8px; background:var(--bg-2,#111128); border:1px solid var(--border,#2a2a4a); border-radius:6px; color:var(--fg,#e0e0f0); }
    .erp-btn-deploy { min-width:120px; }
    .erp-da-build-row { display:flex; align-items:center; gap:10px; }
    .erp-da-next { display:flex; align-items:center; gap:6px; flex:1; }
    .erp-da-next-label { font-size:11px; color:var(--muted,#666); flex-shrink:0; }
    .erp-update-row { font-size:11px; padding:5px 8px; border-radius:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .erp-update-checking { color:var(--muted,#666); animation:pulse 1.5s ease-in-out infinite; }
    .erp-update-current  { color:#4caf50; background:rgba(63,185,80,.07); }
    .erp-update-available { color:#d4a017; background:rgba(212,160,23,.08); }
    .erp-update-app { display:inline-flex; align-items:center; gap:3px; }
    .erp-update-app code { font-family:monospace; font-size:10px; background:rgba(212,160,23,.15); padding:1px 4px; border-radius:3px; color:#d4a017; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    /* Create */
    .erp-wrap { max-width:780px; margin:0 auto; padding:20px 24px 40px; }
    .erp-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
    .erp-header-icon { font-size:28px; }
    .erp-header-title { font-size:17px; font-weight:700; color:var(--fg,#e0e0f0); }
    .erp-header-sub { font-size:12px; color:var(--muted,#666); margin-top:2px; }
    .erp-form { display:flex; flex-direction:column; gap:14px; }
    .erp-row2 { display:grid; grid-template-columns:1fr auto; gap:12px; }
    .erp-field { display:flex; flex-direction:column; gap:4px; }
    .erp-section-label { font-size:11px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.5px; display:flex; align-items:center; gap:8px; margin-top:4px; }
    .erp-sel-count { font-weight:400; text-transform:none; letter-spacing:0; color:var(--fg,#aaa); }
    .erp-label { font-size:12px; color:var(--fg,#ccc); }
    .erp-hint  { font-weight:400; color:var(--muted,#666); }
    .erp-input,.erp-select,.erp-textarea { background:var(--bg-2,#111128); border:1px solid var(--border,#2a2a4a); border-radius:6px; color:var(--fg,#e0e0f0); font-size:13px; padding:7px 10px; font-family:inherit; }
    .erp-input:focus,.erp-select:focus,.erp-textarea:focus { outline:none; border-color:#4a6aba; }
    .erp-textarea { resize:vertical; }
    .erp-cat { margin-bottom:4px; }
    .erp-cat-name { font-size:11px; font-weight:600; color:var(--muted,#555); margin:8px 0 4px; text-transform:uppercase; letter-spacing:.4px; }
    .erp-app-list { display:flex; flex-direction:column; gap:2px; }
    .erp-app { display:flex; align-items:center; gap:8px; padding:5px 10px; border-radius:5px; cursor:pointer; border:1px solid transparent; }
    .erp-app:hover { background:var(--bg-2,#1a1a2a); }
    .erp-app-checked { background:rgba(88,166,255,.07); border-color:rgba(88,166,255,.2); }
    .erp-app input[type=checkbox] { accent-color:#58a6ff; width:14px; height:14px; flex-shrink:0; }
    .erp-app-icon { font-size:13px; flex-shrink:0; }
    .erp-app-name { font-size:13px; color:var(--fg,#e0e0f0); flex-shrink:0; }
    .erp-app-ref  { font-size:11px; color:var(--muted,#666); font-family:monospace; margin-left:auto; }
    .erp-preview { background:var(--bg-2,#0d0d1e); border:1px solid var(--border,#2a2a4a); border-radius:6px; overflow:hidden; }
    .erp-preview-meta { font-size:12px; color:var(--muted,#888); padding:8px 12px; border-bottom:1px solid var(--border,#2a2a4a); }
    .erp-saved { background:rgba(63,185,80,.07); border:1px solid rgba(63,185,80,.25); border-radius:6px; padding:12px 16px; display:flex; flex-direction:column; gap:6px; }
    .erp-saved-title { font-size:13px; font-weight:600; color:var(--fg,#e0e0f0); }
    .erp-saved-tag { font-size:12px; color:var(--muted,#888); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .erp-bump-badge { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:500; }
    .erp-bump-initial { background:rgba(63,185,80,.15); color:#4caf50; border:1px solid rgba(63,185,80,.3); }
    .erp-bump-patch   { background:rgba(88,166,255,.12); color:#58a6ff; border:1px solid rgba(88,166,255,.3); }
    .erp-bump-release { background:rgba(210,153,34,.12);  color:#d4a017; border:1px solid rgba(210,153,34,.3); }
    .erp-actions { display:flex; align-items:center; gap:12px; padding-top:4px; }
    /* Shared buttons */
    .erp-btn { padding:7px 18px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid; }
    .erp-btn-save    { background:none; border-color:#3a5a3a; color:#4caf50; }
    .erp-btn-save:hover:not(:disabled) { background:rgba(63,185,80,.1); }
    .erp-btn-save:disabled { opacity:.4; cursor:default; }
    .erp-btn-build   { background:none; border-color:#5a4a2a; color:#d4a017; }
    .erp-btn-build:hover:not(:disabled) { background:rgba(212,160,23,.1); }
    .erp-btn-build:disabled { opacity:.4; cursor:default; }
    .erp-btn-primary { background:#1e3a6e; border-color:#2a5aba; color:#7ab0ff; }
    .erp-btn-primary:hover:not(:disabled) { background:#253e7e; }
    .erp-btn-primary:disabled { opacity:.4; cursor:default; }
    .erp-btn-ghost   { background:none; border-color:var(--border,#444); color:var(--muted,#888); }
    .erp-btn-ghost:hover { border-color:#888; color:var(--fg,#ccc); }
    .erp-btn-danger  { background:#5a1a1a; border-color:#da3633; color:#ff8080; }
    .erp-btn-danger:hover:not(:disabled) { background:#6a2020; }
    .erp-btn-danger:disabled { opacity:.4; cursor:default; }
    /* Shared elements */
    .erp-tag-preview { font-size:12px; font-family:monospace; color:var(--fg,#ccc); background:var(--bg-2,#1a1a2a); padding:5px 10px; border-radius:4px; border:1px solid var(--border,#2a2a4a); }
    .erp-tag-select  { font-size:12px; font-family:monospace; padding:5px 8px; min-width:140px; background:var(--bg-2,#111128); border:1px solid var(--border,#2a2a4a); border-radius:6px; color:var(--fg,#e0e0f0); }
    .erp-code  { margin:0; padding:12px; font-size:12px; font-family:monospace; overflow-x:auto; color:var(--fg,#cce0ff); white-space:pre; }
    .erp-notice { font-size:12px; color:var(--muted,#666); padding:10px 0; }
    .erp-error  { background:rgba(218,54,51,.1); border-left:3px solid #da3633; padding:10px 14px; border-radius:4px; font-size:12px; color:#da3633; margin-bottom:12px; }
    .erp-loading { padding:40px; text-align:center; color:var(--muted,#888); font-size:13px; }
    .erp-warn-dialog { background:rgba(218,54,51,.07); border:1px solid rgba(218,54,51,.4); border-radius:8px; padding:16px; display:flex; gap:12px; align-items:flex-start; margin-bottom:16px; }
    .erp-warn-dialog-icon { font-size:22px; flex-shrink:0; }
    .erp-warn-dialog-body { flex:1; }
    .erp-warn-dialog-title { font-size:13px; font-weight:700; color:#da3633; margin-bottom:6px; }
    .erp-warn-dialog-msg   { font-size:12px; color:var(--fg,#ccc); line-height:1.6; }
    .erp-warn-dialog-actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
    .erp-build-output { margin-top:16px; border:1px solid var(--border,#2a2a4a); border-radius:6px; overflow:hidden; }
    .erp-build-status { padding:7px 12px; font-size:12px; font-weight:600; border-bottom:1px solid var(--border,#2a2a4a); }
    .erp-build-running { color:#58a6ff; background:rgba(88,166,255,.07); }
    .erp-build-ok      { color:#4caf50; background:rgba(63,185,80,.07); }
    .erp-build-fail    { color:#da3633; background:rgba(218,54,51,.07); }
    .erp-build-log     { margin:0; padding:12px; font-size:11px; font-family:monospace; white-space:pre-wrap; word-break:break-all; color:var(--fg,#ccc); max-height:320px; overflow-y:auto; }
    .erp-ver-help { font-size:10px; font-weight:400; text-transform:none; letter-spacing:0; color:#58a6ff; cursor:pointer; }
    .erp-ver-help:hover { text-decoration:underline; }
    .erp-ver-legend { background:var(--bg-2,#0d0d1e); border:1px solid var(--border,#2a2a4a); border-radius:6px; padding:10px 14px; margin-top:6px; font-size:11px; color:var(--muted,#888); line-height:1.8; }
    .erp-ver-legend code { color:#58a6ff; background:rgba(88,166,255,.1); padding:1px 4px; border-radius:3px; }
    .erp-ver-legend em { color:#4caf50; }
    @keyframes spin { to { transform:rotate(360deg); } }
    /* Deploy view */
    .erp-deploy-cmd { background:var(--bg-2,#0d0d1e); border:1px solid var(--border,#2a2a4a); border-radius:6px; padding:12px 14px; font-size:12px; font-family:monospace; white-space:pre-wrap; word-break:break-all; color:var(--fg,#cce0ff); margin:0; }
    .erp-deploy-cmd-dim { opacity:.45; }
    .erp-copy-btn { background:none; border:none; cursor:pointer; font-size:13px; padding:0 4px; opacity:.6; vertical-align:middle; }
    .erp-copy-btn:hover { opacity:1; }
    /* Properties panel (injected into DocWright's right panel) */
    .erp-p-header { font-size:14px; font-weight:700; color:var(--fg,#e0e0f0); margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border,#1e2030); }
    .erp-p-row { display:flex; justify-content:space-between; gap:8px; padding:4px 0; font-size:12px; border-bottom:1px solid rgba(255,255,255,.04); }
    .erp-p-key { color:var(--muted,#666); flex-shrink:0; }
    .erp-p-val { color:var(--fg,#ccc); text-align:right; word-break:break-all; }
    .erp-p-val code { font-family:monospace; font-size:11px; color:#58a6ff; background:rgba(88,166,255,.1); padding:1px 4px; border-radius:3px; }
    .erp-p-muted { color:var(--muted,#555); font-style:italic; }
    .erp-p-section { font-size:10px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.4px; margin:10px 0 4px; }
    .erp-p-app { padding:3px 0; font-size:11px; display:flex; gap:4px; align-items:baseline; }
    .erp-p-app code { font-family:monospace; color:var(--fg,#ccc); font-size:11px; }
    .erp-p-branch { color:var(--muted,#666); font-size:10px; font-family:monospace; }
  `;
  document.head.appendChild(style);

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    // Register with DocWright plugin host immediately (sidebar can mount before data loads)
    registerPlugin();

    renderApp(); // loading state in main content

    const [helpData] = await Promise.all([
      fetch(`${API}/api/help`).then(r => r.json()).catch(() => ({content:null})),
      initCreate(),
      loadLocal(),
    ]);
    state.help.content = helpData.content;

    // Restore state from URL query params
    const params = new URLSearchParams(window.location.search);
    const ucParam  = params.get('uc');
    const tagParam = params.get('tag');
    if (ucParam) {
      selectUc(ucParam, tagParam || null, 'local');
    } else {
      renderApp();
      mountSidebar();
    }
  }

  init();
})();
