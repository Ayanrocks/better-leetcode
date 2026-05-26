import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Sample test to verify Mocha setup', () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });

  test('Verify extension commands are registered', async () => {
    const extension = vscode.extensions.getExtension('better-leetcode-team.better-leetcode');
    assert.ok(extension, 'Extension should be found.');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('better-leetcode.signin'), 'signin command should be registered');
    assert.ok(commands.includes('better-leetcode.signout'), 'signout command should be registered');
    assert.ok(commands.includes('better-leetcode.showUser'), 'showUser command should be registered');
  });
});
