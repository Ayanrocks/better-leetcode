# AGENTS_HISTORY

## 2026-06-13 — Fix Logger Test Suite Teardown Flakiness

### What was done

1. Fixed a Windows-specific test cleanup issue in `src/test/suite/logger.test.ts`. Modified `teardown()` to be asynchronous and retry `fs.rmSync()` with a short delay if it fails due to asynchronous file locking (`ENOTEMPTY`).
2. Verified all tests pass successfully.

### Files modified

- `src/test/suite/logger.test.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in auth.ts

### What was done

1. Fixed all `require-jsdoc` and `valid-jsdoc` lint errors in `src/leetcode/auth.ts` by adding JSDoc comments to the constructor and private/public methods.
2. Verified that project linter (`bun run lint`) and tests (`bun run test`) pass successfully.

### Files modified

- `src/leetcode/auth.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in extension.ts

### What was done

1. Fixed all `require-jsdoc` and `valid-jsdoc` lint errors in `src/extension.ts` by adding missing JSDoc comments/annotations for parameters and returns.
2. Verified that ESLint check passes successfully.

### Files modified

- `src/extension.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in TestResultsPanel.ts

### What was done

1. Fixed all `require-jsdoc` and `valid-jsdoc` lint errors in `src/webview/TestResultsPanel.ts` by adding missing JSDoc comments to the constructor, `resolveWebviewView` method, and all private helper methods.
2. Verified that ESLint now compiles with zero errors for `src/webview/TestResultsPanel.ts`.

### Files modified

- `src/webview/TestResultsPanel.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in DiscussionWebview.ts

### What was done

1. Fixed all `require-jsdoc` lint errors in `src/webview/DiscussionWebview.ts` by adding JSDoc comments to the class, constructor, and all methods.
2. Verified that ESLint checks pass successfully.

### Files modified

- `src/webview/DiscussionWebview.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in DailyChallengeTreeDataProvider.ts

### What was done

1. Fixed all `require-jsdoc` lint errors in `src/tree/DailyChallengeTreeDataProvider.ts` by adding JSDoc comments to the class declaration, constructor, methods, and helper functions.
2. Verified that ESLint check passes successfully.

### Files modified

- `src/tree/DailyChallengeTreeDataProvider.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in StudyListsTreeDataProvider.ts

### What was done

1. Fixed all `require-jsdoc` lint errors in `src/tree/StudyListsTreeDataProvider.ts` by adding missing JSDoc comments to classes (`StudyPlanItem`, `FavoriteListItem`, `StudyPlanGroupItem`, `StudyPlanProblemItem`, `StudyListsTreeDataProvider`), their constructors, and methods (`getDifficultyDescription`, `getDifficultyIcon`, `refresh`, `getTreeItem`, `getChildren`).
2. Verified that ESLint check now passes successfully.

### Files modified

- `src/tree/StudyListsTreeDataProvider.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in textRenderer.ts

### What was done

1. Added JSDoc comment for `TextRenderer` class to resolve the `require-jsdoc` lint error.
2. Verified that ESLint now passes with zero JSDoc lint errors for `src/utils/textRenderer.ts`.

### Files modified

- `src/utils/textRenderer.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in Logger.ts

### What was done

1. Fixed all `require-jsdoc` and `valid-jsdoc` lint errors in `src/logger/Logger.ts` by adding missing JSDoc comments to class constructor, parameters, and return types.
2. Verified that ESLint check passes successfully.

### Files modified

