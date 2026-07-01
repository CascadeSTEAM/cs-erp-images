# commit-format

## Rule

All commit messages must follow the format `<type>: <description>` on the first line.

Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `policy`, `decision`

The description must be non-empty. No trailing period required or forbidden.

## Rationale

Consistent commit format enables automated changelog generation, semantic versioning,
and makes git history scannable. DocWright's versioning policy (0.MINOR.PATCH) depends
on commit type to infer the nature of changes.

## Examples

Passing:
- `feat: add vault adoption script`
- `fix: correct js-yaml require path in hook installer`
- `docs: update vault-portability reference`
- `chore: remove stale dependabot PRs`

Failing:
- `Added vault adoption script` (no type prefix)
- `feat:add thing` (missing space after colon)
- `wip: work in progress` (invalid type)

## Scope

This rule applies to every git commit (`scope: git-commit`). It mirrors the
enforcement in `.githooks/commit-msg` which runs on every `git commit` invocation.
The atom check is the AI-readable equivalent of that hook.
