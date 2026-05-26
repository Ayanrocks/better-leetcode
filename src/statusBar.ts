import * as vscode from 'vscode';
import { LeetCodeAuthManager } from './leetcode';

/**
 * Controller for managing the VS Code status bar item for LeetCode.
 */
export class LeetCodeStatusBarController {
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly authManager: LeetCodeAuthManager;

  constructor(authManager: LeetCodeAuthManager) {
    this.authManager = authManager;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'better-leetcode.showUser';
    this.update();

    authManager.onDidChangeSession(() => {
      this.update();
    });
  }

  /**
   * Displays the status bar item.
   */
  public show(): void {
    this.statusBarItem.show();
  }

  /**
   * Disposes of the status bar item and cleans up resources.
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }

  /**
   * Updates the status bar item's visual state based on current authentication status.
   */
  private update(): void {
    const status = this.authManager.getStatus();
    if (status && status.isSignedIn) {
      const premiumLabel = status.isPremium ? 'Premium' : 'Standard';
      this.statusBarItem.text = `$(account) LeetCode: ${status.username}`;
      this.statusBarItem.tooltip =
        `Signed in as ${status.realName || status.username} (${premiumLabel}).\n` +
        `Click to view account actions.`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = undefined;
    } else {
      this.statusBarItem.text = '$(sign-in) LeetCode: Sign In';
      this.statusBarItem.tooltip = 'Click to sign in to LeetCode';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.color = undefined;
    }
  }
}
