/**
 * commitlint configuration for PondiFarmApp.
 *
 * Enforces Conventional Commits — see CONTRIBUTING.md §4 for the full list
 * of accepted types. Configuration is intentionally close to the default
 * "conventional" preset with a few tighter rules suited to a multi-person
 * proprietary repository.
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "test",
        "build",
        "ci",
        "chore",
        "security",
        "revert"
      ]
    ],
    "type-case":          [2, "always", "lower-case"],
    "type-empty":         [2, "never"],
    "subject-empty":      [2, "never"],
    "subject-case":       [0],
    "subject-full-stop":  [2, "never", "."],
    "header-max-length":  [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"]
  }
};
