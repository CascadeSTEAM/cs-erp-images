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
    },
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const root = () => document.getElementById('plugin-root');

  // ── Top-level render ───────────────────────────────────────────────────────

  function renderApp() {
    const el = root(); if (!el) return;
    el.innerHTML = `
      <div class="erp-layout">
        <div class="erp-panel" id="erp-panel">${renderSidebar()}</div>
        <div class="erp-main"  id="erp-main">${renderMain()}</div>
      </div>`;
    bindAll();
  }

  function renderMain() {
    if (state.view === 'create') return renderCreateView();
    if (state.view === 'detail') return renderDetailView();
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

    return `
      <div class="erp-detail">
        <div class="erp-detail-hdr">
          <div class="erp-detail-title">
            <span class="erp-detail-name">${esc(selUc)}</span>
            ${selSource === 'remote' ? '<span class="erp-badge erp-badge-remote">GHCR</span>' : ''}
          </div>
          ${uc ? `<div class="erp-detail-apps">${uc.apps.length} app${uc.apps.length!==1?'s':''}</div>` : ''}
        </div>

        ${detail.confirmDelete ? `
        <div class="erp-warn-dialog">
          <div class="erp-warn-dialog-icon">🗑️</div>
          <div class="erp-warn-dialog-body">
            <div class="erp-warn-dialog-title">Delete <code>${esc(selUc)}</code>?</div>
            <div class="erp-warn-dialog-msg">Removes <code>use-cases/${esc(selUc)}/</code> and local Docker images. Use cases pushed to GitHub are protected.</div>
          </div>
          <div class="erp-warn-dialog-actions">
            <button class="erp-btn erp-btn-ghost" id="dp-del-cancel">Cancel</button>
            <button class="erp-btn erp-btn-danger" id="dp-del-confirm" ${detail.deleting?'disabled':''}>
              ${detail.deleting ? '⏳ Deleting…' : '🗑️ Delete permanently'}
            </button>
          </div>
        </div>` : ''}

        ${selSource === 'local' ? renderLocalActions(uc) : renderRemoteActions()}

        ${(detail.building || detail.buildLog.length > 0) ? `
        <div class="erp-build-output">
          <div class="erp-build-status ${detail.buildDone ? 'erp-build-ok' : detail.buildFailed ? 'erp-build-fail' : 'erp-build-running'}">
            ${detail.buildDone ? '✅ Build complete' : detail.buildFailed ? '❌ Build failed' : '⏳ Building…'}
          </div>
          <pre class="erp-build-log" id="dp-log">${esc(detail.buildLog.join(''))}</pre>
        </div>` : ''}
      </div>`;
  }

  function renderLocalActions(uc) {
    const d = state.detail;
    const isBuilt = uc && uc.builtTags.length > 0;
    const targetName = d.targets.find(t => t.id === d.target)?.name || d.target;
    return `
      <div class="erp-actions-grid">
        <div class="erp-action-block">
          <div class="erp-action-block-label">
            Build
            <span class="erp-ver-help" id="dp-ver-help-toggle" title="Version format help">ⓘ versioning</span>
          </div>
          <div id="dp-ver-legend" class="erp-ver-legend" style="display:none">
            <strong>v{frappe}.{release}.{patch}</strong><br>
            <span><code>frappe</code> Frappe major version — changes on Frappe upgrades</span><br>
            <span><code>release</code> App list or breaking config changed — existing deployments may need rebuild</span><br>
            <span><code>patch</code> Patch/security rebuild only — safe drop-in</span><br>
            <em>e.g. v16.1.0 → v16.1.3 → v16.2.0</em>
          </div>
          <div class="erp-action-row">
            <code class="erp-tag-preview">${esc(d.nextBuildTag || '…')}</code>
            <button class="erp-btn erp-btn-build" id="dp-build" ${(d.building||!d.nextBuildTag)?'disabled':''}>
              ${d.building ? '⏳ Building…' : isBuilt ? '🔨 Rebuild' : '🔨 Build'}
            </button>
          </div>
        </div>

        ${isBuilt ? `
        <div class="erp-action-block">
          <div class="erp-action-block-label">Deploy</div>
          <div class="erp-action-row">
            ${uc.builtTags.length > 1
              ? `<select class="erp-select erp-tag-select" id="dp-tag-select">
                  ${uc.builtTags.map(t=>`<option value="${esc(t)}" ${t===d.deployTag?'selected':''}>${esc(t)}</option>`).join('')}
                 </select>`
              : `<code class="erp-tag-preview">${esc(d.deployTag)}</code>`}
            <button class="erp-btn erp-btn-primary" id="dp-deploy" ${(d.building||!d.deployTag)?'disabled':''}>
              🚀 ${esc(targetName)}
            </button>
          </div>
        </div>` : ''}

        <div class="erp-action-block">
          <div class="erp-action-block-label">Target</div>
          <div class="erp-target-list">
            ${d.targets.map(t=>`
              <label class="erp-target-opt ${t.id===d.target?'erp-target-sel':''}">
                <input type="radio" name="dp-target" value="${esc(t.id)}" ${t.id===d.target?'checked':''}/>
                ${esc(t.name)}
              </label>`).join('')}
          </div>
        </div>

        <div class="erp-action-block erp-action-danger">
          <button class="erp-btn erp-btn-danger" id="dp-delete-uc">🗑️ Delete use case</button>
        </div>
      </div>`;
  }

  function renderRemoteActions() {
    return `
      <div class="erp-actions-grid">
        <div class="erp-action-block">
          <div class="erp-action-block-label">Deploy</div>
          <div class="erp-action-row">
            <code class="erp-tag-preview">${esc(state.sidebar.selTag || '—')}</code>
            <button class="erp-btn erp-btn-primary" id="dp-deploy">🚀 Deploy</button>
          </div>
        </div>
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
    bindSidebar();
    if (state.view === 'create') bindCreate();
    if (state.view === 'detail') bindDetail();
    if (state.view === 'help')   bindHelp();
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
      state.view = 'create'; renderApp(); fetchNextVersion();
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
    const sb = state.sidebar;
    sb.selUc = name; sb.selTag = tag; sb.selSource = source;
    state.view = 'detail';
    const d = state.detail;
    d.buildLog = []; d.buildDone = false; d.buildFailed = false;
    d.building = false; d.confirmDelete = null; d.nextBuildTag = ''; d.deployTag = '';
    const uc = state.local.useCases.find(u => u.name === name);
    d.deployTag = tag || (uc?.builtTags ?? [])[0] || '';
    if (!d.targets.length) loadTargets();
    if (source === 'local') loadNextBuildTag(name);
    renderApp();
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
    document.getElementById('dp-tag-select')?.addEventListener('change', e => { d.deployTag = e.target.value; });
    document.querySelectorAll('input[name="dp-target"]').forEach(r => {
      r.addEventListener('change', e => { d.target = e.target.value; });
    });
    document.getElementById('dp-deploy')?.addEventListener('click', () => {
      window.__docwright?.notify({ type:'info', title:'Deploy', message:'Ansible deployment coming in the next phase.' });
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
        window.__docwright?.toast(`Deleted "${name}"${data.removedImages?.length?` + ${data.removedImages.length} image(s)`:''}`, 4000);
      } catch (err) {
        d.deleting = false;
        window.__docwright?.notify({ type:'error', title:'Delete failed', message: err.message });
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
    if (!res.ok) { window.__docwright?.toast(`Could not load ${name}`,3000); return; }
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
        if (code===0) { d.deployTag = justBuilt; loadNextBuildTag(name); }
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
    /* Layout */
    #plugin-root { display:flex; flex-direction:column; height:100%; }
    .erp-layout  { display:flex; flex:1; min-height:0; height:100%; }
    .erp-panel   { width:220px; min-width:180px; flex-shrink:0; border-right:1px solid var(--border,#1e2030); overflow-y:auto; background:var(--bg,#111); }
    .erp-main    { flex:1; overflow-y:auto; }
    .erp-panel-inner { display:flex; flex-direction:column; gap:0; padding:8px 0; }
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
    .erp-detail { padding:20px 24px; }
    .erp-detail-hdr { margin-bottom:16px; }
    .erp-detail-name { font-size:18px; font-weight:700; color:var(--fg,#e0e0f0); }
    .erp-detail-apps { font-size:12px; color:var(--muted,#666); margin-top:2px; }
    .erp-badge-remote { font-size:10px; background:rgba(88,166,255,.15); color:#58a6ff; border:1px solid rgba(88,166,255,.3); padding:1px 6px; border-radius:8px; margin-left:6px; vertical-align:middle; }
    .erp-actions-grid { display:flex; flex-direction:column; gap:16px; }
    .erp-action-block { display:flex; flex-direction:column; gap:6px; }
    .erp-action-block-label { font-size:11px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.4px; display:flex; align-items:center; gap:6px; }
    .erp-action-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .erp-action-danger { margin-top:8px; padding-top:16px; border-top:1px solid var(--border,#1e2030); }
    .erp-target-list { display:flex; gap:8px; flex-wrap:wrap; }
    .erp-target-opt { display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:4px; border:1px solid var(--border,#2a2a4a); cursor:pointer; font-size:12px; }
    .erp-target-sel { border-color:#4a6aba; background:rgba(88,166,255,.07); }
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
  `;
  document.head.appendChild(style);

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    // Load help content, catalogue, and local use cases in parallel
    const [helpData] = await Promise.all([
      fetch(`${API}/api/help`).then(r => r.json()).catch(() => ({content:null})),
      initCreate(),
      loadLocal(),
    ]);
    state.help.content = helpData.content;
    renderApp();
  }

  init();
})();
