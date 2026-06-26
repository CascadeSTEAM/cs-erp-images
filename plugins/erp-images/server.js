'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const VAULT_ROOT = process.env.DOCWRIGHT_VAULT_ROOT || process.cwd();
const GH_ORG    = 'CascadeSTEAM';
const GH_REPO   = 'cs-erp-images';

// ── GitHub API helper ─────────────────────────────────────────────────────────

function githubRequest(method, endpoint, body) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Accept':     'application/vnd.github.v3+json',
      'User-Agent': 'docwright-erp-images-plugin/0.1',
    };
    if (token)   headers['Authorization']  = `token ${token}`;
    if (bodyStr) headers['Content-Type']   = 'application/json';
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(
      { hostname: 'api.github.com', path: endpoint, method, headers },
      (res) => {
        let data = '';
        res.on('data', d => { data += d; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(`GitHub ${res.statusCode}: ${parsed.message || data}`));
            } else {
              resolve(parsed);
            }
          } catch {
            res.statusCode >= 400 ? reject(new Error(`GitHub ${res.statusCode}: ${data}`)) : resolve(data);
          }
        });
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Catalogue parser ──────────────────────────────────────────────────────────

const SKIP_SECTIONS = new Set([
  'How to read this table',
  'Use-Case Images',
  'Not Frappe Apps',
  'Gaps',
  'Verification Queue',
  'Revisit at Scale',
  'Changelog',
  'Third-Party AI Integrations',
]);

const SKIP_PRIORITIES = new Set(['built-in', 'revisit-at-scale', 'watch-upstream']);

function parseCatalogue() {
  const mdPath = path.join(VAULT_ROOT, 'docs/app-catalogue.md');
  if (!fs.existsSync(mdPath)) return [];

  const lines   = fs.readFileSync(mdPath, 'utf-8').split('\n');
  const results = [];
  let category  = null;
  let headers   = [];
  let inTable   = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('## ')) {
      const title = line.slice(3).replace(/\s*\(.*?\)\s*$/, '').trim();
      if (SKIP_SECTIONS.has(title) || [...SKIP_SECTIONS].some(s => title.startsWith(s))) {
        category = null;
      } else {
        category = { name: title, apps: [] };
        results.push(category);
      }
      headers = [];
      inTable = false;
      continue;
    }

    if (!category) continue;

    if (line.startsWith('|') && !inTable) {
      headers = line.split('|').map(h => h.trim().toLowerCase()).filter(Boolean);
      inTable = true;
      continue;
    }

    if (/^\|[-| ]+\|/.test(line)) continue;

    if (line.startsWith('|') && inTable) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      const row   = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });

      const statusRaw   = row['status']   || '';
      const priorityRaw = row['priority'] || '';

      if (statusRaw.includes('🗄') || statusRaw.includes('❌')) continue;
      if (SKIP_PRIORITIES.has(priorityRaw)) continue;

      // Extract clean repo path from "owner/repo" or markdown link
      const repoRaw  = row['repo'] || '';
      const repoMatch = repoRaw.match(/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
      if (!repoMatch) continue;

      const name = (row['app'] || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
      if (!name) continue;

      category.apps.push({
        name,
        repo:       repoMatch[1],
        branch:     row['branch'] || 'main',
        status:     statusRaw.includes('✅') ? 'confirmed'
                  : statusRaw.includes('🚧') ? 'not-production'
                  : 'unverified',
        statusIcon: statusRaw.includes('✅') ? '✅'
                  : statusRaw.includes('⚠')  ? '⚠️'
                  : statusRaw.includes('🚧') ? '🚧'
                  : '❓',
        priority:   priorityRaw,
        images:     row['images'] || '',
        notes:      row['notes']  || '',
      });
    } else if (line !== '' && !line.startsWith('|')) {
      inTable = false;
    }
  }

  return results.filter(c => c.apps.length > 0);
}

// ── Version calculator ────────────────────────────────────────────────────────

