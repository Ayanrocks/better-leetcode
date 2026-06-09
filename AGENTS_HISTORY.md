# AGENTS_HISTORY

## 2026-06-10 — Bump Version to v1.3.0 and Update Documentation

### What was done

1. Bumped the extension version to `1.3.0` in `package.json`.
2. Updated `CHANGELOG.md` with the additions in version `1.3.0` (Hints support and CSRF/Session Fixation protection for Web Authorization callback flow) and updated the comparison links.
3. Updated `README.md` to detail new features since `v1.0.0` (including Web Authorization login, direct SQL support, problem hints, interactive language switching, new shortcuts, and UI improvements) and documented the browser-based authorization flow.

### Files modified

- `package.json`
- `CHANGELOG.md`
- `README.md`

## 2026-06-09 — Add Hints Support

### What was done

1. Added `hints?: string[]` to `ProblemDetails` interface.
2. Updated GraphQL query to fetch `hints`.
3. Updated `ProblemWebview` to conditionally show a "Show Hints" dropdown to view hints line by line.

### Files modified

- `src/leetcode/types.ts`
- `src/leetcode/client.ts`
- `src/webview/ProblemWebview.ts`

## 2026-06-05 — Bump version to v1.2.1 and update CHANGELOG.md

### What was done

1. Updated extension version from `1.2.0` to `1.2.1` in `package.json`.
2. Added a changelog entry in `CHANGELOG.md` under `[1.2.1] - 2026-06-05` documenting the bug fix where helper functions/code defined above the main solution function were incorrectly stripped.
3. Added the comparison link for `[1.2.1]` at the bottom of `CHANGELOG.md`.

### Files modified

- `package.json`
- `CHANGELOG.md`

## 2026-06-05 — Fix Boilerplate Code Extraction Order

### What was done

1. Fixed a bug in `BoilerplateManager.extractSolutionCode` where helper functions or structs defined above the main entrypoint function/class were discarded during submission or testing.
2. Swapped Strategy 1 (originalSnippet matching) and Strategy 2 (known prefix stripping) so that prefix stripping is prioritized. This ensures that the boilerplate prefix is cleanly removed from the top of the file without discarding user-written code that sits above the main LeetCode class/function.
3. Added a unit test in `src/test/suite/boilerplate.test.ts` to verify that helper functions written above the main solution code are correctly preserved when extracting solution code.

### Files modified

- `src/leetcode/boilerplate.ts`
- `src/test/suite/boilerplate.test.ts`

## 2026-06-03 — Implement CSRF and Session Fixation Protection

### What was done

1. Implemented a one-time pending authentication marker (`pendingAuth`) on `LeetCodeAuthManager` to prevent CSRF and session-fixation attacks during the Web Authorization callback flow.
2. Enabled `pendingAuth = true` immediately before launching the web browser authorization URL in `src/extension.ts`.
3. Validated the authority (host) and path of incoming custom scheme callback URIs in `handleUri` to match the extension's lowercase context ID (e.g. `ayanrocks.better-leetcode`) and `/` or `""` path.
4. Updated existing test cases in `src/test/suite/leetcode.test.ts` to mock the extension context ID, set `pendingAuth = true` where success or validation flow testing is expected, and asserted that failed callbacks do not persist bad credentials.
5. Added new unit tests verifying rejection of unauthorized callbacks (due to missing pending requests or incorrect authority/path).

### Files modified

- `src/leetcode/auth.ts`
- `src/extension.ts`
- `src/test/suite/leetcode.test.ts`

## 2026-06-02 — Implement Auth State Refresh & Sidebar Controls

### What was done

