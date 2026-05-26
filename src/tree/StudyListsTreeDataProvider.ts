import * as vscode from 'vscode';
import { LeetCodeAuthManager } from '../leetcode';

export class StudyListsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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
      // If it's a list, return its problems
      if (element.label === 'Top Interview 150') {
          return [new vscode.TreeItem('88. Merge Sorted Array', vscode.TreeItemCollapsibleState.None)];
      }
      return [];
    }
    
    // TODO: Fetch real study lists from API
    const list1 = new vscode.TreeItem('Top Interview 150', vscode.TreeItemCollapsibleState.Collapsed);
    const list2 = new vscode.TreeItem('LeetCode 75', vscode.TreeItemCollapsibleState.Collapsed);
    
    return [list1, list2];
  }
}
