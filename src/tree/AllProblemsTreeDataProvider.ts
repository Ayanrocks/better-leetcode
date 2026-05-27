import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LeetCodeAuthManager } from '../leetcode';
import { Problem } from '../leetcode/types';

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
        item.description = problem.difficulty;
        item.iconPath = this.getDifficultyIcon(problem.difficulty);
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
          this.problemsCache = cacheData.questions;
          needsFetch = false;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to read problems cache:', err);
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
        const questions = await this.authManager.getClient().getAllProblems();
        if (questions.length > 0) {
          this.problemsCache = questions;
          const cacheData: ProblemCacheData = {
            timestamp: Date.now(),
            questions,
          };
          await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8');
        }
      },
    );
  }

  private getDifficultyIcon(difficulty: string): vscode.ThemeIcon {
    switch (difficulty) {
      case 'Easy':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
      case 'Medium':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
      case 'Hard':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}
