# Agent Work History

## Session: 2026-05-30 — Logging System with File Rotation

### What was done
1. **Logger module** — Created `src/logger/` with singleton `Logger` class. Dual-sink output: VS Code OutputChannel ("Better LeetCode") + rotating file writer at `~/.better-leetcode/logs/`.
2. **File rotation** — Size-based: 5 MB per file, 5 rotated files retained (`app.log` → `app.1.log` → `app.5.log`). Oldest file pruned on overflow.
3. **Redaction** — Automatically strips `LEETCODE_SESSION=...` and `csrftoken=...` values from all log output.
4. **Log levels** — `DEBUG`/`INFO`/`WARN`/`ERROR` enum. User-configurable via `better-leetcode.logLevel` setting (default: `info`). Changes apply at runtime.
5. **Show Logs command** — `better-leetcode.showLogs` reveals the Output Channel in VS Code's Output panel.
6. **Integration** — Logging added to: API client (request/response/polling), auth (login/logout/session), tree providers (cache hits, fetches, errors), extension activation.

### Files created
- `src/logger/types.ts` — LogLevel enum, FileLogConfig, LoggerOptions
- `src/logger/Logger.ts` — Singleton Logger class
- `src/logger/index.ts` — Barrel exports

### Files modified
- `package.json` — `logLevel` setting + `showLogs` command
- `src/extension.ts` — Logger init, config listener, showLogs command
- `src/leetcode/client.ts` — Debug/error/info logs on all API calls
- `src/leetcode/auth.ts` — Login/logout/session verification logs
- `src/tree/AllProblemsTreeDataProvider.ts` — Replaced console.error, cache debug logs
- `src/tree/DailyChallengeTreeDataProvider.ts` — Fetch debug/error logs
- `src/tree/StudyListsTreeDataProvider.ts` — Study plan debug/error logs

### Build Status
- ✅ Compiles successfully (esbuild, 103.7kb)
- ✅ Lint clean on new files

## Session: 2026-05-28 — Testcase Parsing Rewrite & Per-Case Status

### What was done
1. **Deterministic testcase parsing** — Replaced heuristic `parseTestInputs` (which guessed lines-per-case from response array length) with deterministic parsing using `inputLineCount` stored in `.metadata.json`. Each test case now groups exactly N lines based on the function's parameter count.
2. **inputLineCount resolution chain** — Added `resolveInputLineCount()` with priority: global cache → `metaData.params.length` → HTML content parsing → default 1. The `metaData` field (JSON with function signature) is now fetched from LeetCode's GraphQL API.
3. **Global file cache** — `inputLineCount.json` stored at extension's `globalStorageUri` path. Since parameter counts never change, each problem is resolved once and cached permanently.
4. **HTML fallback** — When `metaData` is empty, counts `<strong>Input:</strong>` occurrences in problem HTML and divides total `exampleTestcases` lines to derive lines-per-case.
5. **Per-case status labels** — Sidebar now shows "Accepted"/"Wrong" text next to each case dot. Detail area shows `✅ Accepted` or `❌ Wrong Answer` header per case, so clicking a passing case no longer confusingly shows the global "Wrong Answer" banner.

### Files modified
- `src/leetcode/types.ts` — Added `metaData` to `ProblemDetails`, new `ProblemMetaData` interface
- `src/leetcode/client.ts` — Added `metaData` to GraphQL query
- `src/extension.ts` — Cache helpers, `resolveInputLineCount`, rewritten `parseTestInputs`, updated `handleOpenProblem`/`handleTestSolution`
- `src/webview/TestResultsPanel.ts` — Per-case status CSS, sidebar labels, detail header, JS `buildDetail`

### Build Status
- ✅ Compiles successfully (esbuild, 89.6kb)

## Session: 2026-05-27 — Show Problem Button, Language Switcher, Search Fix

