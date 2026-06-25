(function () {
  const root = document.getElementById('plugin-root');
  if (!root) return;

  root.innerHTML = [
    '<div style="padding:32px 28px;font-family:system-ui,-apple-system,sans-serif;max-width:640px">',
    '  <h2 style="margin:0 0 8px;font-size:20px;color:var(--fg,#e0e0f0)">🐳 ERP Images</h2>',
    '  <p style="margin:0 0 24px;font-size:13px;color:var(--muted,#888)">',
    '    Frappe/ERPNext Docker image pipeline — Module 0 scaffold active.',
    '  </p>',
    '  <div style="display:flex;flex-direction:column;gap:12px">',
    '    <div class="erp-card">',
    '      <div class="erp-card-title">📦 Image Generator</div>',
    '      <div class="erp-card-body">Select apps from the catalogue, name a use case,',
    '        and generate a versioned GitHub PR that triggers a CI image build.</div>',
    '      <span class="erp-badge erp-badge-soon">Coming in Phase 3</span>',
    '    </div>',
    '    <div class="erp-card">',
    '      <div class="erp-card-title">🚀 Customer Deployment</div>',
    '      <div class="erp-card-body">Select an existing GHCR image, fill in customer',
    '        details, and generate an Ansible deployment in one form.</div>',
    '      <span class="erp-badge erp-badge-soon">Coming in Phase 4</span>',
    '    </div>',
    '  </div>',
    '  <p style="margin:24px 0 0;font-size:11px;color:var(--muted,#555)">',
    '    Plugin scaffold verified ✓ — build full UI in <code>plugins/erp-images/client/</code>',
    '  </p>',
    '</div>',
  ].join('');

  // Inject scoped styles
  const style = document.createElement('style');
  style.textContent = [
    '.erp-card{background:var(--bg-2,#1a1a2a);border:1px solid var(--border,#2a2a4a);',
    '  border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:6px}',
    '.erp-card-title{font-size:14px;font-weight:700;color:var(--fg,#e0e0f0)}',
    '.erp-card-body{font-size:12px;color:var(--muted,#888);line-height:1.5}',
    '.erp-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;',
    '  border-radius:10px;width:fit-content}',
    '.erp-badge-soon{background:rgba(88,166,255,.12);color:#58a6ff;border:1px solid rgba(88,166,255,.3)}',
    'html[data-theme="light"] .erp-card{background:#f5f5ff;border-color:#d0d0e8}',
    'html[data-theme="light"] .erp-card-title{color:#1a1a2e}',
    'html[data-theme="light"] .erp-card-body{color:#555}',
  ].join('');
  document.head.appendChild(style);
})();
