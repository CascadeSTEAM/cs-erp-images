# frontmatter-validate

## Rule

All markdown files in governed directories must have valid YAML frontmatter with
the required fields present and non-empty.

Required fields by directory:

| Path | Required fields |
|------|----------------|
| `proposals/*.md` (not approved/) | title, author, created, tags, approved, created_by, assigned_to |
| `plans/*.md` (not completed/) | title, status, author, created, proposal_source, priority, assigned_to |

## Rationale

Frontmatter is the source of truth for document state in DocWright. Missing fields
break the lifecycle enforcement, the index, and the AI's ability to reason about
document status. The pre-commit hook rejects commits with invalid frontmatter;
this atom makes the same check available to AI agents without requiring a commit.

## Examples

Passing proposal frontmatter:
```yaml
title: "My Proposal"
author: NetYeti
created: 2026-06-17
tags: [tooling]
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
```

Failing (missing `created_by`):
```yaml
title: "My Proposal"
author: NetYeti
created: 2026-06-17
tags: [tooling]
approved: false
assigned_to: ""
```

## Scope

Applies during proposal creation (`scope: proposal`) and plan creation/editing
(`scope: plan`). Mirrors `validate_required_fields()` in `scripts/pre-commit.sh`.
