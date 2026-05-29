import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';
import { StudyPlanQuestion } from '../leetcode/types';
import { Logger } from '../logger';

class StudyPlanItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly planSlug: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'studyPlan';
  }
}

class StudyPlanGroupItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly questions: StudyPlanQuestion[],
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'studyPlanGroup';
  }
}

class StudyPlanProblemItem extends vscode.TreeItem {
  constructor(public readonly question: StudyPlanQuestion) {
    super(
      `${question.questionFrontendId}. ${question.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.description = question.difficulty;
    this.iconPath = StudyPlanProblemItem.getDifficultyIcon(question.difficulty);
    this.command = {
      command: 'better-leetcode.openProblem',
      title: 'Open Problem',
      arguments: [question.titleSlug],
    };
  }

  private static getDifficultyIcon(difficulty: string): vscode.ThemeIcon {
    const diff = difficulty.toUpperCase();
    switch (diff) {
      case 'EASY':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
      case 'MEDIUM':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
      case 'HARD':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}

export class StudyListsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private authManager: LeetCodeAuthManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      return [
        new StudyPlanItem('Top Interview 150', 'top-interview-150'),
        new StudyPlanItem('LeetCode 75', 'leetcode-75'),
      ];
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