1. Subscribed to `authManager.onDidChangeSession` in `src/extension.ts` to trigger a global refresh via `better-leetcode.refresh` whenever the authentication state changes (such as logging in or out).
2. Added individual refresh commands (`better-leetcode.refreshDailyChallenge`, `better-leetcode.refreshAllProblems`, `better-leetcode.refreshStudyLists`, and `better-leetcode.refreshContests`) so that clicking the refresh button on a specific view header only refreshes that specific view section.
3. Corrected extension publisher identifier from `better-leetcode-team` to `ayanrocks` in test suite assertions.
4. Refactored `statusBar.test.ts` mock implementations and test logic to be fully type-safe, eliminating all explicit `any` types and `@ts-ignore` statements to comply with standard TypeScript guidelines.

### Files modified

- `package.json`
- `src/extension.ts`
- `src/test/suite/extension.test.ts`
- `src/test/suite/statusBar.test.ts`

## 2026-06-02 — Update README Badges and Add Changelog

### What was done
1. Updated `README.md` badges to use the modern `vsmarketplacebadges.dev` service instead of the retired `shields.io` Visual Studio Marketplace endpoints.
2. Formatted all README badges (Version, Installs, License, Buy Me A Coffee) to use the modern `for-the-badge` style to match the aesthetic of `Ileriayo/markdown-badges`.
3. Created a standard `CHANGELOG.md` file following the "Keep a Changelog" format to document past releases (v1.0.0, v1.0.1, v1.0.2).

### Files modified/created
- `README.md` — updated badges to use vsmarketplacebadges.dev `for-the-badge` style and corrected item publisher casing
- `CHANGELOG.md` — created new standard changelog file

## 2026-06-02 — Fix Language Tracking Bugs

### What was done
Fixed two bugs in `src/extension.ts`:

1. **Daily problem editor focus**: `handleOpenProblem` was using `vscode.workspace.textDocuments` (includes closed/cached docs) to check for existing editors. Changed to `vscode.window.visibleTextEditors` so it only detects actually visible tabs. When a visible tab exists for the problem, only the webview refreshes — the editor is left untouched. When no tab is visible, the default language file opens.

2. **Language switcher showing wrong language**: `handleChangeLanguage` was reading `metadata.lang` to determine the current language. Changed to derive language from the active tab's file extension via new exported function `deriveLangFromExtension()`.

### Key changes
- Extracted duplicated `extToLangMap` into module-level `EXT_TO_LANG_MAP` constant
- Added exported `deriveLangFromExtension(filePath)` utility
- Removed now-unused `showEditorIfAlreadyOpen` parameter from `handleOpenProblem`
- Fixed pre-existing TS2532 errors (unsafe `codeSnippets[0]` access)
- Added 13 tests for `deriveLangFromExtension` and `EXT_TO_LANG_MAP`

### Files modified
- `src/extension.ts` — core fixes
- `src/test/suite/extension.test.ts` — new tests

### Test status
- 61 passing, 4 failing (pre-existing status bar naming mismatches, unrelated)

## 2026-06-02 — Web Authorization Login Flow (v1.1.0)

### What was done

Added a Web Authorization login flow matching LeetCode's official `authorize-login` endpoint, used by `vscode-leetcode`. Users now see a QuickPick with two options:

1. **Web Authorization (Recommended)** — opens browser to `${endpoint}/authorize-login/${uriScheme}/?path=${extensionId}`. LeetCode redirects back to VS Code via custom URI scheme with cookie in query params.
2. **LeetCode Cookie** — manual fallback using the existing clipboard/paste cookie flow.

### Key changes

- `src/leetcode/auth.ts` — added `handleUri(uri)` method to parse cookie from URI callback and login
- `src/extension.ts` — split `handleSignIn` into QuickPick + `handleCookieSignIn`; registered `vscode.window.registerUriHandler` in `activate()`; updated `handleShowUser` signature to pass `context`
- `src/test/suite/leetcode.test.ts` — added 3 tests: valid URI login, missing cookie param, invalid cookie graceful failure

### Test status

- 64 passing, 4 failing (pre-existing status bar naming mismatches, unrelated)