async function getNextVersion(frappeMajor) {
  try {
    const refs  = await githubRequest('GET', `/repos/${GH_ORG}/${GH_REPO}/git/refs/tags`);
    const pattern = new RegExp(`^refs/tags/v${frappeMajor}-r(\\d+)$`);
    let maxN = 0;
    for (const ref of (Array.isArray(refs) ? refs : [])) {
      const m = (ref.ref || '').match(pattern);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    return `v${frappeMajor}-r${maxN + 1}`;
  } catch {
    return `v${frappeMajor}-r1`;
  }
}

// ── PR creator ────────────────────────────────────────────────────────────────

async function createPR({ name, description, frappeMajor, apps }) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (!token) throw new Error('GITHUB_TOKEN not set — add it to cs-erp-images/.env');

  // 1. Get main branch SHA
  const mainRef = await githubRequest('GET', `/repos/${GH_ORG}/${GH_REPO}/git/ref/heads/main`);
  const sha     = mainRef.object.sha;

  // 2. Create branch
  const branchName = `use-case/${name}`;
  await githubRequest('POST', `/repos/${GH_ORG}/${GH_REPO}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha,
  });

  // 3. Calculate version tag
  const tag = await getNextVersion(frappeMajor);

  // 4. apps.json
  const appsJson = JSON.stringify(
    apps.map(a => ({ url: `https://github.com/${a.repo}`, branch: a.branch })),
    null, 2,
  ) + '\n';
  await githubRequest('PUT', `/repos/${GH_ORG}/${GH_REPO}/contents/use-cases/${name}/apps.json`, {
    message: `feat(${name}): add apps.json`,
    content: Buffer.from(appsJson).toString('base64'),
    branch:  branchName,
  });

  // 5. README.md from TEMPLATE.md
  const templatePath = path.join(VAULT_ROOT, 'use-cases/TEMPLATE.md');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf-8')
    : `# {{NAME}}\n\n**Image:** \`ghcr.io/cascadesteam/erp-{{NAME}}\`\n\n{{DESCRIPTION}}\n`;
  const readme = template
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{DESCRIPTION\}\}/g, description);
  await githubRequest('PUT', `/repos/${GH_ORG}/${GH_REPO}/contents/use-cases/${name}/README.md`, {
    message: `feat(${name}): add README`,
    content: Buffer.from(readme).toString('base64'),
    branch:  branchName,
  });

  // 6. Open PR
  const appList = apps.map(a => `- \`${a.repo}\` @ \`${a.branch}\``).join('\n');
  const pr = await githubRequest('POST', `/repos/${GH_ORG}/${GH_REPO}/pulls`, {
    title: `feat: add ${name} use case`,
    body:  `## New use case: \`${name}\`\n\n${description}\n\n### Apps\n${appList}\n\n**Suggested tag:** \`${tag}\`\n\n*Created via DocWright ERP Images plugin*`,
    head:  branchName,
    base:  'main',
  });

  return { pr_url: pr.html_url, tag, branch: branchName };
}

// ── Versioning ────────────────────────────────────────────────────────────────

// Tag format: v{frappe_major}.{release}.{patch}
//   frappe_major  — Frappe major version (16, 15, 17…); changes when you upgrade Frappe
//   release       — increments when the app list changes or breaking config is required;
//                   existing deployments may need rebuilding or reconfiguration
//   patch         — increments on rebuild with dependency/security updates only;
//                   no breaking changes, safe drop-in replacement
// Examples: v16.1.0  v16.1.3  v16.2.0  v15.4.1

function calcNextTag(name, frappeMajor, _apps, majorBump) {
  const { execFileSync } = require('child_process');
  const TAG_RE = /^v\d+\.(\d+)\.(\d+)$/;

  let maxR = 0, maxP = 0, hasTag = false;
  try {
    const out = execFileSync('docker', [
      'images', `ghcr.io/cascadesteam/erp-${name}`, '--format', '{{.Tag}}',
    ], { encoding: 'utf-8', timeout: 5000 });
    for (const tag of out.trim().split('\n').filter(Boolean)) {
      const m = tag.match(TAG_RE);
      if (m) {
        hasTag = true;
        const r = parseInt(m[1], 10), p = parseInt(m[2], 10);
        if (r > maxR || (r === maxR && p > maxP)) { maxR = r; maxP = p; }
      }
    }
  } catch { /* docker unavailable */ }

  let nextR, nextP, bumpType;
  if (!hasTag)        { nextR = 1;       nextP = 0;       bumpType = 'initial'; }
  else if (majorBump) { nextR = maxR + 1; nextP = 0;       bumpType = 'release'; }
  else                { nextR = maxR;    nextP = maxP + 1; bumpType = 'patch';   }

  return { tag: `v${frappeMajor}.${nextR}.${nextP}`, major: frappeMajor, release: nextR, patch: nextP, bumpType };
}

// ── Local save ───────────────────────────────────────────────────────────────

function saveLocal({ name, description, frappeMajor, apps, majorBump = false }) {
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid use-case name');
  if (!apps || apps.length === 0) throw new Error('No apps selected');

  const ucDir = path.join(VAULT_ROOT, 'use-cases', name);
  fs.mkdirSync(ucDir, { recursive: true });

  // apps.json
  const appsJson = JSON.stringify(
    apps.map(a => ({ url: `https://github.com/${a.repo}`, branch: a.branch })),
    null, 2,
  ) + '\n';
  fs.writeFileSync(path.join(ucDir, 'apps.json'), appsJson, 'utf-8');

  // README.md from TEMPLATE.md
  const templatePath = path.join(VAULT_ROOT, 'use-cases/TEMPLATE.md');
  const template = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf-8')
    : `# {{NAME}}\n\n**Image:** \`ghcr.io/cascadesteam/erp-{{NAME}}\`\n\n{{DESCRIPTION}}\n`;
  const readme = template
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{DESCRIPTION\}\}/g, description);
  fs.writeFileSync(path.join(ucDir, 'README.md'), readme, 'utf-8');

  const { tag, major, release, patch, bumpType } = calcNextTag(name, frappeMajor, apps, majorBump);
  const buildCmd = `./scripts/build-local.sh ${name} ${tag}`;
  return { path: `use-cases/${name}`, buildCmd, nextTag: tag, major, release, patch, bumpType };
}