### What was done
1. **Open Problem Statement button** — Added a "📄 Show Problem" button to the Test Results panel status banner. Uses `acquireVsCodeApi().postMessage()` to send an `openProblemStatement` command back to the extension host, which re-opens the problem description webview via `handleOpenProblem()`. Added `onMessage` callback pattern to `TestResultsPanel`.
2. **Language Switcher** — Added `better-leetcode.changeLanguage` command. Appears in the editor title bar (with `$(symbol-enum)` icon). Reads `.metadata.json` from the current file's directory, fetches all available code snippets for the problem, shows a QuickPick with all supported languages (marking the current one), creates the new language file with proper boilerplate, updates metadata, and opens the new file.
3. **Search fix (all ~4k problems)** — Search previously called `getProblemsList()` which only returns the synchronous in-memory cache. If the sidebar tree hadn't been expanded yet, this returned an empty array. Changed to `await loadProblemsAsync()` which triggers fetching from cache/API if needed. Added `loadProblemsAsync()` public method to `AllProblemsTreeDataProvider`.

### Files modified
- `src/webview/TestResultsPanel.ts` — Show Problem button, webview messaging, statusColor lint fix
- `src/extension.ts` — `handleChangeLanguage()`, async search, webview message handler
- `src/tree/AllProblemsTreeDataProvider.ts` — `loadProblemsAsync()` public method
- `package.json` — `changeLanguage` command + editor/title menu entry

### Build Status
- ✅ Compiles successfully (esbuild, 77.0kb)
- ✅ Lint passes (0 errors)


## Session: 2026-05-27 — Fix Test Results Panel Display

### What was done
1. **Fixed per-case data resolution** — Introduced `CaseData` type and `buildCases()` method that correctly handles **both** interpret (test) and submit response shapes. LeetCode's submit endpoint returns empty `code_answer`/`expected_answer` arrays, which previously caused all sidebar dots to show red and output/expected sections to be blank.
2. **Fixed sidebar dot pass/fail** — Dots now derive their state from resolved `CaseData.passed` rather than raw array comparison against potentially-empty arrays.
3. **Fixed empty output/expected sections** — Used explicit `hasOutput`/`hasExpected` boolean flags so sections render even when the value is an empty string (which is a valid LeetCode response).
4. **Added submission-specific fallbacks** — Failed submissions now show `last_testcase`, `expected_output`, and `code_output` scalar fields from the LeetCode response. Successful submissions with no per-case data show a "🎉 All test cases passed!" summary instead of empty cases.
5. **Fixed case count in status banner** — `getTotalCases()`/`getTotalCorrect()` now prefer `total_testcases`/`total_correct` from the result (always set for submissions) over array-derived counts.

### Build Status
- ✅ Compiles successfully (esbuild, 71.5kb)

---

## Session: 2026-05-27 — Test Results Panel & Boilerplate Code

### What was done
1. **Test Results Panel** — Created `WebviewViewProvider` at `src/webview/TestResultsPanel.ts` registered in VS Code's bottom panel area (like Azure tab). Shows test cases with pass/fail dots, status banner, runtime/memory bars, input/output/expected comparison.
2. **Boilerplate Manager** — Created `src/leetcode/boilerplate.ts`. Wraps LeetCode snippets with lang-specific boilerplate (Go: `package main`, Java: imports, Python: typing/collections, C/C++: includes, C#: using, Rust: `struct Solution;`, PHP: `<?php`). Strips boilerplate on submit using original snippet pattern matching.
3. **API Methods** — Added `interpretSolution()`, `submit()`, `checkSubmissionStatus()` REST methods to `src/leetcode/client.ts`. Polls every 1.5s, max 30 attempts.
4. **Types** — Added `InterpretResponse`, `SubmitResponse`, `SubmissionCheckResult` to `src/leetcode/types.ts`.
5. **Command Wiring** — Replaced stub test/submit commands in `extension.ts` with full implementations. Stores `.metadata.json` per problem for round-trip boilerplate extraction. Reads `testcases.txt` for test input.
6. **Package.json** — Added `panel` viewsContainer and `better-leetcode.views.testResults` webview view.

### Build Status
- ✅ Compiles successfully (esbuild, 67.6kb)

### Remaining Work
- Unit tests for `BoilerplateManager` and new client methods
- Manual E2E testing with real LeetCode account

