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

// ── Local save ───────────────────────────────────────────────────────────────

function saveLocal({ name, description, frappeMajor, apps }) {
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

  // Build command for the user to run
  const buildCmd = `./scripts/build-local.sh ${name} v${frappeMajor}-r1`;
  return { path: `use-cases/${name}`, buildCmd };
}

// ── Request routing ───────────────────────────────────────────────────────────

async function GET({ subpath }) {
  if (subpath === 'api/status') {
    const token = !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
    return Response.json({ status: 'ok', version: '0.1.0', github_token_set: token });
  }

  if (subpath === 'api/catalogue') {
    return Response.json(parseCatalogue());
  }

  if (subpath.startsWith('api/next-version')) {
    const major = new URL(`http://x?${subpath.split('?')[1] || ''}`).searchParams.get('major') || '16';
    const tag   = await getNextVersion(major);
    return Response.json({ tag });
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