// ── Use-case list ────────────────────────────────────────────────────────────

function listUseCases() {
  const ucDir = path.join(VAULT_ROOT, 'use-cases');
  if (!fs.existsSync(ucDir)) return [];

  const { execFileSync } = require('child_process');
  const results = [];

  for (const entry of fs.readdirSync(ucDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const appsPath = path.join(ucDir, entry.name, 'apps.json');
    if (!fs.existsSync(appsPath)) continue;

    let apps = [];
    try { apps = JSON.parse(fs.readFileSync(appsPath, 'utf-8')); } catch { continue; }

    let builtTags = [];
    try {
      const out = execFileSync('docker', [
        'images', `ghcr.io/cascadesteam/erp-${entry.name}`,
        '--format', '{{.Tag}}',
      ], { encoding: 'utf-8', timeout: 5000 });
      builtTags = out.trim().split('\n').filter(Boolean);
    } catch { /* docker unavailable or no image — leave empty */ }

    results.push({ name: entry.name, apps, builtTags, source: 'local' });
  }
  return results;
}

// ── Target list ───────────────────────────────────────────────────────────────

function listTargets() {
  const defaults = [
    { id: 'local', name: 'Local (Docker)', type: 'local',
      description: 'Build and run on this machine' },
  ];
  const configPath = path.join(VAULT_ROOT, '.erp-images-targets.json');
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const extra = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return [...defaults, ...(extra.targets || [])];
  } catch { return defaults; }
}

// ── Build (SSE stream) ────────────────────────────────────────────────────────