- `src/logger/Logger.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in ProblemWebview.ts

### What was done

1. Fixed all `require-jsdoc` lint errors in `src/webview/ProblemWebview.ts` by adding JSDoc comments to the class declaration, constructor, and methods.
2. Verified that ESLint check passes successfully.

### Files modified

- `src/webview/ProblemWebview.ts`

## 2026-06-13 — Fix JSDoc Lint Errors in statusBar.ts

### What was done

1. Fixed all `require-jsdoc` lint errors in `src/statusBar.ts` by adding a descriptive JSDoc comment for the `LeetCodeStatusBarController` constructor.
2. Verified that ESLint checks now pass completely without JSDoc or style errors.

### Files modified

- `src/statusBar.ts`

## 2026-06-13 — Bump Version to v1.3.1 and Update Changelog

### What was done

1. Bumped the extension version to `1.3.1` in `package.json`.
2. Updated `CHANGELOG.md` to document the changes introduced since `1.3.0`, including the GitHub Actions CI pipeline, enhanced markdown/HTML rendering with XSS protection, high-visibility status bar logging alert, and ESLint/TypeScript compilation fixes.

### Files modified

- `package.json`
- `CHANGELOG.md`

## 2026-06-13 — Fix JSDoc Lint Errors in client.ts

### What was done

1. Fixed all `require-jsdoc` and `valid-jsdoc` lint errors in `src/leetcode/client.ts` by adding/updating JSDoc comments with correct `@param` and `@returns` tags.
2. Verified that ESLint check passes successfully.

### Files modified

- `src/leetcode/client.ts`

## 2026-06-13 — Harden CI Workflows, Upgraded KaTeX, Pin Bun and Fail-Closed Premium Checks

### What was done

1. Hardened `.github/workflows/ci.yml` by adding a top-level `permissions` block with `contents: read`, adding `persist-credentials: false` to all `actions/checkout` steps, and pinning all actions to specific commit SHAs.
2. Added `"packageManager": "bun@1.3.14"` to `package.json`.
3. Upgraded KaTeX CDN stylesheet links from `v0.16.8` to `v0.17.0` in `src/webview/DiscussionWebview.ts` and `src/webview/ProblemWebview.ts` to align with the package version in `package.json`.
4. Refactored the premium-access check in `src/extension.ts` to fail closed using the strict `status?.isPremium === true` requirement.
5. Added status bar color assertions (`item.color === 'white'`) in `src/test/suite/statusBar.test.ts`.
6. Hardened questionId parsing in `src/leetcode/client.ts` to guard against NaN results.
7. Verified that all formatting, linting, and 92 unit tests pass successfully.

### Files modified

- `.github/workflows/ci.yml`
- `package.json`
- `src/webview/DiscussionWebview.ts`
- `src/webview/ProblemWebview.ts`
- `src/extension.ts`
- `src/test/suite/statusBar.test.ts`
- `src/leetcode/client.ts`

## 2026-06-14 — Fix Virus Check Failure & Security Hardening (v1.3.2)

### What was done

1. Created a `.vscodeignore` file to exclude `src/`, `out/`, `node_modules/`, test outputs, and large media assets from the generated VSIX, reducing the package size from ~23 MB to ~398 KB and resolving the Microsoft Marketplace virus check failure.
2. Added Content Security Policy (CSP) meta tags with dynamically generated nonces to all webviews (`ProblemWebview`, `DiscussionWebview`, `TestResultsPanel`) to satisfy the VS Code Marketplace security requirements for extensions using `enableScripts: true`.
3. Hardened `ProblemWebview` by passing raw LeetCode problem HTML (`details.content`) through the `TextRenderer` XSS filter before injection. Escaped all API-sourced string values.
4. Hardened `DiscussionWebview` by replacing `innerHTML` and inline `onclick` attributes with safe DOM APIs (`createElement`, `textContent`, `addEventListener`) and validating `avatarUrl` to only allow `https://`.
5. Hardened `src/leetcode/client.ts` by wrapping `titleSlug` and `submissionId` inside `encodeURIComponent()` to prevent path injection in REST API calls.
6. Bundled KaTeX CSS and fonts locally under `resources/katex/` to remove the external `cdn.jsdelivr.net` dependency from the webviews.
7. Bumped version to `1.3.2` and updated `CHANGELOG.md`.

### Files modified

- `.vscodeignore` (created)
- `package.json`
- `CHANGELOG.md`
- `src/webview/ProblemWebview.ts`
- `src/webview/DiscussionWebview.ts`
- `src/webview/TestResultsPanel.ts`
- `src/leetcode/client.ts`
