# Changelog

## Unreleased

- fix: patch frappe/wiki's `User.after_insert` hook in the custom image —
  it re-saved a stale mid-insert doc, so every new-User creation failed with
  `TimestampMismatchError` on multi-app builds (#7)

- Initial scaffold: `helpdesk` use case (ERPNext + Helpdesk + Telephony)
- GitHub Actions matrix build on version tag
- Local build helper script
