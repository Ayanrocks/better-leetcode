# AGENTS_HISTORY

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

- `.vscodeignore`
- `package.json`
- `CHANGELOG.md`
- `src/webview/ProblemWebview.ts`
- `src/webview/DiscussionWebview.ts`
- `src/webview/TestResultsPanel.ts`
- `src/leetcode/client.ts`

## 2026-06-14 — Add Open VSX Badge to README

### What was done

1. Added Open VSX downloads badge to `README.md` next to the VS Code installs badge.
2. Labeled the badge "Open VSX" instead of "downloads" or "installs".

### Files modified

- `README.md`
