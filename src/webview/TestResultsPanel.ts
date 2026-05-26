import * as vscode from 'vscode';
import { SubmissionCheckResult } from '../leetcode/types';

/**
 * Represents the processed result data sent to the webview for display.
 */
export interface TestResultDisplayData {
  /** 'test' for interpret results, 'submit' for submission results. */
  type: 'test' | 'submit';
  /** The raw result from LeetCode's check endpoint. */
  result: SubmissionCheckResult;
  /** Parsed test input strings (one per test case). */
  testInputs: string[];
}

/**
 * Provides a webview-based panel in VS Code's bottom panel area
 * (alongside Terminal, Problems, Output) for displaying LeetCode
 * test and submission results with a rich, interactive UI.
 */
export class TestResultsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'better-leetcode.views.testResults';

  private view: vscode.WebviewView | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Called by VS Code when the webview view is first made visible.
   * Sets up the webview options and renders the empty state.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getEmptyHtml();
  }

  /**
   * Displays test or submission results in the panel.
   * Parses the result data and renders the interactive results UI.
   *
   * @param data - The test result display data containing the LeetCode result
   *   and parsed test inputs.
   */
  public showResults(data: TestResultDisplayData): void {
    if (this.view) {
      this.view.webview.html = this.getResultsHtml(data);
      this.view.show(true);
    }
  }

  /**
   * Shows a loading spinner with a message in the panel.
   *
   * @param message - The loading message to display (e.g., 'Testing solution...').
   */
  public showLoading(message: string): void {
    if (this.view) {
      this.view.webview.html = this.getLoadingHtml(message);
      this.view.show(true);
    }
  }

  /**
   * Returns HTML for the empty state before any test is run.
   */
  private getEmptyHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-panel-background, var(--vscode-editor-background));
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .empty-state {
      text-align: center;
      opacity: 0.6;
    }
    .empty-state .icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    .empty-state p {
      font-size: 13px;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="empty-state">
    <div class="icon">▶</div>
    <p>Run your solution to see results here</p>
  </div>
</body>
</html>`;
  }

  /**
   * Returns HTML for the loading spinner state.
   */
  private getLoadingHtml(message: string): string {
    const safeMessage = this.escapeHtml(message);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-panel-background, var(--vscode-editor-background));
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .loading {
      text-align: center;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--vscode-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
      opacity: 0.6;
    }
    .loading p {
      font-size: 13px;
      margin: 0;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Returns the full results HTML with interactive test case selection.
   */
  private getResultsHtml(data: TestResultDisplayData): string {
    const { result } = data;
    const statusColor = this.getStatusColor(result.status_code);
    const statusIcon = result.run_success ? '✅' : '❌';
    const totalCases = result.total_testcases ?? (result.code_answer ?? []).length;
    const totalCorrect = result.total_correct ?? 0;

    const hasError =
      (result.compile_error !== undefined && result.compile_error !== '') ||
      (result.runtime_error !== undefined && result.runtime_error !== '');
    const errorText = result.full_compile_error || result.full_runtime_error ||
      result.compile_error || result.runtime_error || '';

    // Build test case data for the webview JavaScript
    const casesJson = this.buildCasesJson(data);

    const showStats = data.type === 'submit' && result.run_success;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-panel-background, var(--vscode-editor-background));
      font-size: 13px;
      line-height: 1.5;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .container {
      display: grid;
      grid-template-columns: 180px 1fr;
      height: 100vh;
      animation: fadeIn 0.25s ease-out;
    }

    /* ── Left sidebar: Test case list ─────────────────── */
    .sidebar {
      border-right: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      padding: 12px 0;
      overflow-y: auto;
    }

    .sidebar-header {
      padding: 0 12px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
    }

    .case-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      transition: background 0.15s ease;
      border-left: 2px solid transparent;
    }

    .case-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .case-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground, inherit);
      border-left-color: ${statusColor};
    }

    .case-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .case-dot.pass { background: #2cbb5d; }
    .case-dot.fail { background: #ef4743; }

    .case-label {
      font-size: 13px;
    }

    /* ── Main content area ────────────────────────────── */
    .main {
      padding: 16px 20px;
      overflow-y: auto;
    }

    /* Status banner */
    .status-banner {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 16px;
    }

    .status-text {
      font-size: 20px;
      font-weight: 700;
      color: ${statusColor};
    }

    .status-count {
      font-size: 13px;
      opacity: 0.7;
    }

    /* Stats row */
    .stats-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1));
      border-radius: 8px;
      padding: 12px 16px;
    }

    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .stat-beats {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 6px;
    }

    .progress-bar {
      height: 4px;
      border-radius: 2px;
      background: rgba(128,128,128,0.2);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .progress-fill.runtime { background: #2cbb5d; }
    .progress-fill.memory { background: #ffa116; }

    /* Test case detail sections */
    .section {
      margin-bottom: 14px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
      margin-bottom: 6px;
    }

    .code-block {
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1));
      border-radius: 6px;
      padding: 10px 14px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.6;
    }

    .code-block.mismatch {
      border-left: 3px solid #ef4743;
    }

    .code-block.error {
      border-left: 3px solid #ef4743;
      color: #ef4743;
      background: rgba(239, 71, 67, 0.08);
    }

    .code-block.stdout {
      border-left: 3px solid #ffa116;
      opacity: 0.9;
    }

    /* ── Single column layout for error-only ─────────── */
    .container.no-sidebar {
      grid-template-columns: 1fr;
    }

    .container.no-sidebar .sidebar {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container${hasError && totalCases === 0 ? ' no-sidebar' : ''}" id="root">
    <div class="sidebar">
      <div class="sidebar-header">Test Cases</div>
      ${this.buildCaseListHtml(data)}
    </div>

    <div class="main" id="main-content">
      <!-- Status banner -->
      <div class="status-banner">
        <span class="status-text">${statusIcon} ${this.escapeHtml(result.status_msg)}</span>
        ${totalCases > 0 ? `<span class="status-count">${totalCorrect} / ${totalCases} test cases passed</span>` : ''}
      </div>

      ${showStats ? this.buildStatsHtml(result) : ''}
      ${hasError ? this.buildErrorHtml(errorText) : ''}

      <div id="case-detail">
        ${this.buildCaseDetailHtml(data, 0)}
      </div>
    </div>
  </div>

  <script>
    (function() {
      const cases = ${casesJson};

      document.querySelectorAll('.case-item').forEach(function(item, index) {
        item.addEventListener('click', function() {
          document.querySelectorAll('.case-item').forEach(function(el) {
            el.classList.remove('active');
          });
          item.classList.add('active');
          var detail = document.getElementById('case-detail');
          if (detail && cases[index]) {
            detail.innerHTML = buildDetail(cases[index], index);
          }
        });
      });

      function escHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function buildDetail(c, idx) {
        var html = '';
        if (c.input) {
          html += '<div class="section">';
          html += '<div class="section-title">Input</div>';
          html += '<div class="code-block">' + escHtml(c.input) + '</div>';
          html += '</div>';
        }
        if (c.output !== undefined && c.output !== null) {
          html += '<div class="section">';
          html += '<div class="section-title">Output</div>';
          var mismatch = c.expected !== undefined && c.output !== c.expected;
          html += '<div class="code-block' + (mismatch ? ' mismatch' : '') + '">' + escHtml(c.output) + '</div>';
          html += '</div>';
        }
        if (c.expected !== undefined && c.expected !== null) {
          html += '<div class="section">';
          html += '<div class="section-title">Expected</div>';
          html += '<div class="code-block">' + escHtml(c.expected) + '</div>';
          html += '</div>';
        }
        if (c.stdout) {
          html += '<div class="section">';
          html += '<div class="section-title">Stdout</div>';
          html += '<div class="code-block stdout">' + escHtml(c.stdout) + '</div>';
          html += '</div>';
        }
        return html;
      }
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Builds the HTML for the sidebar test case list items.
   */
  private buildCaseListHtml(data: TestResultDisplayData): string {
    const { result } = data;
    const codeAnswer = result.code_answer ?? [];
    const expectedAnswer = result.expected_answer ?? [];
    const count = Math.max(
      codeAnswer.length,
      expectedAnswer.length,
      data.testInputs.length,
      1,
    );

    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const actual = codeAnswer[i];
      const expected = expectedAnswer[i];
      const passed = actual !== undefined && expected !== undefined && actual === expected;
      const dotClass = passed ? 'pass' : 'fail';
      const activeClass = i === 0 ? ' active' : '';

      items.push(
        `<div class="case-item${activeClass}" data-index="${i}">` +
        `<span class="case-dot ${dotClass}"></span>` +
        `<span class="case-label">Case ${i + 1}</span>` +
        `</div>`,
      );
    }
    return items.join('\n');
  }

  /**
   * Builds the HTML for runtime and memory stats with progress bars.
   */
  private buildStatsHtml(result: SubmissionCheckResult): string {
    const runtimePct = result.runtime_percentile ?? 0;
    const memoryPct = result.memory_percentile ?? 0;

    return `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Runtime</div>
          <div class="stat-value">${this.escapeHtml(result.status_runtime || 'N/A')}</div>
          <div class="stat-beats">Beats ${runtimePct.toFixed(1)}%</div>
          <div class="progress-bar">
            <div class="progress-fill runtime" style="width: ${runtimePct}%"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Memory</div>
          <div class="stat-value">${this.escapeHtml(result.status_memory || 'N/A')}</div>
          <div class="stat-beats">Beats ${memoryPct.toFixed(1)}%</div>
          <div class="progress-bar">
            <div class="progress-fill memory" style="width: ${memoryPct}%"></div>
          </div>
        </div>
      </div>`;
  }

  /**
   * Builds the HTML for error display (compile errors, runtime errors).
   */
  private buildErrorHtml(errorText: string): string {
    return `
      <div class="section">
        <div class="section-title">Error</div>
        <div class="code-block error">${this.escapeHtml(errorText)}</div>
      </div>`;
  }

  /**
   * Builds the HTML for a specific test case's Input/Output/Expected detail.
   */
  private buildCaseDetailHtml(data: TestResultDisplayData, index: number): string {
    const { result, testInputs } = data;
    const codeAnswer = result.code_answer ?? [];
    const expectedAnswer = result.expected_answer ?? [];
    const stdOutputList = result.std_output_list ?? [];
    const input = testInputs[index] ?? '';
    const output = codeAnswer[index] ?? '';
    const expected = expectedAnswer[index] ?? '';
    const stdout = stdOutputList[index] ?? '';
    const hasMismatch = output !== expected;

    let html = '';

    if (input !== '') {
      html += `
        <div class="section">
          <div class="section-title">Input</div>
          <div class="code-block">${this.escapeHtml(input)}</div>
        </div>`;
    }

    if (output !== '') {
      html += `
        <div class="section">
          <div class="section-title">Output</div>
          <div class="code-block${hasMismatch ? ' mismatch' : ''}">${this.escapeHtml(output)}</div>
        </div>`;
    }

    if (expected !== '') {
      html += `
        <div class="section">
          <div class="section-title">Expected</div>
          <div class="code-block">${this.escapeHtml(expected)}</div>
        </div>`;
    }

    if (stdout !== '') {
      html += `
        <div class="section">
          <div class="section-title">Stdout</div>
          <div class="code-block stdout">${this.escapeHtml(stdout)}</div>
        </div>`;
    }

    return html;
  }

  /**
   * Builds a JSON string of test case data for the webview JavaScript.
   */
  private buildCasesJson(data: TestResultDisplayData): string {
    const { result, testInputs } = data;
    const codeAnswer = result.code_answer ?? [];
    const expectedAnswer = result.expected_answer ?? [];
    const stdOutputList = result.std_output_list ?? [];
    const count = Math.max(
      codeAnswer.length,
      expectedAnswer.length,
      testInputs.length,
      1,
    );

    const cases: Array<{
      input: string;
      output: string;
      expected: string;
      stdout: string;
    }> = [];

    for (let i = 0; i < count; i++) {
      cases.push({
        input: testInputs[i] ?? '',
        output: codeAnswer[i] ?? '',
        expected: expectedAnswer[i] ?? '',
        stdout: stdOutputList[i] ?? '',
      });
    }

    return JSON.stringify(cases);
  }

  /**
   * Returns the color associated with a LeetCode status code.
   *
   * @param statusCode - LeetCode status code (10=Accepted, 11=Wrong Answer, etc.).
   */
  private getStatusColor(statusCode: number): string {
    switch (statusCode) {
      case 10: return '#2cbb5d'; // Accepted
      case 20: return '#ffa116'; // Compile Error
      default: return '#ef4743'; // Wrong Answer, Runtime Error, TLE, etc.
    }
  }

  /**
   * Escapes HTML special characters to prevent XSS in webview content.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
