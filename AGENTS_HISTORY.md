# Agent History

## 2026-05-31: Cache Refresh Fix & Relocation

**Problem**: New LeetCode problems (#3945) not appearing after sidebar refresh. Cache stale at #3944.

**Root cause**: `refresh(false)` only cleared memory cache; disk cache (1-week TTL) served stale data.

**Changes**:
- `AllProblemsTreeDataProvider.ts`: Full rewrite — cache relocated to `~/.better-leetcode/cache/problems_cache.json`, added incremental diff refresh, full refresh, delete cache
- `extension.ts`: Fixed refresh wiring to use incremental mode, added `fullRefreshProblems` and `deleteCache` commands
- `package.json`: Registered two new palette commands

**Status**: Build passes. Ready for testing.
