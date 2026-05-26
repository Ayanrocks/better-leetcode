import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';

export class AllProblemsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

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
      const problems = await this.authManager.getClient().getProblems(0, 50); // First 50 for now
      
      return problems.map((problem: any) => {
        const item = new vscode.TreeItem(`${problem.frontendQuestionId}. ${problem.title}`, vscode.TreeItemCollapsibleState.None);
        item.description = problem.difficulty;
        item.iconPath = this.getDifficultyIcon(problem.difficulty);
        item.command = { command: 'better-leetcode.openProblem', title: 'Open Problem', arguments: [problem.titleSlug] };
        return item;
      });
    } catch (e) {
      const errorItem = new vscode.TreeItem('Error fetching problems', vscode.TreeItemCollapsibleState.None);
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
