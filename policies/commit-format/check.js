// Generated from check.ts by npm run build:atoms — do not edit manually.
// src/policy-atoms-core/checks/regex-match.ts
function regexMatch(pattern, field, flags = "") {
  const re = new RegExp(pattern, flags);
  return (ctx) => {
    const value = field ? String(ctx.frontmatter[field] ?? "") : ctx.content;
    const subject = field ? `field '${field}'` : "file content";
    const pass = re.test(value);
    return {
      pass,
      message: pass ? `${subject} matches /${pattern}/${flags}` : `${subject} does not match /${pattern}/${flags}`,
      atom_id: ""
    };
  };
}

// policies/commit-format/check.ts
var COMMIT_FORMAT_RE = "^(feat|fix|docs|refactor|test|chore|policy|decision): .+";
function check(ctx) {
  const firstLine = ctx.content.split("\n")[0].replace(/\r$/, "");
  const result = regexMatch(COMMIT_FORMAT_RE)({ ...ctx, content: firstLine });
  return {
    ...result,
    atom_id: "commit-format",
    message: result.pass ? "commit message format is valid" : `commit message "${firstLine}" does not match '<type>: <description>'. Valid types: feat|fix|docs|refactor|test|chore|policy|decision`
  };
}
export {
  check
};
