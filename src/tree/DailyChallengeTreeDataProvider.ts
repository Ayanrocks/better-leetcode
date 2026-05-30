import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';
import { Logger } from '../logger';

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
      Logger.getInstance().debug('tree', 'Fetching daily challenge');
      const problem = await this.authManager.getClient().getDailyChallenge();
      if (problem === undefined) {
        Logger.getInstance().debug('tree', 'No daily challenge available');
        return [
          new vscode.TreeItem('No daily challenge available', vscode.TreeItemCollapsibleState.None),
        ];
      }

      Logger.getInstance().debug('tree', `Daily challenge: ${problem.title}`, {
        slug: problem.titleSlug,
      });
      const item = new vscode.TreeItem(
        `${problem.title} (Daily)`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = this.getDifficultyDescription(problem.difficulty);
      item.tooltip = `Daily Challenge: ${problem.title}`;
      item.iconPath = this.getDifficultyIcon(problem.difficulty, problem.status, problem.paidOnly);
      item.command = {
        command: 'better-leetcode.openProblem',
        title: 'Open Problem',
        arguments: [problem.titleSlug],
      };

      return [item];
    } catch (e) {
      Logger.getInstance().error('tree', 'Failed to fetch daily challenge', e);
      const errorItem = new vscode.TreeItem(
        'Error fetching daily challenge',
        vscode.TreeItemCollapsibleState.None,
      );
      errorItem.description = String(e);
      return [errorItem];
    }
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
      case 'Medium': colorId = 'charts.yellow'; break;
      case 'Hard': colorId = 'charts.red'; break;
      default: colorId = 'foreground'; break;
    }

    if (paidOnly) {
      return new vscode.ThemeIcon('lock', new vscode.ThemeColor(colorId));
    }
    return new vscode.ThemeIcon('tag', new vscode.ThemeColor(colorId));
  }
}
