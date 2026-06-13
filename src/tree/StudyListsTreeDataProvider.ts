import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';
import { StudyPlanQuestion } from '../leetcode/types';
import { Logger } from '../logger';

/**
 * Represents a study plan item in the tree view.
 */
class StudyPlanItem extends vscode.TreeItem {
  /**
   * Creates an instance of StudyPlanItem.
   *
   * @param name The name of the study plan.
   * @param planSlug The unique slug of the study plan.
   */
  constructor(
    public readonly name: string,
    public readonly planSlug: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'studyPlan';
    this.iconPath = new vscode.ThemeIcon('book');
  }
}

/**
 * Represents a user's favorite list item in the tree view.
 */
class FavoriteListItem extends vscode.TreeItem {
  /**
   * Creates an instance of FavoriteListItem.
   *
   * @param name The name of the favorite list.
   * @param slug The unique slug of the favorite list.
   */
  constructor(
    public readonly name: string,
    public readonly slug: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'favoriteList';
    this.iconPath = new vscode.ThemeIcon('heart');
  }
}

/**
 * Represents a group of questions within a study plan in the tree view.
 */
class StudyPlanGroupItem extends vscode.TreeItem {
  /**
   * Creates an instance of StudyPlanGroupItem.
   *
   * @param name The name of the study plan group.
   * @param questions The list of questions belonging to this group.
   */
  constructor(
    public readonly name: string,
    public readonly questions: StudyPlanQuestion[],
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'studyPlanGroup';
  }
}

/**
 * Represents a single problem within a study plan or favorite list in the tree view.
 */
class StudyPlanProblemItem extends vscode.TreeItem {
  /**
   * Creates an instance of StudyPlanProblemItem.
   *
   * @param question The study plan question details.
   */
  constructor(public readonly question: StudyPlanQuestion) {
    super(
      `${question.questionFrontendId}. ${question.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.description = StudyPlanProblemItem.getDifficultyDescription(question.difficulty);
    this.iconPath = StudyPlanProblemItem.getDifficultyIcon(
      question.difficulty,
      question.status,
      question.paidOnly,
    );
    this.command = {
      command: 'better-leetcode.openProblem',
      title: 'Open Problem',
      arguments: [question.titleSlug],
    };
  }

  /**
   * Gets the display description for a given difficulty level.
   *
   * @param difficulty The difficulty string from LeetCode.
   * @returns The formatted difficulty description.
   */
  private static getDifficultyDescription(difficulty: string): string {
    const diff = difficulty.toUpperCase();
    switch (diff) {
      case 'EASY':
        return 'Easy';
      case 'MEDIUM':
        return 'Medium';
      case 'HARD':
        return 'Hard';
      default:
        return difficulty;
    }
  }

  /**
   * Resolves the appropriate theme icon for a problem based on difficulty, status, and lock state.
   *
   * @param difficulty The difficulty level of the problem.
   * @param status The completion status of the problem.
   * @param paidOnly Whether the problem is restricted to premium users.
   * @returns A VS Code ThemeIcon representing the problem state.
   */
  private static getDifficultyIcon(
    difficulty: string,
    status?: string | null,
    paidOnly?: boolean,
  ): vscode.ThemeIcon {
    if (status === 'ac') {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    }

    const diff = difficulty.toUpperCase();
    let colorId: string;
    switch (diff) {
      case 'EASY':
        colorId = 'charts.green';
        break;
      case 'MEDIUM':
        colorId = 'charts.yellow';
        break;
      case 'HARD':
        colorId = 'charts.red';
        break;
      default:
        colorId = 'foreground';
        break;
    }

    if (paidOnly === true) {
      return new vscode.ThemeIcon('lock', new vscode.ThemeColor(colorId));
    }
    return new vscode.ThemeIcon('tag', new vscode.ThemeColor(colorId));
  }
}

/**
 * Tree data provider for LeetCode study lists and favorite lists in VS Code's sidebar.
 */
export class StudyListsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  /**
   * Creates an instance of StudyListsTreeDataProvider.
   *
   * @param authManager The authentication manager to access the LeetCode client.
   */
  constructor(private authManager: LeetCodeAuthManager) {}

  /**
   * Refreshes the study lists tree view by firing the change event.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Retrieves the tree item representation for a given element.
   *
   * @param element The tree item element.
   * @returns The VS Code TreeItem itself.
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets the children elements of the tree view.
   *
   * @param element The parent tree item element, or undefined if retrieving roots.
   * @returns A promise resolving to an array of child tree items.
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const defaultLists: vscode.TreeItem[] = [
        new StudyPlanItem('Top Interview 150', 'top-interview-150'),
        new StudyPlanItem('LeetCode 75', 'leetcode-75'),
      ];
      try {
        const favorites = await this.authManager.getClient().getFavoriteLists();
        for (const fav of favorites) {
          defaultLists.push(new FavoriteListItem(fav.name, fav.slug));
        }
      } catch (err) {
        Logger.getInstance().error('tree', 'Failed to fetch favorites', err);
      }
      return defaultLists;
    }

    if (element instanceof FavoriteListItem) {
      try {
        Logger.getInstance().debug('tree', `Loading favorite list: ${element.slug}`);
        const questions = await this.authManager.getClient().getFavoriteListProblems(element.slug);
        if (questions.length === 0) {
          return [new vscode.TreeItem('No questions found', vscode.TreeItemCollapsibleState.None)];
        }
        return questions.map((q) => new StudyPlanProblemItem(q));
      } catch (err) {
        Logger.getInstance().error('tree', `Failed to load favorite list: ${element.slug}`, err);
        const errItem = new vscode.TreeItem(
          'Error loading list',
          vscode.TreeItemCollapsibleState.None,
        );
        errItem.description = String(err);
        return [errItem];
      }
    }

    if (element instanceof StudyPlanItem) {
      try {
        Logger.getInstance().debug('tree', `Loading study plan: ${element.planSlug}`);
        const details = await this.authManager.getClient().getStudyPlan(element.planSlug);
        if (details === undefined || details.planSubGroups === undefined) {
          Logger.getInstance().debug('tree', `No groups found for study plan: ${element.planSlug}`);
          return [new vscode.TreeItem('No groups found', vscode.TreeItemCollapsibleState.None)];
        }
        Logger.getInstance().debug('tree', `Study plan loaded: ${element.planSlug}`, {
          groupCount: details.planSubGroups.length,
        });
        return details.planSubGroups.map(
          (group) => new StudyPlanGroupItem(group.name, group.questions),
        );
      } catch (err) {
        Logger.getInstance().error('tree', `Failed to load study plan: ${element.planSlug}`, err);
        const errItem = new vscode.TreeItem(
          'Error loading groups',
          vscode.TreeItemCollapsibleState.None,
        );
        errItem.description = String(err);
        return [errItem];
      }
    }

    if (element instanceof StudyPlanGroupItem) {
      return element.questions.map((question) => new StudyPlanProblemItem(question));
    }

    return [];
  }
}
