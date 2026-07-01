# no-work-before-approval

## Rule

Active implementation work must not begin on a plan until it has `status: approved`
or `status: in-progress`. Plans at those statuses must have `assigned_to` set to a
non-empty value — an unassigned active plan is a governance gap.

Plans at `status: draft` or `status: waiting` are in a pre-approval state; no
`assigned_to` requirement applies.

## Rationale

The `assigned_to` field creates accountability: someone is on record as responsible
for the work. Approving or activating a plan without an assignee leaves it in a
liminal state where it is theoretically active but no one is driving it. This leads
to stale plans and unclear responsibility chains.

The pre-commit hook (`validate_assigned_to()` in `scripts/pre-commit.sh`) blocks
commits that move a plan to `approved` or `in-progress` without an assignee.
This atom makes the same check available to AI agents at any point in the workflow.

## Examples

Passing (in-progress with assignee):
```yaml
status: in-progress
assigned_to: NetYeti
```

Passing (draft, no assignee required):
```yaml
status: draft
assigned_to: ""
```

Failing (approved but no assignee):
```yaml
status: approved
assigned_to: ""
```

Failing (in-progress with None):
```yaml
status: in-progress
assigned_to: None
```

## Scope

Applies to all plan files (`scope: plan`). Mirrors `validate_assigned_to(FILE, "plan")`
in `scripts/pre-commit.sh`.
