Added support for LeetCode database problems. 
- Mapped DB languages (`mysql`, `mssql`, `oraclesql`, `postgresql`) to `.sql` file extensions in `src/extension.ts`. 
- Implemented language-specific VSCode syntax highlighting using `setTextDocumentLanguage` with appropriate fallbacks to generic `sql`.
- Added `better-leetcode.defaultDbLanguage` configuration. When opening a problem, if the user's `defaultLanguage` is not available but the problem supports DB languages, it falls back to `defaultDbLanguage`.
- Fixed metadata sync: opening an existing problem reads and preserves its metadata instead of blindly overwriting it with the default language.
- Added a "Reset to default snippet" feature when changing language to the currently active language, fixing issues where file content falls out of sync with metadata.
