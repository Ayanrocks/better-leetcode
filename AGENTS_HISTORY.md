# Agent History

## 2026-05-31: Contests Section in Sidebar

**Problem**: Add a new "Contests" section in the sidebar to fetch past contests and their corresponding questions.

**Changes**:
- `types.ts`/`index.ts`: Added types `LeetCodeContest`, `ContestQuestion`, and `ContestInfo`.
- `client.ts`: Implemented `getContests()` using GraphQL query (with fallback) and `getContestInfo()` using REST API endpoint. Updated client-wide User-Agent to Firefox to bypass Cloudflare 403 Forbidden on REST requests.
- `ContestsTreeDataProvider.ts`: Created new tree data provider rendering last 5 contests (collapsible) and their 4 problems. Cross-references solve status with `AllProblemsTreeDataProvider` cache.
- `extension.ts`/`package.json`: Registered view `better-leetcode.views.contests` and hooked up refresh actions.
- `leetcode.test.ts`: Added unit tests for contest API queries.

**Status**: Build and all 16 tests pass. Contests section is fully functional.

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
