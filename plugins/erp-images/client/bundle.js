(function () {
  'use strict';

  const API = '/api/plugin/erp-images';

  // ── State ──────────────────────────────────────────────────────────────────

  const state = {
    phase: 'loading',   // loading | form | submitting | done | error
    catalogue: [],      // [{name, apps:[]}]
    name: '',
    description: '',
    frappeMajor: '16',
    selectedApps: new Map(), // repo -> {repo, branch}
    nextVersion: null,
    loadError: null,
    submitResult: null,
    submitError: null,
    tokenSet: false,
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function root() { return document.getElementById('plugin-root'); }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderApp() {
    const el = root();
    if (!el) return;

    if (state.phase === 'loading') {
      el.innerHTML = '<div class="eg-loading">Loading app catalogue…</div>';
      return;
    }

    if (state.phase === 'done') {
      el.innerHTML = `
        <div class="eg-done">
          <div class="eg-done-icon">✅</div>
          <div class="eg-done-title">Pull request created</div>
          <a class="eg-done-link" href="${esc(state.submitResult.pr_url)}" target="_blank" rel="noopener">
            Open PR on GitHub →
          </a>
          <div class="eg-done-meta">
            Branch: <code>${esc(state.submitResult.branch)}</code> &nbsp;·&nbsp;
            Suggested tag: <code>${esc(state.submitResult.tag)}</code>
          </div>
          <button class="eg-btn eg-btn-ghost" id="eg-new">Create another</button>
        </div>`;
      document.getElementById('eg-new').onclick = () => {
        state.phase = 'form';
        state.name = '';
        state.description = '';
        state.selectedApps.clear();
        state.submitResult = null;
        renderApp();
      };
      return;
    }

    el.innerHTML = `
      <div class="eg-wrap">
        <div class="eg-header">
          <span class="eg-header-icon">📦</span>
          <div>
            <div class="eg-header-title">Image Generator</div>
            <div class="eg-header-sub">Define a use case → open a GitHub PR → CI builds the image</div>
          </div>
        </div>

        ${!state.tokenSet ? `
        <div class="eg-warn">
          ⚠ <strong>GITHUB_TOKEN not set.</strong>
          Add <code>GITHUB_TOKEN=ghp_...</code> to <code>cs-erp-images/.env</code> to enable PR creation.
          App selection and preview still work.
        </div>` : ''}

        ${state.loadError ? `<div class="eg-error">Failed to load catalogue: ${esc(state.loadError)}</div>` : ''}

        <form id="eg-form" class="eg-form" autocomplete="off">

          <div class="eg-section-label">Use Case</div>
          <div class="eg-row2">
            <div class="eg-field">
              <label class="eg-label" for="eg-name">Name <span class="eg-hint">(kebab-case)</span></label>
              <input id="eg-name" class="eg-input" type="text" placeholder="my-use-case"
                pattern="[a-z][a-z0-9-]*" value="${esc(state.name)}" autocomplete="off" spellcheck="false"/>
            </div>
            <div class="eg-field">
              <label class="eg-label" for="eg-frappe">Frappe Version</label>
              <select id="eg-frappe" class="eg-select">
                ${['15','16','17'].map(v =>
                  `<option value="${v}" ${state.frappeMajor === v ? 'selected' : ''}>v${v}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="eg-field">
            <label class="eg-label" for="eg-desc">Description</label>
            <textarea id="eg-desc" class="eg-textarea" rows="2"
              placeholder="What is this image for?">${esc(state.description)}</textarea>
          </div>

          <div class="eg-section-label">App Selection
            <span class="eg-sel-count">${state.selectedApps.size} selected</span>
          </div>

          ${renderCatalogue()}

          <div class="eg-section-label">Preview</div>
          <div id="eg-preview-wrap">${renderPreview()}</div>

          ${state.submitError ? `<div class="eg-error">${esc(state.submitError)}</div>` : ''}

          <div class="eg-actions">
            <button type="submit" id="eg-submit" class="eg-btn eg-btn-primary"
              ${(state.phase === 'submitting' || !state.name || state.selectedApps.size === 0) ? 'disabled' : ''}>
              ${state.phase === 'submitting' ? '⏳ Creating PR…' : '🚀 Create GitHub PR'}
            </button>
            ${!state.tokenSet ? '<span class="eg-actions-note">Token required to create PR</span>' : ''}
          </div>

        </form>
      </div>`;

    bindFormEvents();
  }

  function renderCatalogue() {
    if (!state.catalogue.length) {
      return '<div class="eg-notice">No apps loaded from catalogue.</div>';
    }
    return state.catalogue.map(cat => `
      <div class="eg-cat">
        <div class="eg-cat-name">${esc(cat.name)}</div>
        <div class="eg-app-list">
          ${cat.apps.map(app => {
            const key    = app.repo;
            const checked = state.selectedApps.has(key);
            return `
              <label class="eg-app ${checked ? 'eg-app-checked' : ''}">
                <input type="checkbox" class="eg-app-cb" data-repo="${esc(app.repo)}"
                  data-branch="${esc(app.branch)}" data-name="${esc(app.name)}"
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
    if (!state.name && state.selectedApps.size === 0) {
      return '<div class="eg-notice">Fill in a name and select apps to see the preview.</div>';
    }
    const appsArr = [...state.selectedApps.values()];
    const json = JSON.stringify(
      appsArr.map(a => ({ url: `https://github.com/${a.repo}`, branch: a.branch })),
      null, 2
    );
    const versionLine = state.nextVersion
      ? `Suggested tag: <strong>${esc(state.nextVersion)}</strong> &nbsp;·&nbsp; Branch: <code>use-case/${esc(state.name) || '&lt;name&gt;'}</code>`
      : 'Fetching next version…';
    return `
      <div class="eg-preview">
        <div class="eg-preview-meta">${versionLine}</div>
        <pre class="eg-code">${esc(json)}</pre>
      </div>`;
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  let versionDebounce = null;

  function bindFormEvents() {
    const nameEl   = document.getElementById('eg-name');
    const descEl   = document.getElementById('eg-desc');
    const frappeEl = document.getElementById('eg-frappe');
    const form     = document.getElementById('eg-form');

    nameEl?.addEventListener('input', e => {
      state.name = e.target.value.trim();
      partialRenderPreview();
    });

    descEl?.addEventListener('input', e => { state.description = e.target.value; });

    frappeEl?.addEventListener('change', e => {
      state.frappeMajor = e.target.value;
      state.nextVersion = null;
      scheduleVersionFetch();
      partialRenderPreview();
    });

    document.querySelectorAll('.eg-app-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        const { repo, branch, name } = e.target.dataset;
        if (e.target.checked) {
          state.selectedApps.set(repo, { repo, branch, name });
        } else {
          state.selectedApps.delete(repo);
        }
        const label = e.target.closest('.eg-app');
        if (label) label.classList.toggle('eg-app-checked', e.target.checked);
        const countEl = document.querySelector('.eg-sel-count');
        if (countEl) countEl.textContent = `${state.selectedApps.size} selected`;
        partialRenderPreview();
      });
    });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!state.name || state.selectedApps.size === 0) return;
      state.phase       = 'submitting';
      state.submitError = null;
      renderApp();

      try {
        const res = await fetch(`${API}/api/create`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         state.name,
            description:  state.description,
            frappeMajor:  state.frappeMajor,
            apps:         [...state.selectedApps.values()],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        state.submitResult = data;
        state.phase = 'done';
      } catch (err) {
        state.submitError = err.message;
        state.phase = 'form';
      }
      renderApp();
    });
  }

  function partialRenderPreview() {
    const wrap = document.getElementById('eg-preview-wrap');
    if (wrap) wrap.innerHTML = renderPreview();
  }

  function scheduleVersionFetch() {
    clearTimeout(versionDebounce);
    versionDebounce = setTimeout(fetchNextVersion, 400);
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async function fetchNextVersion() {
    try {
      const res = await fetch(`${API}/api/next-version?major=${encodeURIComponent(state.frappeMajor)}`);
      if (res.ok) {
        const data = await res.json();
        state.nextVersion = data.tag;
        const metaEl = document.querySelector('.eg-preview-meta');
        if (metaEl) metaEl.innerHTML = renderPreview().match(/class="eg-preview-meta">(.*?)<\/div>/s)?.[1] ?? '';
      }
    } catch { /* non-fatal */ }
  }

  async function init() {
    const el = root();
    if (!el) return;

    renderApp();

    try {
      const [statusRes, catRes] = await Promise.all([
        fetch(`${API}/api/status`),
        fetch(`${API}/api/catalogue`),
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        state.tokenSet = !!s.github_token_set;
      }

      if (!catRes.ok) throw new Error(`Catalogue fetch failed: ${catRes.status}`);
      state.catalogue = await catRes.json();
    } catch (e) {
      state.loadError = e.message;
    }

    state.phase = 'form';
    renderApp();
    fetchNextVersion();
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    .eg-wrap { max-width: 780px; margin: 0 auto; padding: 24px 24px 40px; font-family: system-ui,-apple-system,sans-serif; }
    .eg-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .eg-header-icon { font-size:28px; }
    .eg-header-title { font-size:17px; font-weight:700; color:var(--fg,#e0e0f0); }
    .eg-header-sub { font-size:12px; color:var(--muted,#666); margin-top:2px; }
    .eg-warn { background:rgba(210,153,34,.1); border-left:3px solid #d29922; padding:10px 14px; border-radius:4px; font-size:12px; color:#d29922; margin-bottom:16px; }
    .eg-error { background:rgba(218,54,51,.1); border-left:3px solid #da3633; padding:10px 14px; border-radius:4px; font-size:12px; color:#da3633; margin-bottom:16px; }
    .eg-notice { font-size:12px; color:var(--muted,#666); padding:10px 0; }
    .eg-form { display:flex; flex-direction:column; gap:16px; }
    .eg-row2 { display:grid; grid-template-columns:1fr auto; gap:12px; }
    .eg-field { display:flex; flex-direction:column; gap:4px; }
    .eg-section-label { font-size:11px; font-weight:600; color:var(--muted,#555); text-transform:uppercase; letter-spacing:.5px; display:flex; align-items:center; gap:8px; margin-top:4px; }
    .eg-sel-count { font-weight:400; text-transform:none; letter-spacing:0; color:var(--fg,#aaa); }
    .eg-label { font-size:12px; color:var(--fg,#ccc); }
    .eg-hint { font-weight:400; color:var(--muted,#666); }
    .eg-input, .eg-select, .eg-textarea {
      background:var(--bg-2,#111128); border:1px solid var(--border,#2a2a4a);
      border-radius:6px; color:var(--fg,#e0e0f0); font-size:13px; padding:7px 10px;
      font-family:inherit;
    }
    .eg-input:focus, .eg-select:focus, .eg-textarea:focus { outline:none; border-color:#4a6aba; }
    .eg-select { padding-right:24px; }
    .eg-textarea { resize:vertical; }
    .eg-cat { margin-bottom:4px; }
    .eg-cat-name { font-size:11px; font-weight:600; color:var(--muted,#555); margin:8px 0 4px; text-transform:uppercase; letter-spacing:.4px; }
    .eg-app-list { display:flex; flex-direction:column; gap:2px; }
    .eg-app {
      display:flex; align-items:center; gap:8px; padding:6px 10px;
      border-radius:5px; cursor:pointer; border:1px solid transparent;
      transition:background .1s;
    }
    .eg-app:hover { background:var(--bg-2,#1a1a2a); }
    .eg-app-checked { background:rgba(88,166,255,.07); border-color:rgba(88,166,255,.2); }
    .eg-app input[type=checkbox] { accent-color:#58a6ff; width:14px; height:14px; flex-shrink:0; }
    .eg-app-icon { font-size:13px; flex-shrink:0; }
    .eg-app-name { font-size:13px; color:var(--fg,#e0e0f0); flex-shrink:0; }
    .eg-app-ref { font-size:11px; color:var(--muted,#666); font-family:monospace; margin-left:auto; }
    .eg-preview { background:var(--bg-2,#0d0d1e); border:1px solid var(--border,#2a2a4a); border-radius:6px; overflow:hidden; }
    .eg-preview-meta { font-size:12px; color:var(--muted,#888); padding:8px 12px; border-bottom:1px solid var(--border,#2a2a4a); }
    .eg-code { margin:0; padding:12px; font-size:12px; font-family:monospace; overflow-x:auto; color:var(--fg,#cce0ff); white-space:pre; }
    .eg-actions { display:flex; align-items:center; gap:12px; padding-top:4px; }
    .eg-actions-note { font-size:11px; color:var(--muted,#666); }
    .eg-btn { padding:8px 20px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid; }
    .eg-btn-primary { background:#1e3a6e; border-color:#2a5aba; color:#7ab0ff; }
    .eg-btn-primary:hover:not(:disabled) { background:#253e7e; }
    .eg-btn-primary:disabled { opacity:.4; cursor:default; }
    .eg-btn-ghost { background:none; border-color:var(--border,#444); color:var(--muted,#888); }
    .eg-btn-ghost:hover { border-color:#888; color:var(--fg,#ccc); }
    .eg-loading, .eg-done { padding:40px 24px; text-align:center; color:var(--muted,#888); font-size:13px; }
    .eg-done { display:flex; flex-direction:column; align-items:center; gap:12px; }
    .eg-done-icon { font-size:40px; }
    .eg-done-title { font-size:16px; font-weight:700; color:var(--fg,#e0e0f0); }
    .eg-done-link { color:#58a6ff; font-size:14px; text-decoration:none; }
    .eg-done-link:hover { text-decoration:underline; }
    .eg-done-meta { font-size:12px; color:var(--muted,#666); }
    html[data-theme="light"] .eg-wrap { color:#1a1a1a; }
    html[data-theme="light"] .eg-header-title { color:#1a1a2e; }
    html[data-theme="light"] .eg-input, html[data-theme="light"] .eg-select, html[data-theme="light"] .eg-textarea {
      background:#f5f5ff; border-color:#c0c0e0; color:#1a1a2e; }
    html[data-theme="light"] .eg-app:hover { background:#eaeaff; }
    html[data-theme="light"] .eg-app-checked { background:#dde8ff; border-color:#aaccee; }
    html[data-theme="light"] .eg-app-name { color:#1a1a2e; }
    html[data-theme="light"] .eg-preview { background:#f0f0fc; border-color:#c0c0e0; }
    html[data-theme="light"] .eg-code { color:#1a3a6e; }
    html[data-theme="light"] .eg-btn-primary { background:#ddeeff; border-color:#6699cc; color:#1a4080; }
    html[data-theme="light"] .eg-done-title { color:#1a1a2e; }
  `;
  document.head.appendChild(style);

  init();
})();
