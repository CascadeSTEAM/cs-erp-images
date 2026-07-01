// Generated from check.ts by npm run build:atoms — do not edit manually.
// src/policy-atoms-core/checks/field-required.ts
function fieldRequired(field) {
  return (ctx) => {
    const val = ctx.frontmatter[field];
    const missing = val === void 0 || val === null || val === "" || Array.isArray(val) && val.length === 0;
    return {
      pass: !missing,
      message: missing ? `required frontmatter field '${field}' is missing or empty` : `field '${field}' present`,
      atom_id: ""
    };
  };
}

// policies/frontmatter-validate/check.ts
var PROPOSAL_FIELDS = ["title", "author", "created", "tags", "approved", "created_by", "assigned_to"];
var PLAN_FIELDS = ["title", "status", "author", "created", "proposal_source", "priority", "assigned_to"];
function check(ctx) {
  const isProposal = ctx.filePath.match(/^proposals\/[^/]+\.md$/) && !ctx.filePath.includes("proposals/approved/");
  const isPlan = ctx.filePath.match(/^plans\/[^/]+\.md$/) && !ctx.filePath.includes("plans/completed/");
  const fields = isProposal ? PROPOSAL_FIELDS : isPlan ? PLAN_FIELDS : null;
  if (!fields) {
    return { pass: true, message: "file not in a governed directory \u2014 skipped", atom_id: "frontmatter-validate" };
  }
  for (const field of fields) {
    if (field === "mode" || field === "automated") {
      const hasMode = ctx.frontmatter["mode"] !== void 0 && ctx.frontmatter["mode"] !== "";
      const hasAuto = ctx.frontmatter["automated"] !== void 0 && ctx.frontmatter["automated"] !== "";
      if (!hasMode && !hasAuto) {
        return { pass: false, message: "required field 'mode' (or legacy 'automated') is missing", atom_id: "frontmatter-validate" };
      }
      continue;
    }
    const result = fieldRequired(field)(ctx);
    if (!result.pass) {
      return { ...result, atom_id: "frontmatter-validate" };
    }
  }
  return { pass: true, message: "all required frontmatter fields present", atom_id: "frontmatter-validate" };
}
export {
  check
};
