import * as assert from 'assert';
import * as vscode from 'vscode';
import { LeetCodeStatusBarController } from '../../statusBar';
import { LeetCodeAuthManager } from '../../leetcode/auth';
import { UserStatus } from '../../leetcode/types';

// A lightweight mock of LeetCodeAuthManager for testing the status bar
class MockAuthManager {
  private _onDidChangeSession = new vscode.EventEmitter<UserStatus | undefined>();
  public readonly onDidChangeSession = this._onDidChangeSession.event;

  private status: UserStatus | undefined = undefined;

  public getStatus(): UserStatus | undefined {
    return this.status;
  }

  public setStatus(newStatus: UserStatus | undefined): void {
    this.status = newStatus;
    this._onDidChangeSession.fire(newStatus);
  }
}

suite('LeetCodeStatusBarController Test Suite', () => {
  let authManager: MockAuthManager;
  let statusBar: LeetCodeStatusBarController;

  setup(() => {
    authManager = new MockAuthManager();
    statusBar = new LeetCodeStatusBarController(authManager as unknown as LeetCodeAuthManager);
  });

  teardown(() => {
    statusBar.dispose();
  });

  test('update handles signed out state', () => {
    authManager.setStatus(undefined);
    const item = (statusBar as unknown as { statusBarItem: vscode.StatusBarItem }).statusBarItem;
    assert.strictEqual(item.text, '$(sign-in) Better LeetCode: Sign In');
    assert.strictEqual(item.command, 'better-leetcode.signin');
    // Error background color indicates not signed in
    assert.strictEqual(item.backgroundColor?.id, 'statusBarItem.errorBackground');
  });

  test('update handles standard user signed in state', () => {
    authManager.setStatus({
      isSignedIn: true,
      isPremium: false,
      username: 'testuser',
      realName: 'Test User',
      avatar: 'https://avatar.com/testuser',
      userSlug: 'testuser',
      isAdmin: false,
    });
    const item = (statusBar as unknown as { statusBarItem: vscode.StatusBarItem }).statusBarItem;
    assert.strictEqual(item.text, '$(account) Better LeetCode: testuser');
    assert.strictEqual(item.command, 'better-leetcode.showUser');
    assert.strictEqual(item.backgroundColor, undefined);
  });

  test('update handles premium user signed in state', () => {
    authManager.setStatus({
      isSignedIn: true,
      isPremium: true,
      username: 'premiumuser',
      realName: 'Premium User',
      avatar: 'https://avatar.com/premiumuser',
      userSlug: 'premiumuser',
      isAdmin: false,
    });
    const item = (statusBar as unknown as { statusBarItem: vscode.StatusBarItem }).statusBarItem;
    assert.strictEqual(item.text, '$(account) Better LeetCode: premiumuser');
    assert.strictEqual(item.command, 'better-leetcode.showUser');
    assert.strictEqual(item.backgroundColor, undefined);
  });
});