function buildStream(name, tag) {
  const buildScript = path.join(VAULT_ROOT, 'scripts/build-local.sh');
  if (!fs.existsSync(buildScript)) {
    throw new Error('scripts/build-local.sh not found in vault root');
  }

  const { spawn } = require('child_process');
  const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
  const sseEvent = (event, obj) => `event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`;

  const stream = new ReadableStream({
    start(ctrl) {
      const enc = (s) => ctrl.enqueue(Buffer.from(s));
      const proc = spawn('bash', [buildScript, name, tag], { cwd: VAULT_ROOT });

      proc.stdout.on('data', d => enc(sse({ line: d.toString() })));
      proc.stderr.on('data', d => enc(sse({ line: d.toString() })));
      proc.on('close', code => {
        enc(sseEvent('done', { code }));
        ctrl.close();
      });
      proc.on('error', err => {
        enc(sseEvent('error', { message: err.message }));
        ctrl.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ── Request routing ───────────────────────────────────────────────────────────

async function GET({ request, subpath }) {
  const url = new URL(request.url);
  const sp  = url.searchParams;

  if (subpath === 'api/status') {
    const token = !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
    return Response.json({ status: 'ok', version: '0.1.0', github_token_set: token });
  }

  if (subpath === 'api/catalogue') {
    return Response.json(parseCatalogue());
  }

  if (subpath === 'api/next-version') {
    const major = sp.get('major') || '16';
    const tag   = await getNextVersion(major);
    return Response.json({ tag });
  }

  if (subpath === 'api/use-cases') {
    return Response.json(listUseCases());
  }

  if (subpath === 'api/use-case') {
    const name = sp.get('name');
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return new Response('invalid or missing name', { status: 400 });
    }
    const ucDir  = path.join(VAULT_ROOT, 'use-cases', name);
    const appsPath = path.join(ucDir, 'apps.json');
    if (!fs.existsSync(appsPath)) {
      return new Response(`use-case "${name}" not found`, { status: 404 });
    }
    const apps = JSON.parse(fs.readFileSync(appsPath, 'utf-8'));
    const readmePath = path.join(ucDir, 'README.md');
    const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf-8') : '';
    // Extract description — first non-empty line after the **Image:** line
    const descMatch = readme.match(/\*\*Image:\*\*[^\n]+\n\n([^#\n][^\n]+)/);
    const description = descMatch ? descMatch[1].trim() : '';
    return Response.json({ name, apps, description });
  }

  if (subpath === 'api/targets') {
    return Response.json(listTargets());
  }

  if (subpath === 'api/use-case-published') {
    const name = sp.get('name');
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return new Response('invalid name', { status: 400 });
    }
    const { execFileSync } = require('child_process');
    try {
      // If the file exists on origin/main it has been pushed
      const out = execFileSync('git', [
        'log', '--oneline', 'origin/main',
        '--', `use-cases/${name}/apps.json`,
      ], { cwd: VAULT_ROOT, encoding: 'utf-8', timeout: 5000 });
      return Response.json({ published: out.trim().length > 0 });
    } catch {
      return Response.json({ published: false });
    }
  }

  if (subpath === 'api/next-tag') {
    const name  = sp.get('name');
    const major = sp.get('major') || '16';
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return new Response('invalid or missing name', { status: 400 });
    }
    const result = calcNextTag(name, major, [], false); // always patch bump for preview
    return Response.json(result);
  }

  if (subpath === 'api/build') {
    const name = sp.get('name');
    const tag  = sp.get('tag') || `v${sp.get('major') || '16'}-r1`;
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      return new Response('invalid or missing name', { status: 400 });
    }
    try { return buildStream(name, tag); }
    catch (e) { return new Response(e.message, { status: 500 }); }
  }

  if (subpath === 'api/help') {
    const helpPath = path.join(VAULT_ROOT, '.erp-images-help.md');
    const content  = fs.existsSync(helpPath) ? fs.readFileSync(helpPath, 'utf-8') : null;
    return Response.json({ content, hasCustom: content !== null });
  }

  if (subpath === 'api/remote-images') {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    if (!token) return Response.json({ available: false, packages: [] });
    try {
      const pkgs = await githubRequest('GET', `/orgs/${GH_ORG}/packages?package_type=container&per_page=50`);
      const erpPkgs = Array.isArray(pkgs) ? pkgs.filter(p => p.name?.startsWith('erp-')) : [];
      const result = [];
      for (const pkg of erpPkgs) {
        const enc  = encodeURIComponent(pkg.name);
        const vers = await githubRequest('GET', `/orgs/${GH_ORG}/packages/container/${enc}/versions?per_page=50`);
        const tags = (Array.isArray(vers) ? vers : [])
          .flatMap(v => v.metadata?.container?.tags ?? [])
          .filter(t => /^v\d+\.\d+\.\d+$/.test(t))
          .sort().reverse();
        result.push({ name: pkg.name.replace('erp-', ''), fullName: pkg.name, tags });
      }
      return Response.json({ available: true, packages: result });
    } catch (e) {
      return Response.json({ available: false, error: e.message, packages: [] });
    }
  }

  return new Response(`erp-images: unknown path "${subpath}"`, { status: 404 });
}

async function POST({ request, subpath }) {
  if (subpath === 'api/create') {
    try {
      const body = await request.json();
      const result = await createPR(body);
      return Response.json(result);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  if (subpath === 'api/help') {
    const body    = await request.json();
    const helpPath = path.join(VAULT_ROOT, '.erp-images-help.md');
    fs.writeFileSync(helpPath, body.content ?? '', 'utf-8');
    return Response.json({ ok: true });
  }

  if (subpath === 'api/delete-local') {
    try {
      const { name } = await request.json();
      if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid name');

      // Hard block: refuse if the use case has ever been pushed to origin/main
      const { execFileSync } = require('child_process');
      try {
        const log = execFileSync('git', [
          'log', '--oneline', 'origin/main', '--', `use-cases/${name}/apps.json`,
        ], { cwd: VAULT_ROOT, encoding: 'utf-8', timeout: 5000 });
        if (log.trim().length > 0) {
          return Response.json({
            error: `"${name}" has been pushed to origin/main and may be in use. Deletion blocked. To remove it, open a PR on GitHub.`,
          }, { status: 403 });
        }
      } catch { /* git unavailable — allow deletion */ }

      // Remove use-cases/<name>/ directory
      const ucDir = path.join(VAULT_ROOT, 'use-cases', name);
      if (!fs.existsSync(ucDir)) throw new Error(`Use case "${name}" not found`);
      fs.rmSync(ucDir, { recursive: true, force: true });

      // Remove local Docker images for this use case
      let removedImages = [];
      try {
        const images = execFileSync('docker', [
          'images', `ghcr.io/cascadesteam/erp-${name}`, '--format', '{{.Repository}}:{{.Tag}}',
        ], { encoding: 'utf-8', timeout: 5000 }).trim().split('\n').filter(Boolean);
        for (const img of images) {
          execFileSync('docker', ['rmi', img], { encoding: 'utf-8', timeout: 30000 });
          removedImages.push(img);
        }
      } catch { /* docker unavailable or no images */ }

      return Response.json({ deleted: name, removedImages });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  if (subpath === 'api/save-local') {
    try {
      const body = await request.json();
      const result = saveLocal(body);
      return Response.json(result);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  }

  return new Response('Not found', { status: 404 });
}

module.exports = { GET, POST };
