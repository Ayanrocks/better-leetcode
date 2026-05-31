import * as assert from 'assert';
import * as vscode from 'vscode';

import {
  parseTestInputs,
  normalizeResult,
  deriveFromMetaData,
  deriveFromHtmlContent,
} from '../../extension';

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
    assert.ok(
      commands.includes('better-leetcode.showUser'),
      'showUser command should be registered',
    );
  });

  suite('Helper functions', () => {
    test('parseTestInputs splits by linesPerCase', () => {
      const inputStr = '1\n2\n3\n4\n5\n6\n';
      const cases2 = parseTestInputs(inputStr, 2);
      assert.strictEqual(cases2.length, 3);
      assert.strictEqual(cases2[0], '1\n2');
      assert.strictEqual(cases2[1], '3\n4');
      assert.strictEqual(cases2[2], '5\n6');

      const cases3 = parseTestInputs(inputStr, 3);
      assert.strictEqual(cases3.length, 2);
      assert.strictEqual(cases3[0], '1\n2\n3');
      assert.strictEqual(cases3[1], '4\n5\n6');

      const casesInvalid = parseTestInputs(inputStr, 0);
      assert.strictEqual(casesInvalid.length, 0);

      const casesEmpty = parseTestInputs('   \n\n  ', 2);
      assert.strictEqual(casesEmpty.length, 0);
    });

    test('normalizeResult provides safe defaults', () => {
      const raw: any = { state: 'PENDING' };
      const normalized = normalizeResult(raw);
      
      assert.strictEqual(normalized.state, 'PENDING');
      assert.strictEqual(normalized.status_code, 0);
      assert.strictEqual(normalized.status_msg, 'Unknown');
      assert.strictEqual(normalized.run_success, false);
      assert.deepStrictEqual(normalized.code_answer, []);
      assert.deepStrictEqual(normalized.expected_answer, []);
      assert.deepStrictEqual(normalized.code_output, []);
      assert.deepStrictEqual(normalized.std_output_list, []);
    });

    test('normalizeResult uses expected_code_answer when expected_answer is empty', () => {
      const raw: any = {
        state: 'SUCCESS',
        expected_answer: [],
        expected_code_answer: ['a', 'b'],
      };
      const normalized = normalizeResult(raw);
      assert.deepStrictEqual(normalized.expected_answer, ['a', 'b']);
    });

    test('normalizeResult uses expected_answer when it is not empty', () => {
      const raw: any = {
        state: 'SUCCESS',
        expected_answer: ['1'],
        expected_code_answer: ['a', 'b'],
      };
      const normalized = normalizeResult(raw);
      assert.deepStrictEqual(normalized.expected_answer, ['1']);
    });

    test('deriveFromMetaData parses correctly', () => {
      assert.strictEqual(deriveFromMetaData(''), null);
      assert.strictEqual(deriveFromMetaData(undefined), null);
      assert.strictEqual(deriveFromMetaData('invalid json'), null);
      
      const meta = JSON.stringify({ params: [{ name: 'a', type: 'int' }] });
      assert.strictEqual(deriveFromMetaData(meta), 1);

      const meta3 = JSON.stringify({ params: [1, 2, 3] });
      assert.strictEqual(deriveFromMetaData(meta3), 3);
      
      const metaEmpty = JSON.stringify({ params: [] });
      assert.strictEqual(deriveFromMetaData(metaEmpty), null);
    });

    test('deriveFromHtmlContent parses correctly', () => {
      assert.strictEqual(deriveFromHtmlContent('', ''), null);
      assert.strictEqual(deriveFromHtmlContent(undefined, undefined), null);

      const examples = '1\n2\n3\n4\n'; // 4 lines
      const html1 = '<p><strong>Input:</strong></p>';
      assert.strictEqual(deriveFromHtmlContent(html1, examples), 4); // 4 lines / 1 example = 4

      const html2 = '<p><strong>Input:</strong></p><p><strong>Input:</strong></p>';
      assert.strictEqual(deriveFromHtmlContent(html2, examples), 2); // 4 lines / 2 examples = 2

      const htmlZeroExamples = '<div>No input tags here</div>';
      assert.strictEqual(deriveFromHtmlContent(htmlZeroExamples, examples), null);
    });
  });
});
