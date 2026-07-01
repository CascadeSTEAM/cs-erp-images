// Generated from check.ts by npm run build:atoms — do not edit manually.
// src/policy-atoms-core/checks/field-required-when.ts
function fieldRequiredWhen(field, conditionField, triggerValues) {
  return (ctx) => {
    const condVal = String(ctx.frontmatter[conditionField] ?? "");
    if (!triggerValues.includes(condVal)) {
      return { pass: true, message: `${conditionField}='${condVal}' \u2014 '${field}' not required`, atom_id: "" };
    }
    const val = ctx.frontmatter[field];
    const valStr = Array.isArray(val) ? val[0] : val;
    const missing = valStr === void 0 || valStr === null || String(valStr).trim() === "" || String(valStr).trim().toLowerCase() === "none";
    return {
      pass: !missing,
      message: missing ? `'${field}' is required when ${conditionField}='${condVal}' but is missing or empty` : `'${field}' present as required when ${conditionField}='${condVal}'`,
      atom_id: ""
    };
  };
}

// policies/no-work-before-approval/check.ts
var requireAssignee = fieldRequiredWhen("assigned_to", "status", ["approved", "in-progress"]);
function check(ctx) {
  const result = requireAssignee(ctx);
  return { ...result, atom_id: "no-work-before-approval" };
}
export {
  check
};
