import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LeetCodeAuthManager } from '../leetcode';
import { Problem } from '../leetcode/types';
import { Logger } from '../logger';

interface ProblemCacheData {
  timestamp: number;
  questions: Problem[];
}

export class AllProblemsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private problemsCache: Problem[] = [];

  constructor(
    private authManager: LeetCodeAuthManager,
    private context: vscode.ExtensionContext,
  ) {}

  refresh(force: boolean = false): void {
    if (force) {
      // Clear in-memory cache to trigger refetch
      this.problemsCache = [];
    }
    this._onDidChangeTreeData.fire();
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
        item.iconPath = this.getDifficultyIcon(problem.difficulty, problem.status, problem.paidOnly);
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
    if (this.problemsCache.length > 0) {
      Logger.getInstance().debug('tree', 'Problems loaded from memory cache', {
        count: this.problemsCache.length,
      });
      return this.problemsCache;
    }

    const cacheDir = this.context.globalStorageUri.fsPath;
    const cacheFile = path.join(cacheDir, 'problems_cache.json');

    // Ensure the cache directory exists
    if (!fs.existsSync(cacheDir)) {
      await fs.promises.mkdir(cacheDir, { recursive: true });
    }

    let needsFetch = true;
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
          needsFetch = false;
        }
      } catch (err) {
        Logger.getInstance().error('tree', 'Failed to read problems cache', err);
      }
    }

    if (needsFetch) {
      await this.fetchAndCacheProblems(cacheFile);
    }

    return this.problemsCache;
  }

  private async fetchAndCacheProblems(cacheFile: string): Promise<void> {
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

  private getDifficultyDescription(difficulty: string): string {
    switch (difficulty) {
      case 'Easy': return 'Easy';
      case 'Medium': return 'Medium';
      case 'Hard': return 'Hard';
      default: return difficulty;
    }
  }

  private getDifficultyIcon(difficulty: string, status?: string | null, paidOnly?: boolean): vscode.ThemeIcon {
    if (status === 'ac') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    }

    let colorId: string;
    switch (difficulty) {
      case 'Easy': colorId = 'charts.green'; break;
      case 'Medium': colorId = 'charts.orange'; break;
      case 'Hard': colorId = 'charts.red'; break;
      default: colorId = 'foreground'; break;
    }

    if (paidOnly) {
      return new vscode.ThemeIcon('lock', new vscode.ThemeColor(colorId));
    }
    return new vscode.ThemeIcon('tag', new vscode.ThemeColor(colorId));
  }
}
