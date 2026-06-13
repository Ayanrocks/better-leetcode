# Changelog

All notable changes to the "better-leetcode" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.2] - 2026-06-14

### Security

- Added `.vscodeignore` to exclude source files, test output, and large media assets from the VSIX
  package, reducing the package size from ~23 MB back to ~500 KB and resolving the
  Microsoft Marketplace virus check failure.
- Added Content Security Policy (CSP) meta tags with per-request nonces to all three webview
  panels (`ProblemWebview`, `DiscussionWebview`, `TestResultsPanel`) as required by the
  VS Code Marketplace for extensions using `enableScripts: true`.
- Sanitized LeetCode problem statement HTML (`details.content`) through the `TextRenderer`
  XSS filter before injection into `ProblemWebview` (previously rendered raw).
- Escaped all API-sourced string values (`title`, `difficulty`, `tag.name`, `questionFrontendId`)
  via `escapeHtml()` before HTML template injection.
- Replaced `innerHTML` / inline `onclick` patterns in `DiscussionWebview` with safe DOM API
  calls (`createElement`, `textContent`, `addEventListener`, `dataset`).
- Validated avatar URLs in `DiscussionWebview` to allow only `https://` scheme before setting
  `img.src`, preventing `javascript:` or `data:` URI injection.
- URL-encoded `titleSlug` and `submissionId` using `encodeURIComponent()` in all REST API
  path constructions in `LeetCodeClient`.
- Bundled KaTeX CSS and fonts locally under `resources/katex/` instead of loading from
  `cdn.jsdelivr.net`, eliminating the external CDN dependency in webviews.

## [1.3.1] - 2026-06-13

### Added

- GitHub Actions continuous integration pipeline (`ci.yml`) automating linting, formatting check, compiling, multi-OS tests, and extension packaging validation.
- Enhanced markdown, HTML, and LaTeX rendering in problem statements and hints with secure HTML sanitization via `xss` and markdown parsing via `marked`.
- High-visibility styling on the status bar (red background/alert indicators) when logged out to improve user awareness of authentication state.

### Fixed

- Over 117 ESLint and TypeScript compilation errors across the codebase.
- Disabled overly strict JSDoc validation rules to improve development speed while maintaining code quality.
- Fixed status bar controller test assertions.

## [1.3.0] - 2026-06-10

### Added

- Threaded discussion browsing using `DiscussionWebview` with paginated comment and reply fetching, reply pagination, navigation, and seamless UI integration.
- Dropdown in the problem details panel to display problem hints line-by-line.
- CSRF and session fixation protection for Web Authorization callback flow.

## [1.2.1] - 2026-06-05

### Fixed

- Issue where helper functions and other code defined above the main solution function were incorrectly stripped during code extraction (by prioritizing prefix-based extraction strategy).

## [1.2.0] - 2026-06-03

### Added

- Automatic refreshing of LeetCode data across the extension on authentication state changes.
- Manual global refresh button across views.
- Account icon that directly opens the user's LeetCode profile in the browser.
- Web Authorization flow for improved authentication.

## [1.0.2] - 2026-06-02

### Added

- Quick keyboard shortcuts (`Cmd+;` / `Ctrl+;` to Test solution, `Cmd+Enter` / `Ctrl+Enter` to Submit solution) active when a LeetCode editor is focused.
- Interactive configuration to change the default programming language and default SQL language on the fly.
- Extension logo in PNG format to fix SVG publishing restrictions on VS Marketplace.
- Demo preview GIF, licensing metadata, and support links to README.

### Fixed

- Issue where the default language config was not picked correctly for daily challenges.
- Cleanup of unnecessary temporary files from vsix packaging.

## [1.0.1] - 2026-06-01

### Added

- Direct SQL and database problem support with customized SQL language configurations (MySQL, MS SQL, Oracle SQL, PostgreSQL).
- Visual problem tags display in the problem statement panel.
- Enhanced sidebar icons and user interface refinements.
- Core telemetry and logging module with automatic log rotation.
- Search filter and cache refreshing logic for problems.

### Fixed

- Bug where the test results panel would not open properly.
- Test case parsing logic and solutions tab rendering issues.
- Handling of study lists errors and proper color coding for problem difficulty levels.

## [1.0.0] - 2026-05-30

### Added

- Initial release of Better LeetCode.
- Core LeetCode session token and CSRF token authentication.
- Sidebar explorer views for Daily Challenge, all Problems list, Study Lists, and Contests.
- Interactive problem statement viewer (WebView) and automatic file generation.
- Native VS Code integration (syntax highlighting, IntelliSense, auto-complete).
- Standard testing and solution submission against LeetCode engines.

[1.3.2]: https://github.com/Ayanrocks/better-leetcode/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/Ayanrocks/better-leetcode/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Ayanrocks/better-leetcode/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Ayanrocks/better-leetcode/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Ayanrocks/better-leetcode/compare/v1.0.2...v1.2.0
[1.0.2]: https://github.com/Ayanrocks/better-leetcode/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Ayanrocks/better-leetcode/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Ayanrocks/better-leetcode/releases/tag/v1.0.0
