#!/usr/bin/env bash
# Create a new use-case scaffold: use-cases/<name>/apps.json + README.md
set -euo pipefail

NAME="${1:?Usage: $0 <name> \"<description>\"}"
DESCRIPTION="${2:?Usage: $0 <name> \"<description>\"}"

if ! [[ "$NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo "Error: name must be kebab-case (lowercase letters, digits, hyphens)" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UC_DIR="${REPO_ROOT}/use-cases/${NAME}"
TEMPLATE="${REPO_ROOT}/use-cases/TEMPLATE.md"

if [ -d "$UC_DIR" ]; then
    echo "Error: use-case '${NAME}' already exists (${UC_DIR})" >&2
    exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
    echo "Error: use-cases/TEMPLATE.md not found" >&2
    exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "${TMPDIR}/apps.json" << 'EOF'
[
  {
    "url": "https://github.com/frappe/erpnext",
    "branch": "version-16"
  }
]
EOF

sed "s|{{NAME}}|${NAME}|g; s|{{DESCRIPTION}}|${DESCRIPTION}|g" "$TEMPLATE" > "${TMPDIR}/README.md"

mv "$TMPDIR" "$UC_DIR"

echo "Created use-cases/${NAME}/"
echo "  apps.json — edit to add apps (url + branch per entry)"
echo "  README.md — edit to fill in deployment details"
