# AGENTS_HISTORY

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
