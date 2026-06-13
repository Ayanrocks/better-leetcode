import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestResultsPanel, TestResultDisplayData } from '../../webview/TestResultsPanel';

interface CaseData {
  input: string;
  output: string;
  expected: string;
  stdout: string;
  passed: boolean;
  hasOutput: boolean;
  hasExpected: boolean;
}

interface TestResultsPanelPrivateAccess {
  buildCases(data: TestResultDisplayData): CaseData[];
  getTotalCases(data: TestResultDisplayData, cases: CaseData[]): number;
  getTotalCorrect(data: TestResultDisplayData, cases: CaseData[]): number;
  getStatusColor(statusCode: number): string;
  escapeHtml(str: string): string;
}

suite('TestResultsPanel Test Suite', () => {
  let panel: TestResultsPanelPrivateAccess;

  setup(() => {
    // Create a panel instance with a dummy URI and cast to private access interface
    panel = new TestResultsPanel(
      vscode.Uri.file('/tmp/dummy'),
    ) as unknown as TestResultsPanelPrivateAccess;
  });

  suite('buildCases', () => {
    test('test flow: builds from parallel arrays', () => {
      const data: TestResultDisplayData = {
        type: 'test',
        testInputs: ['1', '2'],
        result: {
          state: 'SUCCESS',
          status_code: 10,
          status_msg: 'Accepted',
          run_success: true,
          total_correct: 1,
          total_testcases: 2,
          code_answer: ['out1', 'out2'],
          expected_answer: ['exp1', 'exp2'],
          std_output_list: ['std1', ''],
          status_runtime: '',
          status_memory: '',
          memory_percentile: null,
          runtime_percentile: null,
          code_output: [],
          compile_error: '',
          full_compile_error: '',
          runtime_error: '',
          full_runtime_error: '',
          input_formatted: '',
          expected_output: '',
          last_testcase: '',
        },
      };

      const cases = panel.buildCases(data);
      assert.strictEqual(cases.length, 2);
      assert.strictEqual(cases[0]!.input, '1');
      assert.strictEqual(cases[0]!.output, 'out1');
      assert.strictEqual(cases[0]!.expected, 'exp1');
      assert.strictEqual(cases[0]!.stdout, 'std1');
      assert.strictEqual(cases[0]!.passed, false); // out1 !== exp1

      assert.strictEqual(cases[1]!.input, '2');
      assert.strictEqual(cases[1]!.stdout, '');
    });

    test('submit flow: failed submission uses scalar fields', () => {
      const data: TestResultDisplayData = {
        type: 'submit',
        testInputs: ['1'],
        result: {
          state: 'SUCCESS',
          status_code: 11,
          status_msg: 'Wrong Answer',
          run_success: true,
          total_correct: 5,
          total_testcases: 10,
          code_answer: [],
          expected_answer: [],
          std_output_list: ['fail_std'],
          status_runtime: '',
          status_memory: '',
          memory_percentile: null,
          runtime_percentile: null,
          code_output: 'fail_out',
          compile_error: '',
          full_compile_error: '',
          runtime_error: '',
          full_runtime_error: '',
          input_formatted: '',
          expected_output: 'fail_exp',
          last_testcase: 'fail_in',
        },
      };

      const cases = panel.buildCases(data);
      assert.strictEqual(cases.length, 1);
      assert.strictEqual(cases[0]!.input, 'fail_in');
      assert.strictEqual(cases[0]!.output, 'fail_out');
      assert.strictEqual(cases[0]!.expected, 'fail_exp');
      assert.strictEqual(cases[0]!.stdout, 'fail_std');
      assert.strictEqual(cases[0]!.passed, false);
    });

    test('submit flow: successful submission returns empty array', () => {
      const data: TestResultDisplayData = {
        type: 'submit',
        testInputs: [],
        result: {
          state: 'SUCCESS',
          status_code: 10,
          status_msg: 'Accepted',
          run_success: true,
          total_correct: 10,
          total_testcases: 10,
          code_answer: [],
          expected_answer: [],
          std_output_list: [],
          status_runtime: '',
          status_memory: '',
          memory_percentile: null,
          runtime_percentile: null,
          code_output: [],
          compile_error: '',
          full_compile_error: '',
          runtime_error: '',
          full_runtime_error: '',
          input_formatted: '',
          expected_output: '',
          last_testcase: '',
        },
      };

      const cases = panel.buildCases(data);
      assert.strictEqual(cases.length, 0);
    });
  });

  suite('getTotalCases & getTotalCorrect', () => {
    test('test flow: counts from cases array', () => {
      const data = { type: 'test', result: {} } as unknown as TestResultDisplayData;
      const cases = [{ passed: true }, { passed: false }] as unknown as CaseData[];
      assert.strictEqual(panel.getTotalCases(data, cases), 2);
      assert.strictEqual(panel.getTotalCorrect(data, cases), 1);
    });

    test('submit flow: prefers result fields', () => {
      const data = {
        type: 'submit',
        result: { total_testcases: 100, total_correct: 99 },
      } as unknown as TestResultDisplayData;
      const cases = [{ passed: false }] as unknown as CaseData[]; // Single failing case
      assert.strictEqual(panel.getTotalCases(data, cases), 100);
      assert.strictEqual(panel.getTotalCorrect(data, cases), 99);
    });
  });

  suite('getStatusColor', () => {
    test('maps codes to colors', () => {
      assert.strictEqual(panel.getStatusColor(10), '#2cbb5d'); // Accepted
      assert.strictEqual(panel.getStatusColor(20), '#ffa116'); // Compile Error
      assert.strictEqual(panel.getStatusColor(11), '#ef4743'); // Wrong Answer
      assert.strictEqual(panel.getStatusColor(15), '#ef4743'); // Runtime Error
    });
  });

  suite('escapeHtml', () => {
    test('escapes special characters', () => {
      const escaped = panel.escapeHtml('<div>"test" & \'value\'</div>');
      assert.strictEqual(
        escaped,
        '&lt;div&gt;&quot;test&quot; &amp; &#039;value&#039;&lt;/div&gt;',
      );
    });
  });
});
