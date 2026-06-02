# Changelog

All notable changes to the "better-leetcode" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to [Semantic Versioning](https://semver.org/).

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

[1.0.2]: https://github.com/Ayanrocks/better-leetcode/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Ayanrocks/better-leetcode/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Ayanrocks/better-leetcode/releases/tag/v1.0.0
