import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';

export class DailyChallengeTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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
    if (element) {
      return [];
    }

    try {
      const problem = await this.authManager.getClient().getDailyChallenge();
      if (problem === undefined) {
        return [
          new vscode.TreeItem('No daily challenge available', vscode.TreeItemCollapsibleState.None),
        ];
      }

      const item = new vscode.TreeItem(
        `${problem.title} (Daily)`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = problem.difficulty;
      item.tooltip = `Daily Challenge: ${problem.title}`;
      item.iconPath = this.getDifficultyIcon(problem.difficulty);
      item.command = {
        command: 'better-leetcode.openProblem',
        title: 'Open Problem',
        arguments: [problem.titleSlug],
      };

      return [item];
    } catch (e) {
      const errorItem = new vscode.TreeItem(
        'Error fetching daily challenge',
        vscode.TreeItemCollapsibleState.None,
      );
      errorItem.description = String(e);
      return [errorItem];
    }
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
