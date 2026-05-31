# Agent History

## 2026-05-31: Cache Refresh Fix & Relocation

**Problem**: New LeetCode problems (#3945) not appearing after sidebar refresh. Cache stale at #3944.

**Root cause**: `refresh(false)` only cleared memory cache; disk cache (1-week TTL) served stale data.

**Changes**:
- `AllProblemsTreeDataProvider.ts`: Full rewrite — cache relocated to `~/.better-leetcode/cache/problems_cache.json`, added incremental diff refresh, full refresh, delete cache
- `extension.ts`: Fixed refresh wiring to use incremental mode, added `fullRefreshProblems` and `deleteCache` commands
- `package.json`: Registered two new palette commands

**Status**: Build passes. Ready for testing.

## 2026-05-31: Collapsible Problem Topic Tags

**Problem**: Add collapsible topic tags to the problem description webview, hidden by default.

**Changes**:
- `types.ts`: Added `topicTags` to `ProblemDetails` interface.
- `client.ts`: Updated `questionData` GraphQL query to fetch `topicTags`.
- `ProblemWebview.ts`: Designed a premium collapsible button and tags container using CSS Grid transition tricks, plus toggle scripts.
- `leetcode.test.ts`: Added unit tests, resolved test compilation/logger warnings.
- `TestResultsPanel.ts`: Fixed pre-existing unused variable compiler errors.

**Status**: Build and all 13 tests pass. Collapsible tags are successfully rendered.
