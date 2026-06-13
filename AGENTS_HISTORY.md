# AGENTS_HISTORY

## 2026-06-13 — Render Markdown, HTML, Emojis, and Code Blocks Natively with XSS Protection

### What was done

1. Refactored `TextRenderer.render` in `src/utils/textRenderer.ts` to decode double-escaped strings first, then parse using `marked` (with breaks enabled), and finally sanitize the resulting HTML using `xss` library to prevent XSS vulnerabilities.
2. Configured custom whitelist in `xss` filter to allow safe inline styling/classes on elements, and to restrict `iframe` sources strictly to `leetcode.com` or `leetcode.cn`.
3. Extracted LaTeX math blocks (`$math$` and `$$math$$`) into alphanumeric placeholders before markdown parsing to protect backslashes and math operators (like `<`) from being stripped/modified, and restored them HTML-escaped using a function callback to avoid special replacement pattern (`$$`) substitution in JavaScript `replace()`.
4. Integrated `TextRenderer.render` into `ProblemWebview.ts` for rendering problem hints securely and formatting HTML/Markdown content appropriately.
5. Updated existing unit tests in `src/test/suite/textRenderer.test.ts` to assert correct parsed HTML output, and added new tests to cover markdown formatting, HTML, styling, script tag sanitization, iframe domain restriction, and math equation block preservation.
6. Installed npm packages `marked` and `xss` which are successfully bundled by `esbuild`.

### Files modified

- `package.json`
- `src/utils/textRenderer.ts`
- `src/webview/ProblemWebview.ts`
- `src/test/suite/textRenderer.test.ts`

## 2026-06-10 — Refactoring, Documentation, Security, and Code Quality Improvements

### What was done

1. Updated `AGENTS_HISTORY.md`, `CHANGELOG.md`, and `README.md` to properly document the v1.3.0 discussion browsing feature and format direct SQL Support.
2. Updated `package.json` scripts to run via `bun`.
3. Extracted duplicate GraphQL `DiscussPost` fragment in `src/leetcode/client.ts`.
4. Fixed layout resolution bug in `src/extension.ts` and added unit test.
5. Implemented XSS protection in `TextRenderer.render` and `ProblemWebview` hints rendering.
6. Refactored `DiscussionWebview` to use non-mutating mapped objects.
7. Fixed various TypeScript compilation and ESLint issues in modified files.
8. Removed obsolete/debug JavaScript files (`run-test.js`, `test-api.js`, `test-viewcolumn.js`, `test-vscode-api.js`).

### Files modified/deleted

- `package.json`
- `AGENTS_HISTORY.md`
- `CHANGELOG.md`
- `README.md`
- `src/extension.ts`
- `src/leetcode/client.ts`
- `src/utils/textRenderer.ts`
- `src/webview/DiscussionWebview.ts`
- `src/webview/ProblemWebview.ts`
- `src/test/suite/extension.test.ts`
- `src/test/suite/textRenderer.test.ts`
- `run-test.js` [DELETE]
- `test-api.js` [DELETE]
- `test-viewcolumn.js` [DELETE]
- `test-vscode-api.js` [DELETE]

## 2026-06-10 — Bump Version to v1.3.0 and Update Documentation

### What was done

1. Bumped the extension version to `1.3.0` in `package.json`.
2. Added discussion browsing feature:
   - Implemented `DiscussionWebview` to show threaded discussions for problems.
   - Added `getDiscussionComments` and `getCommentReplies` GraphQL client methods in `LeetCodeClient`.
   - Added `TextRenderer` utility to format and render raw HTML/unicode comment text.
   - Integrated the "Show Discussions" button into `ProblemWebview` and added `topicId` to the `ProblemDetails` type/GraphQL query.
3. Updated `CHANGELOG.md` with the additions in version `1.3.0` (Hints support, Discussion browsing, and CSRF/Session Fixation protection for Web Authorization callback flow) and updated the comparison links.
4. Updated `README.md` to detail new features since `v1.0.0` (including Web Authorization login, direct SQL support, problem hints, interactive language switching, new shortcuts, and UI improvements), added the new discussion browsing feature, and documented the browser-based authorization flow.

### Files modified

- `package.json`
- `CHANGELOG.md`
- `README.md`
- `src/extension.ts`
- `src/leetcode/client.ts`
- `src/leetcode/types.ts`
- `src/utils/textRenderer.ts`
- `src/webview/DiscussionWebview.ts`
- `src/webview/ProblemWebview.ts`
