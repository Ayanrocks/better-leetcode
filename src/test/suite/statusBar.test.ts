import * as assert from 'assert';
import * as vscode from 'vscode';
import { LeetCodeStatusBarController } from '../../statusBar';
import { LeetCodeAuthManager } from '../../leetcode/auth';

// A lightweight mock of LeetCodeAuthManager for testing the status bar
class MockAuthManager {
  private _onDidChangeSession = new vscode.EventEmitter<any>();
  public readonly onDidChangeSession = this._onDidChangeSession.event;
  
  private status: any = undefined;

  public getStatus() {
    return this.status;
  }

  public setStatus(newStatus: any) {
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
    // @ts-ignore - Accessing private property for testing
    const item = statusBar.statusBarItem;
    assert.strictEqual(item.text, '$(sign-in) LeetCode: Sign In');
    assert.strictEqual(item.command, 'better-leetcode.signin');
    // Error background color indicates not signed in
    assert.strictEqual(item.backgroundColor?.id, 'statusBarItem.warningBackground');
  });

  test('update handles standard user signed in state', () => {
    authManager.setStatus({
      isSignedIn: true,
      isPremium: false,
      username: 'testuser',
    });
    // @ts-ignore
    const item = statusBar.statusBarItem;
    assert.strictEqual(item.text, '$(account) LeetCode: testuser');
    assert.strictEqual(item.command, 'better-leetcode.showUser');
    assert.strictEqual(item.backgroundColor, undefined);
  });

  test('update handles premium user signed in state', () => {
    authManager.setStatus({
      isSignedIn: true,
      isPremium: true,
      username: 'premiumuser',
    });
    // @ts-ignore
    const item = statusBar.statusBarItem;
    assert.strictEqual(item.text, '$(account) LeetCode: premiumuser');
    assert.strictEqual(item.command, 'better-leetcode.showUser');
    assert.strictEqual(item.backgroundColor, undefined);
  });
});
