import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';
import { LeetCodeContest, ContestQuestion } from '../leetcode';
import { AllProblemsTreeDataProvider } from './AllProblemsTreeDataProvider';
import { Logger } from '../logger';

/**
 * Represents a contest item in the VS Code Tree View.
 */
class ContestItem extends vscode.TreeItem {
  /**
   * Creates an instance of ContestItem.
   *
   * @param contest The LeetCode contest object.
   */
  constructor(public readonly contest: LeetCodeContest) {
    super(contest.title, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'contest';
    this.iconPath = new vscode.ThemeIcon('trophy', new vscode.ThemeColor('charts.orange'));
    const dateStr = new Date(contest.startTime * 1000).toLocaleDateString();
    this.description = dateStr;
    this.tooltip = `Contest: ${contest.title}\nDate: ${dateStr}\nDuration: ${Math.round(contest.duration / 60)} mins`;
  }
}

/**
 * Represents a problem/question within a contest in the VS Code Tree View.
 */
class ContestProblemItem extends vscode.TreeItem {
  /**
   * Creates an instance of ContestProblemItem.
   *
   * @param question The contest question details.
   * @param index The 0-based index of the question in the contest.
   * @param status The completion status of the question (e.g., 'ac').
   */
  constructor(
    public readonly question: ContestQuestion,
    public readonly index: number,
    status?: string | null,
  ) {
    super(`Q${index + 1}. ${question.title}`, vscode.TreeItemCollapsibleState.None);
    this.description = `${question.credit} pts`;
    const difficultyStr = ContestProblemItem.getDifficultyLabel(question.difficulty);
    this.iconPath = ContestProblemItem.getDifficultyIcon(difficultyStr, status);
    this.tooltip = `Question ${index + 1}: ${question.title}\nDifficulty: ${difficultyStr}\nPoints: ${question.credit}`;
    this.command = {
      command: 'better-leetcode.openProblem',
      title: 'Open Problem',
      arguments: [question.title_slug],
    };
  }

  /**
   * Gets the difficulty label as a string for a given difficulty representation.
   *
   * @param diff The difficulty numeric value or string representation.
   * @returns The difficulty level ('Easy', 'Medium', or 'Hard').
   */
  private static getDifficultyLabel(diff: number | string): 'Easy' | 'Medium' | 'Hard' {
    if (typeof diff === 'number') {
      if (diff === 1) return 'Easy';
      if (diff === 2) return 'Medium';
      if (diff === 3) return 'Hard';
    } else if (typeof diff === 'string') {
      const d = diff.toLowerCase();
      if (d === 'easy' || d === '1') return 'Easy';
      if (d === 'medium' || d === '2') return 'Medium';
      if (d === 'hard' || d === '3') return 'Hard';
    }
    return 'Medium';
  }

  /**
   * Gets the appropriate theme icon for a problem based on difficulty and status.
   *
   * @param difficulty The difficulty label.
   * @param status The status of the problem (e.g., 'ac').
   * @returns The VS Code theme icon representing the difficulty and completion status.
   */
  private static getDifficultyIcon(
    difficulty: 'Easy' | 'Medium' | 'Hard',
    status?: string | null,
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

    return new vscode.ThemeIcon('tag', new vscode.ThemeColor(colorId));
  }
}

/**
 * Tree data provider for LeetCode contests and their questions.
 */
export class ContestsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  /**
   * Creates an instance of ContestsTreeDataProvider.
   *
   * @param authManager The LeetCode authentication manager.
   * @param allProblemsProvider The data provider for all problems.
   */
  constructor(
    private authManager: LeetCodeAuthManager,
    private allProblemsProvider: AllProblemsTreeDataProvider,
  ) {}

  /**
   * Refreshes the contests tree view.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the tree item for the specified element.
   *
   * @param element The tree item element.
   * @returns The tree item representation.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieves the children elements of the tree view.
   *
   * @param element The optional parent tree item element.
   * @returns A promise resolving to an array of children tree items.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      try {
        Logger.getInstance().debug('tree', 'Fetching last 5 contests');
        const contests = await this.authManager.getClient().getContests(5);
        if (contests.length === 0) {
          return [new vscode.TreeItem('No contests found', vscode.TreeItemCollapsibleState.None)];
        }
        return contests.map((c) => new ContestItem(c));
      } catch (err) {
        Logger.getInstance().error('tree', 'Failed to fetch contests', err);
        const errItem = new vscode.TreeItem(
          'Error loading contests',
          vscode.TreeItemCollapsibleState.None,
        );
        errItem.description = String(err);
        return [errItem];
      }
    }

    if (element instanceof ContestItem) {
      try {
        const contestSlug = element.contest.titleSlug;
        Logger.getInstance().debug('tree', `Fetching questions for contest: ${contestSlug}`);
        const contestInfo = await this.authManager.getClient().getContestInfo(contestSlug);
        if (
          contestInfo.questions === undefined ||
          contestInfo.questions === null ||
          contestInfo.questions.length === 0
        ) {
          return [new vscode.TreeItem('No questions found', vscode.TreeItemCollapsibleState.None)];
        }

        const problemsList = this.allProblemsProvider.getProblemsList();

        return contestInfo.questions.map((q, idx) => {
          const matchedProblem = problemsList.find((p) => p.titleSlug === q.title_slug);
          const status = matchedProblem?.status;
          return new ContestProblemItem(q, idx, status);
        });
      } catch (err) {
        Logger.getInstance().error(
          'tree',
          `Failed to load contest questions for ${element.contest.titleSlug}`,
          err,
        );
        const errItem = new vscode.TreeItem(
          'Error loading questions',
          vscode.TreeItemCollapsibleState.None,
        );
        errItem.description = String(err);
        return [errItem];
      }
    }

    return [];
  }
}
