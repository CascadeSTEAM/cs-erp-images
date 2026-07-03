#!/usr/bin/env python3
"""
auto-build.py — retry-until-clean local build loop.

Runs scripts/build-local.sh for a use case; on failure, identifies the app
that broke the build, records it as excluded (with a reason) in
use-cases/<name>/build-status.json, removes it from apps.json, and retries.
Stops when a build succeeds, or when it runs out of apps to drop.

Usage:
  python3 scripts/auto-build.py <use-case> <tag> [frappe-branch]
"""
import json
import re
import subprocess
import sys
import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MAX_ATTEMPTS = 15

NOISY_LINE = re.compile(
    r"verbose.*(Copying|Creating directory|Linking|Extracting|Resolving|Fetching)"
)


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_apps(apps_path):
    return json.loads(apps_path.read_text())


def save_apps(apps_path, apps):
    apps_path.write_text(json.dumps(apps, indent=2) + "\n")


def load_status(status_path):
    if status_path.exists():
        return json.loads(status_path.read_text())
    return {}


def save_status(status_path, status):
    status_path.write_text(json.dumps(status, indent=2) + "\n")


def app_name_from_url(url):
    return url.rstrip("/").rsplit("/", 1)[-1]


def detect_failing_app(log_text, apps):
    """Find which app's install broke the build, matched against apps.json entries."""
    candidates = []
    # Directory paths under apps/<name> mentioned near the failure are the
    # strongest signal (survives cases where the log's "Installing X" name
    # doesn't match the actual on-disk dir, e.g. frappe-mcp vs "mcp").
    candidates += re.findall(r"apps/([a-zA-Z0-9_-]+)/", log_text)
    candidates += [m.split()[0] for m in re.findall(r"^Installing ([a-zA-Z0-9_-]+)", log_text, re.M)]
    candidates = list(reversed(candidates))  # most-recent-first

    names = {app_name_from_url(a["url"]): a for a in apps}
    for cand in candidates:
        if cand in names:
            return names[cand]
    # fuzzy: candidate contains or is contained by a known app name
    for cand in candidates:
        for name, app in names.items():
            if name in cand or cand in name:
                return app
    return None


SPECIFIC_ERROR = re.compile(
    r"(Error|Exception|error:|ERROR:)\b.*(?:not found|No such file|incompatible|failed|not support|not read)",
    re.IGNORECASE,
)


def extract_reason(log_text):
    lines = [l for l in log_text.splitlines() if not NOISY_LINE.search(l)]
    lines = [l for l in lines if l.strip()]
    # Prefer a specific, named exception/error line over the generic
    # "did not complete successfully" wrapper that always appears last.
    specific = [l for l in lines if SPECIFIC_ERROR.search(l)]
    if specific:
        idx = lines.index(specific[-1])
        excerpt = lines[max(0, idx - 3):idx + 1]
    else:
        excerpt = lines[-25:]
    return "\n".join(excerpt)[-1500:]


def run_build(use_case, tag, frappe_branch, log_path):
    cmd = ["bash", str(REPO_ROOT / "scripts" / "build-local.sh"), use_case, tag, frappe_branch]
    with open(log_path, "w") as f:
        proc = subprocess.run(cmd, cwd=REPO_ROOT, stdout=f, stderr=subprocess.STDOUT)
    return proc.returncode


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <use-case> <tag> [frappe-branch]", file=sys.stderr)
        sys.exit(1)
    use_case = sys.argv[1]
    tag = sys.argv[2]
    frappe_branch = sys.argv[3] if len(sys.argv) > 3 else "version-16"

    apps_path = REPO_ROOT / "use-cases" / use_case / "apps.json"
    status_path = REPO_ROOT / "use-cases" / use_case / "build-status.json"
    log_dir = REPO_ROOT.parent / "auto-build-logs"
    log_dir.mkdir(exist_ok=True)

    status = load_status(status_path)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        apps = load_apps(apps_path)
        print(f"=== Attempt {attempt}: building {use_case}:{tag} with {len(apps)} apps ===")
        log_path = log_dir / f"{use_case}-{tag}-attempt{attempt}.log"
        rc = run_build(use_case, tag, frappe_branch, log_path)

        if rc == 0:
            print(f"SUCCESS on attempt {attempt}. Log: {log_path}")
            ts = now()
            for a in apps:
                name = app_name_from_url(a["url"])
                status[name] = {"state": "verified", "verified_at": ts, "branch": a["branch"]}
            save_status(status_path, status)
            print("DONE: clean image built, build-status.json updated.")
            return 0

        print(f"FAILED on attempt {attempt} (exit {rc}). Diagnosing...")
        log_text = log_path.read_text(errors="replace")
        failing_app = detect_failing_app(log_text, apps)

        if not failing_app:
            print("Could not identify the failing app automatically. Stopping for manual review.")
            print(f"See log: {log_path}")
            return 2

        name = app_name_from_url(failing_app["url"])
        reason = extract_reason(log_text)
        print(f"Identified failing app: {name} — dropping it.")

        status[name] = {
            "state": "excluded",
            "excluded_at": now(),
            "branch": failing_app["branch"],
            "reason": f"[auto-detected, see {log_path.name}] {reason}",
        }
        save_status(status_path, status)

        apps = [a for a in apps if app_name_from_url(a["url"]) != name]
        save_apps(apps_path, apps)

    print("Exhausted max attempts without a clean build.")
    return 3


if __name__ == "__main__":
    sys.exit(main())
