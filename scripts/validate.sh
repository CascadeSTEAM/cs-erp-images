#!/usr/bin/env bash
# Validate all use-cases/*/apps.json: valid JSON + GitHub branch/tag reachable
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

check_ref() {
    local repo="$1" ref="$2"
    local auth_header=""
    [ -n "${GITHUB_TOKEN:-}" ] && auth_header="-H \"Authorization: token ${GITHUB_TOKEN}\""

    local branch_status tag_status
    branch_status=$(curl -sf -o /dev/null -w "%{http_code}" \
        ${auth_header:+-H "Authorization: token ${GITHUB_TOKEN}"} \
        "https://api.github.com/repos/${repo}/branches/${ref}" 2>/dev/null || true)

    if [ "$branch_status" = "200" ]; then
        echo "    OK (branch): ${repo}@${ref}"
        return 0
    fi

    tag_status=$(curl -sf -o /dev/null -w "%{http_code}" \
        ${auth_header:+-H "Authorization: token ${GITHUB_TOKEN}"} \
        "https://api.github.com/repos/${repo}/git/ref/tags/${ref}" 2>/dev/null || true)

    if [ "$tag_status" = "200" ]; then
        echo "    OK (tag): ${repo}@${ref}"
        return 0
    fi

    echo "    ERROR: '${ref}' not found in ${repo}" >&2
    return 1
}

shopt -s nullglob
JSONS=("${REPO_ROOT}"/use-cases/*/apps.json)
shopt -u nullglob

if [ ${#JSONS[@]} -eq 0 ]; then
    echo "No use cases found under use-cases/" >&2
    exit 1
fi

for APPS_JSON in "${JSONS[@]}"; do
    UC=$(basename "$(dirname "$APPS_JSON")")
    echo "Validating use-cases/${UC}/apps.json ..."

    if ! jq empty "$APPS_JSON" 2>/dev/null; then
        echo "  ERROR: invalid JSON in ${APPS_JSON}" >&2
        FAIL=1
        continue
    fi

    COUNT=$(jq length "$APPS_JSON")
    for i in $(seq 0 $((COUNT - 1))); do
        URL=$(jq -r ".[$i].url // empty" "$APPS_JSON")
        BRANCH=$(jq -r ".[$i].branch // empty" "$APPS_JSON")

        if [ -z "$URL" ]; then
            echo "  ERROR: entry $i missing 'url'" >&2
            FAIL=1
            continue
        fi
        if [ -z "$BRANCH" ]; then
            echo "  ERROR: entry $i (${URL}) missing 'branch'" >&2
            FAIL=1
            continue
        fi

        REPO=$(echo "$URL" | sed 's|https://github.com/||')
        if ! check_ref "$REPO" "$BRANCH"; then
            FAIL=1
        fi
    done
done

echo ""
if [ "$FAIL" = "1" ]; then
    echo "Validation FAILED." >&2
    exit 1
fi
echo "All use cases valid."
