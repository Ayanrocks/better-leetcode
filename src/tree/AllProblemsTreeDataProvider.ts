import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LeetCodeAuthManager } from '../leetcode';
import { Problem } from '../leetcode/types';
import { Logger } from '../logger';

interface ProblemCacheData {
  timestamp: number;
  questions: Problem[];
}

/**
 * Returns the canonical cache directory for Better LeetCode.
 * All cached data lives under ~/.better-leetcode/cache/.
 */
function getCacheDir(): string {
  return path.join(os.homedir(), '.better-leetcode', 'cache');
}

/**
 * Returns the path to the single problems cache file.
 */
function getCacheFile(): string {
  return path.join(getCacheDir(), 'problems_cache.json');
}

type RefreshMode = 'normal' | 'incremental' | 'full';

export class AllProblemsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private problemsCache: Problem[] = [];
  private refreshMode: RefreshMode = 'normal';

  constructor(private authManager: LeetCodeAuthManager) {}

  /**
   * Triggers an incremental refresh: fetches only new problems
   * that were added since the last cache write.
   */
  refresh(): void {
    this.problemsCache = [];
    this.refreshMode = 'incremental';
    this._onDidChangeTreeData.fire();
  }

  /**
   * Triggers a full refresh: deletes the disk cache entirely
   * and re-fetches the complete problem catalog from the API.
   */
  fullRefresh(): void {
    this.problemsCache = [];
    this.refreshMode = 'full';

    const cacheFile = getCacheFile();
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      Logger.getInstance().info('tree', 'Disk cache deleted for full refresh');
    }

    this._onDidChangeTreeData.fire();
  }

  /**
   * Deletes the problems cache file and clears in-memory state.
   * Does not trigger a re-fetch — the tree will show "loading" until
   * the next refresh or sidebar expansion.
   */
  deleteCache(): void {
    this.problemsCache = [];
    const cacheFile = getCacheFile();
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      Logger.getInstance().info('tree', 'Problem cache deleted by user');
    }
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the absolute path to the cache file for external inspection.
   */
  getCacheFilePath(): string {
    return getCacheFile();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    try {
      const problems = await this.loadProblems();

      return problems.map((problem: Problem) => {
        const item = new vscode.TreeItem(
          `${problem.frontendQuestionId}. ${problem.title}`,
          vscode.TreeItemCollapsibleState.None,
        );
        item.description = this.getDifficultyDescription(problem.difficulty);
        item.iconPath = this.getDifficultyIcon(
          problem.difficulty,
          problem.status,
          problem.paidOnly,
        );
        item.command = {
          command: 'better-leetcode.openProblem',
          title: 'Open Problem',
          arguments: [problem.titleSlug],
        };
        return item;
      });
    } catch (e) {
      const errorItem = new vscode.TreeItem(
        'Error fetching problems',
        vscode.TreeItemCollapsibleState.None,
      );
      errorItem.description = String(e);
      return [errorItem];
    }
  }

  /**
   * Returns the currently cached/loaded problems list.
   */
  public getProblemsList(): Problem[] {
    return this.problemsCache;
  }

  /**
   * Ensures problems are loaded (from cache or API) and returns the full list.
   * Unlike getProblemsList(), this will trigger a fetch if the cache is empty.
   */
  public async loadProblemsAsync(): Promise<Problem[]> {
    return this.loadProblems();
  }

  private async loadProblems(): Promise<Problem[]> {
    // Capture and reset the refresh mode so it only applies once
    const mode = this.refreshMode;
    this.refreshMode = 'normal';

    // Memory cache hit — only in normal mode (no explicit refresh)
    if (this.problemsCache.length > 0 && mode === 'normal') {
      Logger.getInstance().debug('tree', 'Problems loaded from memory cache', {
        count: this.problemsCache.length,
      });
      return this.problemsCache;
    }

    const cacheFile = getCacheFile();
    await this.ensureCacheDir();

    // Full refresh: disk cache already deleted in fullRefresh(), just fetch everything
    if (mode === 'full') {
      await this.fetchAndCacheAllProblems(cacheFile);
      return this.problemsCache;
    }

    // Incremental refresh: read existing cache, fetch only the diff
    if (mode === 'incremental') {
      await this.incrementalUpdate(cacheFile);
      return this.problemsCache;
    }

    // Normal mode: try disk cache first
    if (fs.existsSync(cacheFile)) {
      try {
        const fileContent = await fs.promises.readFile(cacheFile, 'utf-8');
        const cacheData = JSON.parse(fileContent) as ProblemCacheData;
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const minExpectedProblems = 500;

        if (
          Date.now() - cacheData.timestamp < oneWeekMs &&
          cacheData.questions.length >= minExpectedProblems
        ) {
          Logger.getInstance().debug('tree', 'Problems loaded from disk cache', {
            count: cacheData.questions.length,
            ageMs: Date.now() - cacheData.timestamp,
          });
          this.problemsCache = cacheData.questions;
          return this.problemsCache;
        }
      } catch (err) {
        Logger.getInstance().error('tree', 'Failed to read problems cache', err);
      }
    }

    // Cache miss or expired — full fetch
    await this.fetchAndCacheAllProblems(cacheFile);
    return this.problemsCache;
  }

  /**
   * Performs an incremental update by comparing the cached problem count
   * against the current API total and fetching only the delta.
   * Falls back to a full fetch if no valid cache exists.
   */
  private async incrementalUpdate(cacheFile: string): Promise<void> {
    let existingQuestions: Problem[] = [];

    if (fs.existsSync(cacheFile)) {
      try {
        const fileContent = await fs.promises.readFile(cacheFile, 'utf-8');
        const cacheData = JSON.parse(fileContent) as ProblemCacheData;
        existingQuestions = cacheData.questions;
      } catch (err) {
        Logger.getInstance().error('tree', 'Failed to read cache for incremental update', err);
      }
    }

    // No valid cache — fall back to full fetch
    if (existingQuestions.length === 0) {
      await this.fetchAndCacheAllProblems(cacheFile);
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Checking for new LeetCode problems...',
        cancellable: false,
      },
      async () => {
        const client = this.authManager.getClient();
        const batchSize = 100;

        // Probe the API to learn the current total count
        const queryStr = `
          query problemsetQuestionList(
            $categorySlug: String, $limit: Int, $skip: Int,
            $filters: QuestionListFilterInput
          ) {
            problemsetQuestionList: questionList(
              categorySlug: $categorySlug
              limit: $limit
              skip: $skip
              filters: $filters
            ) {
              total: totalNum
              questions: data {
                frontendQuestionId: questionFrontendId
                title
                titleSlug
                difficulty
                acRate
                paidOnly: isPaidOnly
                status
                topicTags { name slug }
              }
            }
          }
        `;

        const firstData = await client.query<{
          problemsetQuestionList: { total: number; questions: Problem[] };
        }>(queryStr, { categorySlug: '', skip: 0, limit: 1, filters: {} });

        if (!firstData?.problemsetQuestionList) {
          Logger.getInstance().error('tree', 'Failed to query API total during incremental update');
          this.problemsCache = existingQuestions;
          return;
        }

        const apiTotal = firstData.problemsetQuestionList.total;
        const cachedCount = existingQuestions.length;

        if (apiTotal <= cachedCount) {
          Logger.getInstance().info(
            'tree',
            `No new problems found (API: ${apiTotal}, cached: ${cachedCount})`,
          );
          this.problemsCache = existingQuestions;
          return;
        }

        // Fetch only the new problems beyond what we already have
        const newCount = apiTotal - cachedCount;
        Logger.getInstance().info(
          'tree',
          `Found ${newCount} new problems (API: ${apiTotal}, cached: ${cachedCount})`,
        );

        const newPages: number[] = [];
        for (let skip = cachedCount; skip < apiTotal; skip += batchSize) {
          newPages.push(skip);
        }

        const pageResults = await Promise.all(
          newPages.map(async (skip) => {
            const data = await client.query<{
              problemsetQuestionList: { total: number; questions: Problem[] };
            }>(queryStr, { categorySlug: '', skip, limit: batchSize, filters: {} });
            if (!data?.problemsetQuestionList) {
              return [];
            }
            return data.problemsetQuestionList.questions;
          }),
        );

        const newProblems: Problem[] = [];
        for (const page of pageResults) {
          newProblems.push(...page);
        }

        // Build a Set of existing titleSlugs to de-duplicate
        const existingSlugs = new Set(existingQuestions.map((q) => q.titleSlug));
        const uniqueNewProblems = newProblems.filter((q) => !existingSlugs.has(q.titleSlug));

        const merged = [...existingQuestions, ...uniqueNewProblems];
        this.problemsCache = merged;

        const cacheData: ProblemCacheData = {
          timestamp: Date.now(),
          questions: merged,
        };
        await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8');

        Logger.getInstance().info(
          'tree',
          `Incremental update complete: ${uniqueNewProblems.length} new, ${merged.length} total`,
        );
      },
    );
  }

  /**
   * Fetches the complete problem catalog from the API and writes it to disk.
   */
  private async fetchAndCacheAllProblems(cacheFile: string): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading LeetCode problem catalog...',
        cancellable: false,
      },
      async () => {
        Logger.getInstance().info('tree', 'Fetching complete problem catalog from LeetCode API');
        const questions = await this.authManager.getClient().getAllProblems();
        if (questions.length > 0) {
          this.problemsCache = questions;
          const cacheData: ProblemCacheData = {
            timestamp: Date.now(),
            questions,
          };
          await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8');
          Logger.getInstance().info('tree', `Problem catalog cached: ${questions.length} problems`);
        }
      },
    );
  }

  /**
   * Ensures the cache directory exists, creating it recursively if needed.
   */
  private async ensureCacheDir(): Promise<void> {
    const dir = getCacheDir();
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  private getDifficultyDescription(difficulty: string): string {
    switch (difficulty) {
      case 'Easy':
        return 'Easy';
      case 'Medium':
        return 'Medium';
      case 'Hard':
        return 'Hard';
      default:
        return difficulty;
    }
  }

  private getDifficultyIcon(
    difficulty: string,
    status?: string | null,
    paidOnly?: boolean,
  ): vscode.ThemeIcon {
    if (status === 'ac') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    }

    let colorId: string;
    switch (difficulty) {
      case 'Easy':
        colorId = 'charts.green';
        break;
      case 'Medium':
        colorId = 'charts.yellow';
        break;
      case 'Hard':
        colorId = 'charts.red';
        break;
      default:
        colorId = 'foreground';
        break;
    }

    if (paidOnly) {
      return new vscode.ThemeIcon('lock', new vscode.ThemeColor(colorId));
    }
    return new vscode.ThemeIcon('tag', new vscode.ThemeColor(colorId));
  }
}
