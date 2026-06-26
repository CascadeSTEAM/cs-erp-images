(function () {
  'use strict';

  const API = '/api/plugin/erp-images';

  // ── State ──────────────────────────────────────────────────────────────────

  const state = {
    view: 'create',   // 'create' | 'deploy'

    create: {
      phase: 'loading',  // loading | form | saving | saved
      catalogue: [],
      name: '',
      description: '',
      frappeMajor: '16',
      selectedApps: new Map(),
      nextVersion: null,
      loadError: null,
      saveResult: null,
      saving: false,
      tokenSet: false,
      // Edit mode
      editMode: false,
      editName: null,           // original name (locked in edit mode)
      originalAppSet: new Set(), // repo strings at edit-start, for change detection
      showChangeWarning: false,  // pending save blocked by app-change warning
    },

    deploy: {
      loading: true,
      useCases: [],    // [{name, apps, builtTags, source}]
      targets: [],     // [{id, name, type, description}]
      selected: null,  // use case name
      target: 'local',
      tag: '',
      building: false,
      buildLog: [],
      buildDone: false,
      buildFailed: false,
      loadError: null,
    },
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function root() { return document.getElementById('plugin-root'); }

  // ── Top-level render ───────────────────────────────────────────────────────

  function renderApp() {
    const el = root();
    if (!el) return;
    el.innerHTML = renderTabs() +
      (state.view === 'create' ? renderCreateView() : renderDeployView());
    state.view === 'create' ? bindCreateEvents() : bindDeployEvents();
  }

  function renderTabs() {
    return `
      <div class="eg-tabs">
        <button class="eg-tab ${state.view === 'create' ? 'eg-tab-active' : ''}" data-view="create">📦 Create</button>
        <button class="eg-tab ${state.view === 'deploy' ? 'eg-tab-active' : ''}" data-view="deploy">🚀 Deploy</button>
      </div>`;
  }

  // ── CREATE VIEW ────────────────────────────────────────────────────────────

  function renderCreateView() {
    const c = state.create;
    if (c.phase === 'loading') return '<div class="eg-loading">Loading app catalogue…</div>';

    return `<div class="eg-wrap">
      <div class="eg-header">
        <span class="eg-header-icon">${c.editMode ? '✏️' : '📦'}</span>
        <div>
          <div class="eg-header-title">${c.editMode ? `Edit: ${esc(c.editName)}` : 'Define Use Case'}</div>
          <div class="eg-header-sub">${c.editMode
            ? 'Editing a local use case — changes will bump the image version'
            : 'Name your image, pick apps, save locally — then build and deploy from the Deploy tab'}</div>
        </div>
        ${c.editMode ? `<button class="eg-btn eg-btn-ghost" id="eg-cancel-edit" style="margin-left:auto">✕ Cancel</button>` : ''}
      </div>

      ${c.loadError ? `<div class="eg-error">Failed to load catalogue: ${esc(c.loadError)}</div>` : ''}

      <form id="eg-form" class="eg-form" autocomplete="off">
        <div class="eg-section-label">Use Case</div>
        <div class="eg-row2">
          <div class="eg-field">
            <label class="eg-label" for="eg-name">Name <span class="eg-hint">(kebab-case)</span></label>
            <input id="eg-name" class="eg-input" type="text" placeholder="my-use-case"
              pattern="[a-z][a-z0-9-]*" value="${esc(c.name)}"
              autocomplete="off" spellcheck="false"
              ${c.editMode ? 'readonly style="opacity:.6;cursor:not-allowed"' : ''}/>
          </div>
          <div class="eg-field">
            <label class="eg-label" for="eg-frappe">Frappe Version</label>
            <select id="eg-frappe" class="eg-select">
              ${['15','16','17'].map(v =>
                `<option value="${v}" ${c.frappeMajor === v ? 'selected' : ''}>v${v}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="eg-field">
          <label class="eg-label" for="eg-desc">Description</label>
          <textarea id="eg-desc" class="eg-textarea" rows="2"
            placeholder="What is this image for?">${esc(c.description)}</textarea>
        </div>

        <div class="eg-section-label">App Selection
          <span class="eg-sel-count">${c.selectedApps.size} selected</span>
        </div>
        ${renderCatalogue()}

        <div class="eg-section-label">Preview</div>
        <div id="eg-preview-wrap">${renderPreview()}</div>

        ${c.saveResult ? `
        <div class="eg-saved">
          <div class="eg-saved-title">✅ Saved → <code>${esc(c.saveResult.path)}</code></div>
          <div class="eg-saved-note">Updated.</div>
        </div>` : ''}

        ${c.showChangeWarning ? `
        <div class="eg-warn-dialog">
          <div class="eg-warn-dialog-icon">⚠️</div>
          <div class="eg-warn-dialog-body">
            <div class="eg-warn-dialog-title">App list changed — this is a breaking change</div>
            <div class="eg-warn-dialog-msg">
              Anything deployed from the previous version of <strong>${esc(c.editName)}</strong> will
              behave differently after this update. This requires a <strong>major version bump</strong>.
              Existing deployments should be rebuilt from the new image before going live.
            </div>
          </div>
          <div class="eg-warn-dialog-actions">
            <button class="eg-btn eg-btn-ghost" id="eg-warn-cancel">Cancel</button>
            <button class="eg-btn eg-btn-danger" id="eg-warn-confirm">Understood — save with major bump</button>
          </div>
        </div>` : ''}

        <div class="eg-actions">
          <button type="button" id="eg-save" class="eg-btn eg-btn-save"
            ${(c.saving || !c.name || c.selectedApps.size === 0) ? 'disabled' : ''}>
            ${c.saving ? '⏳ Saving…' : c.editMode ? '💾 Save changes' : '💾 Save locally'}
          </button>
        </div>
      </form>
    </div>`;
  }

  function renderCatalogue() {
    const c = state.create;
    if (!c.catalogue.length) return '<div class="eg-notice">No apps loaded.</div>';
    return c.catalogue.map(cat => `
      <div class="eg-cat">
        <div class="eg-cat-name">${esc(cat.name)}</div>
        <div class="eg-app-list">
          ${cat.apps.map(app => {
            const checked = c.selectedApps.has(app.repo);
            return `<label class="eg-app ${checked ? 'eg-app-checked' : ''}">
              <input type="checkbox" class="eg-app-cb"
                data-repo="${esc(app.repo)}" data-branch="${esc(app.branch)}" data-name="${esc(app.name)}"
                ${checked ? 'checked' : ''}/>
              <span class="eg-app-icon">${app.statusIcon}</span>
              <span class="eg-app-name">${esc(app.name)}</span>
              <span class="eg-app-ref">${esc(app.repo)}@${esc(app.branch)}</span>
            </label>`;
          }).join('')}
        </div>
      </div>`
    ).join('');
  }

  function renderPreview() {
    const c = state.create;
    if (!c.name && c.selectedApps.size === 0) {
      return '<div class="eg-notice">Fill in a name and select apps to see the preview.</div>';
    }
    const appsArr = [...c.selectedApps.values()];
    const json = JSON.stringify(
      appsArr.map(a => ({ url: `https://github.com/${a.repo}`, branch: a.branch })), null, 2
    );
    const versionLine = c.nextVersion
      ? `Suggested tag: <strong>${esc(c.nextVersion)}</strong> &nbsp;·&nbsp; Branch: <code>use-case/${esc(c.name) || '&lt;name&gt;'}</code>`
      : 'Fetching next version…';
    return `<div class="eg-preview">
      <div class="eg-preview-meta">${versionLine}</div>
      <pre class="eg-code">${esc(json)}</pre>
    </div>`;
  }

  // ── DEPLOY VIEW ────────────────────────────────────────────────────────────

  function renderDeployView() {
    const d = state.deploy;
    if (d.loading) return '<div class="eg-loading">Loading use cases…</div>';
    if (d.loadError) return `<div class="eg-error" style="margin:24px">${esc(d.loadError)}</div>`;

    const sel = d.useCases.find(uc => uc.name === d.selected);
    const isBuilt = sel && sel.builtTags.length > 0;

    return `<div class="eg-wrap">
      <div class="eg-header">
        <span class="eg-header-icon">🚀</span>
        <div>
          <div class="eg-header-title">Deploy</div>
          <div class="eg-header-sub">Build a local image and deploy it to a target environment</div>
        </div>
      </div>

      <div class="eg-section-label">Use Case</div>
      ${d.useCases.length === 0
        ? `<div class="eg-notice">No local use cases found. <button class="eg-link" id="dp-go-create">Create one →</button></div>`
        : `<div class="eg-uc-list">
          ${d.useCases.map(uc => {
            const built = uc.builtTags.length > 0;
            return `<div class="eg-uc-row">
              <label class="eg-uc ${uc.name === d.selected ? 'eg-uc-selected' : ''}">
                <input type="radio" name="eg-uc" value="${esc(uc.name)}" ${uc.name === d.selected ? 'checked' : ''}/>
                <div class="eg-uc-info">
                  <span class="eg-uc-name">${esc(uc.name)}</span>
                  <span class="eg-uc-apps">${uc.apps.length} app${uc.apps.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="eg-uc-build ${built ? 'eg-uc-built' : 'eg-uc-notbuilt'}">
                  ${built ? `✅ ${uc.builtTags[0]}` : '○ Not built'}
                </div>
              </label>
              ${uc.source === 'local' ? `<button class="eg-btn-edit" data-edit="${esc(uc.name)}" title="Edit this use case">✏️</button>` : ''}
            </div>`;
          }).join('')}
        </div>`
      }

      <div class="eg-section-label" style="margin-top:16px">Target</div>
      <div class="eg-target-list">
        ${d.targets.map(t => `
          <label class="eg-target ${t.id === d.target ? 'eg-target-selected' : ''}">
            <input type="radio" name="eg-target" value="${esc(t.id)}" ${t.id === d.target ? 'checked' : ''}/>
            <div class="eg-target-info">
              <span class="eg-target-name">${esc(t.name)}</span>
              <span class="eg-target-desc">${esc(t.description)}</span>
            </div>
          </label>`
        ).join('')}
      </div>

      ${sel ? `
        <div class="eg-section-label" style="margin-top:16px">Actions</div>
        <div class="eg-deploy-actions">
          <button class="eg-btn eg-btn-build" id="dp-build"
            ${d.building ? 'disabled' : ''}>
            ${d.building ? '⏳ Building…' : isBuilt ? '🔨 Rebuild' : '🔨 Build'}
          </button>
          ${isBuilt ? `<button class="eg-btn eg-btn-primary" id="dp-deploy"
            ${d.building ? 'disabled' : ''}>
            🚀 Deploy to ${esc(d.targets.find(t => t.id === d.target)?.name || d.target)}
          </button>` : ''}
          ${d.tag ? `<span class="eg-deploy-tag">tag: <code>${esc(d.tag)}</code></span>` : ''}
        </div>

        ${(d.building || d.buildLog.length > 0) ? `
        <div class="eg-build-output">
          <div class="eg-build-status ${d.buildDone ? 'eg-build-ok' : d.buildFailed ? 'eg-build-fail' : 'eg-build-running'}">
            ${d.buildDone ? '✅ Build complete' : d.buildFailed ? '❌ Build failed' : '⏳ Building…'}
          </div>
          <pre class="eg-build-log" id="dp-log">${esc(d.buildLog.join(''))}</pre>
        </div>` : ''}
      ` : '<div class="eg-notice" style="margin-top:12px">Select a use case to continue.</div>'}

    </div>`;
  }

  // ── CREATE events ──────────────────────────────────────────────────────────

  function updateButtonStates() {
    const c = state.create;
    const canAct = !!(c.name && c.selectedApps.size > 0);
    const saveBtn = document.getElementById('eg-save');
    if (saveBtn) saveBtn.disabled = !canAct || c.saving;
  }

  function partialRenderPreview() {
    const wrap = document.getElementById('eg-preview-wrap');
    if (wrap) wrap.innerHTML = renderPreview();
  }

  let versionDebounce = null;
  function scheduleVersionFetch() {
    clearTimeout(versionDebounce);
    versionDebounce = setTimeout(fetchNextVersion, 400);
  }

  function bindCreateEvents() {
    const c = state.create;
    document.querySelectorAll('.eg-tab').forEach(btn => {
      btn.addEventListener('click', () => { state.view = btn.dataset.view; renderApp(); loadDeployIfNeeded(); });
    });

    document.getElementById('eg-name')?.addEventListener('input', e => {
      c.name = e.target.value.trim();
      partialRenderPreview();
      updateButtonStates();
    });

    document.getElementById('eg-desc')?.addEventListener('input', e => { c.description = e.target.value; });

    document.getElementById('eg-frappe')?.addEventListener('change', e => {
      c.frappeMajor = e.target.value;
      c.nextVersion = null;
      scheduleVersionFetch();
      partialRenderPreview();
    });

    document.querySelectorAll('.eg-app-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        const { repo, branch, name } = e.target.dataset;
        e.target.checked ? c.selectedApps.set(repo, { repo, branch, name })
                         : c.selectedApps.delete(repo);
        const label = e.target.closest('.eg-app');
        if (label) label.classList.toggle('eg-app-checked', e.target.checked);
        const countEl = document.querySelector('.eg-sel-count');
        if (countEl) countEl.textContent = `${c.selectedApps.size} selected`;
        partialRenderPreview();
        updateButtonStates();
      });
    });

    document.getElementById('eg-cancel-edit')?.addEventListener('click', () => {
      c.editMode = false; c.editName = null;
      c.originalAppSet = new Set(); c.showChangeWarning = false;
      state.view = 'deploy';
      renderApp();
    });

    document.getElementById('eg-warn-cancel')?.addEventListener('click', () => {
      c.showChangeWarning = false; renderApp();
    });

    document.getElementById('eg-warn-confirm')?.addEventListener('click', () => {
      c.showChangeWarning = false;
      doSave(true); // confirmed major bump
    });

    document.getElementById('eg-save')?.addEventListener('click', () => {
      if (!c.name || c.selectedApps.size === 0) return;
      if (c.editMode) {
        // Check if app set changed
        const currentSet = new Set(c.selectedApps.keys());
        const changed = currentSet.size !== c.originalAppSet.size ||
          [...currentSet].some(r => !c.originalAppSet.has(r));
        if (changed) { c.showChangeWarning = true; renderApp(); return; }
      }
      doSave(false);
    });

    async function doSave(majorBump) {
      c.saving = true; c.saveResult = null; renderApp();
      try {
        const res = await fetch(`${API}/api/save-local`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: c.name, description: c.description,
            frappeMajor: c.frappeMajor,
            apps: [...c.selectedApps.values()],
            majorBump,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        c.saveResult = data;
        c.saving = false;
        if (c.editMode) {
          c.originalAppSet = new Set(c.selectedApps.keys());
          deployLoaded = false;
        }
        state.deploy.selected = c.name;
        state.view = 'deploy';
        loadDeployIfNeeded();
        renderApp();
        state.deploy.selected = c.name;
        state.view = 'deploy';
        loadDeployIfNeeded();
        renderApp();
      } catch (err) {
        c.saving = false;
        c.loadError = `Save failed: ${err.message}`;
        renderApp();
      }
    }
  }

  // ── DEPLOY events ──────────────────────────────────────────────────────────

  function bindDeployEvents() {
    document.querySelectorAll('.eg-tab').forEach(btn => {
      btn.addEventListener('click', () => { state.view = btn.dataset.view; renderApp(); loadDeployIfNeeded(); });
    });

    document.getElementById('dp-go-create')?.addEventListener('click', () => {
      state.view = 'create'; renderApp();
    });

    document.querySelectorAll('input[name="eg-uc"]').forEach(r => {
      r.addEventListener('change', async e => {
        state.deploy.selected = e.target.value;
        state.deploy.buildLog = [];
        state.deploy.buildDone = false;
        state.deploy.buildFailed = false;
        state.deploy.building = false;
        // fetch next version for tag suggestion
        const d = state.deploy;
        const uc = d.useCases.find(u => u.name === d.selected);
        if (uc) {
          const major = '16'; // TODO: derive from uc apps
          const res = await fetch(`${API}/api/next-version?major=${major}`);
          if (res.ok) { const v = await res.json(); d.tag = v.tag; }
        }
        renderApp();
      });
    });

    document.querySelectorAll('input[name="eg-target"]').forEach(r => {
      r.addEventListener('change', e => { state.deploy.target = e.target.value; renderApp(); });
    });

    document.getElementById('dp-build')?.addEventListener('click', () => {
      const d = state.deploy;
      if (!d.selected || d.building) return;
      const tag = d.tag || 'v16-r1';
      startBuild(d.selected, tag);
    });

    document.querySelectorAll('.eg-btn-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = btn.dataset.edit;
        await loadUseCase(name);
      });
    });

    document.getElementById('dp-deploy')?.addEventListener('click', () => {
      window.__docwright?.notify({
        type: 'info',
        title: 'Deploy',
        message: 'Ansible deployment coming in the next phase.',
      });
    });
  }

  // ── Build streaming ────────────────────────────────────────────────────────

  function startBuild(name, tag) {
    const d = state.deploy;
    d.building = true;
    d.buildLog = [];
    d.buildDone = false;
    d.buildFailed = false;
    renderApp();

    const url = `${API}/api/build?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      const { line } = JSON.parse(e.data);
      d.buildLog.push(line);
      const logEl = document.getElementById('dp-log');
      if (logEl) { logEl.textContent += line; logEl.scrollTop = logEl.scrollHeight; }
    };

    es.addEventListener('done', (e) => {
      const { code } = JSON.parse(e.data);
      d.building = false;
      d.buildDone = code === 0;
      d.buildFailed = code !== 0;
      es.close();
      // Refresh build status for this use case
      fetch(`${API}/api/use-cases`).then(r => r.json()).then(ucs => {
        d.useCases = ucs;
        renderApp();
      }).catch(() => renderApp());
    });

    es.addEventListener('error', () => {
      d.building = false;
      d.buildFailed = true;
      es.close();
      renderApp();
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  let deployLoaded = false;
  function loadDeployIfNeeded() {
    if (state.view !== 'deploy' || deployLoaded) return;
    deployLoaded = false; // allow refresh
    const d = state.deploy;
    d.loading = true;
    d.loadError = null;
    Promise.all([
      fetch(`${API}/api/use-cases`).then(r => r.json()),
      fetch(`${API}/api/targets`).then(r => r.json()),
    ]).then(([ucs, targets]) => {
      d.useCases = ucs;
      d.targets = targets;
      d.loading = false;
      deployLoaded = true;
      if (!d.selected && ucs.length > 0) d.selected = ucs[0].name;
      renderApp();
    }).catch(err => {
      d.loading = false;
      d.loadError = err.message;
      renderApp();
    });
  }

  async function loadUseCase(name) {
    const res = await fetch(`${API}/api/use-case?name=${encodeURIComponent(name)}`);
    if (!res.ok) { window.__docwright?.toast(`Could not load ${name}`, 3000); return; }
    const data = await res.json();
    const c = state.create;

    // Populate create state
    c.name = data.name;
    c.description = data.description || '';
    c.selectedApps.clear();

    // Map apps.json entries back to catalogue-style {repo, branch, name}
    for (const app of data.apps) {
      const repo = (app.url || '').replace('https://github.com/', '');
      if (repo) {
        // Try to find display name from catalogue
        let displayName = repo.split('/')[1] || repo;
        for (const cat of c.catalogue) {
          const found = cat.apps.find(a => a.repo === repo);
          if (found) { displayName = found.name; break; }
        }
        c.selectedApps.set(repo, { repo, branch: app.branch, name: displayName });
      }
    }

    // Snapshot original app set for change detection
    c.originalAppSet = new Set(c.selectedApps.keys());
    c.editMode = true;
    c.editName = name;
    c.saveResult = null;
    c.showChangeWarning = false;

    state.view = 'create';
    renderApp();
    fetchNextVersion();
  }

  async function fetchNextVersion() {
    const c = state.create;
    try {
      const res = await fetch(`${API}/api/next-version?major=${encodeURIComponent(c.frappeMajor)}`);
      if (res.ok) { const v = await res.json(); c.nextVersion = v.tag; partialRenderPreview(); }
    } catch { /* non-fatal */ }
  }

  async function initCreate() {
    const c = state.create;
    try {
      const [statusRes, catRes] = await Promise.all([
        fetch(`${API}/api/status`),
        fetch(`${API}/api/catalogue`),
      ]);
      if (statusRes.ok) { const s = await statusRes.json(); c.tokenSet = !!s.github_token_set; }
      if (!catRes.ok) throw new Error(`Catalogue fetch failed: ${catRes.status}`);
      c.catalogue = await catRes.json();
    } catch (e) { c.loadError = e.message; }
    c.phase = 'form';
    renderApp();
    fetchNextVersion();
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    .eg-tabs { display:flex; border-bottom:2px solid var(--border,#1e2030); padding:0 20px; gap:0; flex-shrink:0; }
    .eg-tab { background:none; border:none; border-bottom:2px solid transparent; margin-bottom:-2px;
      padding:10px 18px; font-size:13px; font-weight:600; color:var(--muted,#666); cursor:pointer; }
    .eg-tab:hover { color:var(--fg,#ccc); }
    .eg-tab-active { color:var(--fg,#e0e0f0); border-bottom-color:#58a6ff; }
    .eg-wrap { max-width:780px; margin:0 auto; padding:20px 24px 40px; font-family:system-ui,-apple-system,sans-serif; }
    .eg-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
    .eg-header-icon { font-size:28px; }
    .eg-header-title { font-size:17px; font-weight:700; color:var(--fg,#e0e0f0); }
    .eg-header-sub { font-size:12px; color:var(--muted,#666); margin-top:2px; }
    .eg-error { background:rgba(218,54,51,.1); border-left:3px solid #da3633; padding:10px 14px; border-radius:4px; font-size:12px; color:#da3633; margin-bottom:16px; }
    .eg-notice { font-size:12px; color:var(--muted,#666); padding:10px 0; }
    .eg-link { background:none; border:none; color:#58a6ff; cursor:pointer; font-size:12px; text-decoration:underline; }
    .eg-form { display:flex; flex-direction:column; gap:14px; }
    .eg-row2 { display:grid; grid-template-columns:1fr auto; gap:12px; }
    .eg-field { display:flex; flex-direction:column; gap:4px; }
    .eg-section-label { font-size:11px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.5px; display:flex; align-items:center; gap:8px; margin-top:4px; }
    .eg-sel-count { font-weight:400; text-transform:none; letter-spacing:0; color:var(--fg,#aaa); }
    .eg-label { font-size:12px; color:var(--fg,#ccc); }
    .eg-hint { font-weight:400; color:var(--muted,#666); }
    .eg-input,.eg-select,.eg-textarea { background:var(--bg-2,#111128); border:1px solid var(--border,#2a2a4a); border-radius:6px; color:var(--fg,#e0e0f0); font-size:13px; padding:7px 10px; font-family:inherit; }
    .eg-input:focus,.eg-select:focus,.eg-textarea:focus { outline:none; border-color:#4a6aba; }
    .eg-textarea { resize:vertical; }
    .eg-cat { margin-bottom:4px; }
    .eg-cat-name { font-size:11px; font-weight:600; color:var(--muted,#555); margin:8px 0 4px; text-transform:uppercase; letter-spacing:.4px; }
    .eg-app-list { display:flex; flex-direction:column; gap:2px; }
    .eg-app { display:flex; align-items:center; gap:8px; padding:5px 10px; border-radius:5px; cursor:pointer; border:1px solid transparent; }
    .eg-app:hover { background:var(--bg-2,#1a1a2a); }
    .eg-app-checked { background:rgba(88,166,255,.07); border-color:rgba(88,166,255,.2); }
    .eg-app input[type=checkbox] { accent-color:#58a6ff; width:14px; height:14px; flex-shrink:0; }
    .eg-app-icon { font-size:13px; flex-shrink:0; }
    .eg-app-name { font-size:13px; color:var(--fg,#e0e0f0); flex-shrink:0; }
    .eg-app-ref { font-size:11px; color:var(--muted,#666); font-family:monospace; margin-left:auto; }
    .eg-preview { background:var(--bg-2,#0d0d1e); border:1px solid var(--border,#2a2a4a); border-radius:6px; overflow:hidden; }
    .eg-preview-meta { font-size:12px; color:var(--muted,#888); padding:8px 12px; border-bottom:1px solid var(--border,#2a2a4a); }
    .eg-code { margin:0; padding:12px; font-size:12px; font-family:monospace; overflow-x:auto; color:var(--fg,#cce0ff); white-space:pre; }
    .eg-saved { background:rgba(63,185,80,.07); border:1px solid rgba(63,185,80,.25); border-radius:6px; padding:12px 16px; display:flex; flex-direction:column; gap:4px; }
    .eg-saved-title { font-size:13px; font-weight:600; color:var(--fg,#e0e0f0); }
    .eg-saved-note { font-size:11px; color:var(--muted,#666); }
    .eg-actions { display:flex; align-items:center; gap:12px; padding-top:4px; }
    .eg-btn { padding:8px 20px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid; }
    .eg-btn-save { background:none; border-color:#3a5a3a; color:#4caf50; }
    .eg-btn-save:hover:not(:disabled) { background:rgba(63,185,80,.1); }
    .eg-btn-save:disabled { opacity:.4; cursor:default; }
    .eg-btn-primary { background:#1e3a6e; border-color:#2a5aba; color:#7ab0ff; }
    .eg-btn-primary:hover:not(:disabled) { background:#253e7e; }
    .eg-btn-primary:disabled { opacity:.4; cursor:default; }
    .eg-btn-build { background:none; border-color:#5a4a2a; color:#d4a017; }
    .eg-btn-build:hover:not(:disabled) { background:rgba(212,160,23,.1); }
    .eg-btn-build:disabled { opacity:.4; cursor:default; }
    .eg-loading { padding:40px 24px; text-align:center; color:var(--muted,#888); font-size:13px; }
    /* Deploy view */
    .eg-uc-list,.eg-target-list { display:flex; flex-direction:column; gap:4px; }
    .eg-uc,.eg-target { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; border:1px solid var(--border,#2a2a4a); cursor:pointer; }
    .eg-uc:hover,.eg-target:hover { border-color:#3a3a6a; }
    .eg-uc-selected,.eg-target-selected { border-color:#4a6aba; background:rgba(88,166,255,.05); }
    .eg-uc input,.eg-target input { accent-color:#58a6ff; flex-shrink:0; }
    .eg-uc-info,.eg-target-info { flex:1; display:flex; flex-direction:column; gap:2px; }
    .eg-uc-name,.eg-target-name { font-size:13px; font-weight:600; color:var(--fg,#e0e0f0); }
    .eg-uc-apps { font-size:11px; color:var(--muted,#666); }
    .eg-target-desc { font-size:11px; color:var(--muted,#666); }
    .eg-uc-build { font-size:11px; font-family:monospace; padding:2px 8px; border-radius:10px; }
    .eg-uc-built { color:#4caf50; background:rgba(63,185,80,.1); border:1px solid rgba(63,185,80,.3); }
    .eg-uc-notbuilt { color:var(--muted,#666); background:var(--bg-2,#1a1a1a); border:1px solid var(--border,#333); }
    .eg-deploy-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .eg-deploy-tag { font-size:11px; color:var(--muted,#666); }
    .eg-build-output { margin-top:12px; border:1px solid var(--border,#2a2a4a); border-radius:6px; overflow:hidden; }
    .eg-build-status { padding:7px 12px; font-size:12px; font-weight:600; border-bottom:1px solid var(--border,#2a2a4a); }
    .eg-build-running { color:#58a6ff; background:rgba(88,166,255,.07); }
    .eg-build-ok  { color:#4caf50; background:rgba(63,185,80,.07); }
    .eg-build-fail { color:#da3633; background:rgba(218,54,51,.07); }
    .eg-build-log { margin:0; padding:12px; font-size:11px; font-family:monospace; white-space:pre-wrap; word-break:break-all; color:var(--fg,#ccc); max-height:320px; overflow-y:auto; }
    html[data-theme="light"] .eg-tabs { border-bottom-color:#d0d0d0; }
    html[data-theme="light"] .eg-tab { color:#888; }
    html[data-theme="light"] .eg-tab-active { color:#1a1a2e; border-bottom-color:#4a6cf7; }
    html[data-theme="light"] .eg-header-title { color:#1a1a2e; }
    html[data-theme="light"] .eg-input,.eg-select,.eg-textarea { background:#f5f5ff; border-color:#c0c0e0; color:#1a1a2e; }
    html[data-theme="light"] .eg-app:hover { background:#eaeaff; }
    html[data-theme="light"] .eg-app-checked { background:#dde8ff; border-color:#aaccee; }
    .eg-uc-row { display:flex; align-items:stretch; gap:4px; }
    .eg-uc-row .eg-uc { flex:1; }
    .eg-btn-edit { background:none; border:1px solid var(--border,#2a2a4a); border-radius:6px; padding:0 10px; cursor:pointer; font-size:14px; color:var(--muted,#888); flex-shrink:0; }
    .eg-btn-edit:hover { border-color:#58a6ff; color:#58a6ff; }
    .eg-warn-dialog { background:rgba(218,54,51,.07); border:1px solid rgba(218,54,51,.4); border-radius:8px; padding:16px; display:flex; gap:12px; align-items:flex-start; margin:8px 0; }
    .eg-warn-dialog-icon { font-size:22px; flex-shrink:0; }
    .eg-warn-dialog-body { flex:1; }
    .eg-warn-dialog-title { font-size:13px; font-weight:700; color:#da3633; margin-bottom:6px; }
    .eg-warn-dialog-msg { font-size:12px; color:var(--fg,#ccc); line-height:1.6; }
    .eg-warn-dialog-actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
    .eg-btn-danger { background:#5a1a1a; border-color:#da3633; color:#ff8080; }
    .eg-btn-danger:hover { background:#6a2020; }
    html[data-theme="light"] .eg-uc,.eg-target { border-color:#d0d0e0; }
    html[data-theme="light"] .eg-uc-selected,.eg-target-selected { border-color:#4a6cf7; background:#eef3ff; }
  `;
  document.head.appendChild(style);

  initCreate();
  loadDeployIfNeeded();
})();
