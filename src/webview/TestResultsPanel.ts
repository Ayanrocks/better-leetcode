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
 * Represents the resolved per-case data used for rendering.
 * Separates the concept of "field is present" (hasOutput, hasExpected)
 * from "field has a non-empty string value" to correctly handle cases
 * where LeetCode returns an empty string as the actual output.
 */
interface CaseData {
  input: string;
  output: string;
  expected: string;
  stdout: string;
  passed: boolean;
  /** Whether the output field was present in the LeetCode response. */
  hasOutput: boolean;
  /** Whether the expected field was present in the LeetCode response. */
  hasExpected: boolean;
}

/**
 * Provides a webview-based panel in VS Code's bottom panel area
 * (alongside Terminal, Problems, Output) for displaying LeetCode
 * test and submission results with a rich, interactive UI.
 */
export class TestResultsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'better-leetcode.views.testResults';

  private view: vscode.WebviewView | undefined;
  private pendingHtml: string | undefined;
  private onMessageCallback: ((message: { command: string }) => void) | undefined;

  constructor(_extensionUri: vscode.Uri) {}

  /**
   * Registers a callback to handle messages from the webview.
   * Used to relay actions like "open problem statement" back to the extension.
   *
   * @param callback - The message handler function.
   */
  public onMessage(callback: (message: { command: string }) => void): void {
    this.onMessageCallback = callback;
  }

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
    webviewView.webview.html =
      this.pendingHtml !== undefined ? this.pendingHtml : this.getEmptyHtml();
    this.pendingHtml = undefined;

    webviewView.webview.onDidReceiveMessage((message: { command: string }) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });
  }

  /**
   * Displays test or submission results in the panel.
   * Parses the result data and renders the interactive results UI.
   *
   * @param data - The test result display data containing the LeetCode result
   *   and parsed test inputs.
   */
  public showResults(data: TestResultDisplayData): void {
    const html = this.getResultsHtml(data);
    if (this.view) {
      this.view.webview.html = html;
      this.view.show(true);
    } else {
      this.pendingHtml = html;
    }
  }

  /**
   * Shows a loading spinner with a message in the panel.
   *
   * @param message - The loading message to display (e.g., 'Testing solution...').
   */
  public showLoading(message: string): void {
    const html = this.getLoadingHtml(message);
    if (this.view) {
      this.view.webview.html = html;
      this.view.show(true);
    } else {
      this.pendingHtml = html;
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

    const hasError =
      (result.compile_error !== undefined && result.compile_error !== '') ||
      (result.runtime_error !== undefined && result.runtime_error !== '');
    const errorText =
      result.full_compile_error ||
      result.full_runtime_error ||
      result.compile_error ||
      result.runtime_error ||
      '';

    // Determine how to count cases.
    const cases = this.buildCases(data);
    const casesJson = JSON.stringify(cases);

    const totalCases = this.getTotalCases(data, cases);
    const totalCorrect = this.getTotalCorrect(data, cases);

    // For test (interpret) runs, LeetCode returns status 10 (Accepted) even if test cases fail.
    // We must manually verify if totalCorrect === totalCases to determine true acceptance.
    let isAccepted = false;
    let displayStatusMsg = result.status_msg;
    let statusColor = this.getStatusColor(result.status_code);

    if (hasError) {
      isAccepted = false;
      displayStatusMsg = result.status_msg || 'Error';
    } else if (data.type === 'test') {
      if (result.status_code === 10) {
        // Status 10 indicates the code ran successfully. We determine correctness by comparing answers.
        isAccepted = totalCases > 0 && totalCorrect === totalCases;
        displayStatusMsg = isAccepted ? 'Accepted' : 'Wrong Answer';
      } else {
        // Other statuses (like TLE - 14, MLE - 15) indicate a failure to complete execution.
        isAccepted = false;
        displayStatusMsg = result.status_msg || 'Error';
      }
      statusColor = isAccepted ? '#2cbb5d' : '#ef4743'; // Green for Accepted, Red for WA
    } else {
      isAccepted = result.status_code === 10 || result.status_msg === 'Accepted';
      displayStatusMsg = result.status_msg || (isAccepted ? 'Accepted' : 'Wrong Answer');
    }

    const statusIcon = isAccepted ? '✅' : '❌';
    const showStats = data.type === 'submit' && isAccepted;
    const hasCases = cases.length > 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .show-problem-btn {
      margin-left: auto;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--vscode-button-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.15));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      white-space: nowrap;
    }
    .show-problem-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.25));
      border-color: var(--vscode-focusBorder, rgba(128,128,128,0.5));
    }

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

    .add-testcase-btn {
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--vscode-button-border, rgba(128,128,128,0.3));
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground, rgba(128,128,128,0.15));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      cursor: pointer;
      margin-left: 10px;
    }
    .add-testcase-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.25));
    }
    .add-testcase-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ── Single column layout for error-only or no-sidebar ── */
    .container.no-sidebar {
      grid-template-columns: 1fr;
    }

    .container.no-sidebar .sidebar {
      display: none;
    }

    /* Per-case status label in sidebar */
    .case-status {
      font-size: 11px;
      font-weight: 600;
      margin-left: auto;
      letter-spacing: 0.3px;
    }

    .case-status.pass { color: #2cbb5d; }
    .case-status.fail { color: #ef4743; }

    /* Per-case status header in detail area */
    .case-detail-status {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .case-detail-status.pass { color: #2cbb5d; }
    .case-detail-status.fail { color: #ef4743; }

    /* Success summary shown when no per-case data is available */
    .success-summary {
      text-align: center;
      padding: 40px 20px;
      opacity: 0.8;
    }

    .success-summary .icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .success-summary p {
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container${!hasCases ? ' no-sidebar' : ''}" id="root">
    <div class="sidebar">
      <div class="sidebar-header">Test Cases</div>
      ${this.buildCaseListHtmlFromCases(cases, statusColor)}
    </div>

    <div class="main" id="main-content">
      <!-- Status banner -->
      <div class="status-banner">
        <h2 style="color: ${statusColor}; margin: 0; font-size: 20px;">
          ${statusIcon} ${this.escapeHtml(displayStatusMsg)}
        </h2>
        <span style="opacity: 0.8; font-size: 13px;">
          ${totalCorrect} / ${totalCases} test cases passed
        </span>
        ${result.status_runtime ? `<span style="opacity: 0.8; font-size: 13px; border-left: 1px solid rgba(128,128,128,0.3); padding-left: 12px; margin-left: 12px;">⏱ Runtime: ${this.escapeHtml(result.status_runtime)}</span>` : ''}
        <button class="show-problem-btn" id="show-problem-btn" title="Show Problem Statement">📄 Show Problem</button>
      </div>

      ${showStats ? this.buildStatsHtml(result) : ''}
      ${hasError ? this.buildErrorHtml(errorText) : ''}

      <div id="case-detail">
        ${hasCases ? this.buildCaseDetailFromCase(cases[0], data.type === 'submit') : this.buildSuccessSummary(data)}
      </div>
    </div>
  </div>

  <script>
    (function() {
      var vscode = acquireVsCodeApi();
      var cases = ${casesJson};

      document.querySelectorAll('.case-item').forEach(function(item, index) {
        item.addEventListener('click', function() {
          document.querySelectorAll('.case-item').forEach(function(el) {
            el.classList.remove('active');
          });
          item.classList.add('active');
          var detail = document.getElementById('case-detail');
          if (detail && cases[index]) {
            detail.innerHTML = buildDetail(cases[index]);
          }
        });
      });

      var showProblemBtn = document.getElementById('show-problem-btn');
      if (showProblemBtn) {
        showProblemBtn.addEventListener('click', function() {
          vscode.postMessage({ command: 'openProblemStatement' });
        });
      }

      window.addTestCase = function(input) {
        vscode.postMessage({ command: 'addTestCase', input: input });
        event.target.textContent = '✅ Added';
        event.target.disabled = true;
      };

      function escHtml(str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function buildDetail(c) {
        var html = '';
        var isSubmitFailure = ${data.type === 'submit' ? 'true' : 'false'} && !c.passed;
        // Per-case status header
        if (c.passed) {
          html += '<div class="case-detail-status pass">✅ Accepted</div>';
        } else {
          html += '<div class="case-detail-status fail">❌ Wrong Answer</div>';
        }
        if (c.input) {
          var addBtn = isSubmitFailure ? '<button class="add-testcase-btn" onclick="addTestCase(' + escHtml(JSON.stringify(c.input)) + ')">➕ Add to testcases.txt</button>' : '';
          html += '<div class="section">';
          html += '<div class="section-title" style="display:flex; justify-content:space-between; align-items:center;"><span>Input</span>' + addBtn + '</div>';
          html += '<div class="code-block">' + escHtml(c.input) + '</div>';
          html += '</div>';
        }
        // Always show output and expected sections if case has them,
        // even when they are empty strings (to signal "no output").
        if (c.hasOutput) {
          html += '<div class="section">';
          html += '<div class="section-title">Output</div>';
          var mismatch = c.hasExpected && c.output !== c.expected;
          html += '<div class="code-block' + (mismatch ? ' mismatch' : '') + '">' + escHtml(c.output) + '</div>';
          html += '</div>';
        }
        if (c.hasExpected) {
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
   * Builds the HTML for the sidebar test case list items from resolved case data.
   */
  private buildCaseListHtmlFromCases(cases: CaseData[], _statusColor: string): string {
    const items: string[] = [];
    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i];
      if (caseData === undefined) {
        continue;
      }
      const dotClass = caseData.passed ? 'pass' : 'fail';
      const activeClass = i === 0 ? ' active' : '';
      const statusText = caseData.passed ? 'Accepted' : 'Wrong';
      const statusClass = caseData.passed ? 'pass' : 'fail';

      items.push(
        `<div class="case-item${activeClass}" data-index="${i}">` +
          `<span class="case-dot ${dotClass}"></span>` +
          `<span class="case-label">Case ${i + 1}</span>` +
          `<span class="case-status ${statusClass}">${statusText}</span>` +
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
   * Builds the HTML for a single test case detail from resolved CaseData.
   */
  private buildCaseDetailFromCase(
    caseData: CaseData | undefined,
    isSubmit: boolean = false,
  ): string {
    if (caseData === undefined) {
      return '';
    }

    let html = '';
    const isSubmitFailure = isSubmit && !caseData.passed;

    // Per-case status header
    if (caseData.passed) {
      html += `<div class="case-detail-status pass">✅ Accepted</div>`;
    } else {
      html += `<div class="case-detail-status fail">❌ Wrong Answer</div>`;
    }

    if (caseData.input !== '') {
      const addBtn = isSubmitFailure
        ? `<button class="add-testcase-btn" onclick="addTestCase(${this.escapeHtml(JSON.stringify(caseData.input))})">➕ Add to testcases.txt</button>`
        : '';
      html += `
        <div class="section">
          <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;"><span>Input</span>${addBtn}</div>
          <div class="code-block">${this.escapeHtml(caseData.input)}</div>
        </div>`;
    }

    if (caseData.hasOutput) {
      const hasMismatch = caseData.hasExpected && caseData.output !== caseData.expected;
      html += `
        <div class="section">
          <div class="section-title">Output</div>
          <div class="code-block${hasMismatch ? ' mismatch' : ''}">${this.escapeHtml(caseData.output)}</div>
        </div>`;
    }

    if (caseData.hasExpected) {
      html += `
        <div class="section">
          <div class="section-title">Expected</div>
          <div class="code-block">${this.escapeHtml(caseData.expected)}</div>
        </div>`;
    }

    if (caseData.stdout !== '') {
      html += `
        <div class="section">
          <div class="section-title">Stdout</div>
          <div class="code-block stdout">${this.escapeHtml(caseData.stdout)}</div>
        </div>`;
    }

    return html;
  }

  /**
   * Builds a summary HTML when there are no per-case details to show
   * (e.g., a successful submission with all hidden tests passing).
   */
  private buildSuccessSummary(data: TestResultDisplayData): string {
    const { result } = data;
    const isAccepted = result.status_code === 10 || result.status_msg === 'Accepted';
    if (data.type === 'submit' && isAccepted) {
      return `<div class="success-summary">
        <div class="icon">🎉</div>
        <p>All test cases passed!</p>
      </div>`;
    }
    return '';
  }

  /**
   * Resolves per-case data from the LeetCode result.
   *
   * For interpret (test) results, LeetCode returns code_answer and
   * expected_answer as parallel arrays (one entry per test case).
   *
   * For submit results, these arrays are usually empty. Instead:
   *  - On success: total_correct === total_testcases, no per-case data.
   *  - On failure: last_testcase, expected_output, and code_output
   *    describe the first failing case.
   */
  private buildCases(data: TestResultDisplayData): CaseData[] {
    const { result, testInputs } = data;
    const codeAnswer = result.code_answer ?? [];
    const expectedAnswer = result.expected_answer ?? [];
    const stdOutputList = result.std_output_list ?? [];

    // Determine whether we have per-case array data
    const hasPerCaseData = codeAnswer.length > 0 || expectedAnswer.length > 0;

    if (hasPerCaseData) {
      // Test (interpret) flow — build from parallel arrays
      const count = Math.max(codeAnswer.length, expectedAnswer.length, testInputs.length);

      const cases: CaseData[] = [];
      for (let i = 0; i < count; i++) {
        const output = codeAnswer[i];
        const expected = expectedAnswer[i];
        const hasOutput = output !== undefined;
        const hasExpected = expected !== undefined;
        const passed = hasOutput && hasExpected && output === expected;

        cases.push({
          input: testInputs[i] ?? '',
          output: output ?? '',
          expected: expected ?? '',
          stdout: stdOutputList[i] ?? '',
          passed,
          hasOutput,
          hasExpected,
        });
      }
      return cases;
    }

    // Submit flow — no per-case arrays
    const isAccepted = result.status_code === 10 || result.status_msg === 'Accepted';
    if (data.type === 'submit' && !isAccepted) {
      // Failed submission: show the first failing case from scalar fields
      const failInput = result.last_testcase ?? '';
      const failExpected = result.expected_output ?? '';

      // code_output may be a string (submit flow) or an array of strings (test flow)
      let failOutput = '';
      if (typeof result.code_output === 'string') {
        failOutput = result.code_output;
      } else if (Array.isArray(result.code_output) && result.code_output.length > 0) {
        failOutput = result.code_output[0] ?? '';
      }

      let failStdout = '';
      if (typeof result.std_output_list === 'string') {
        failStdout = result.std_output_list;
      } else if (Array.isArray(result.std_output_list) && result.std_output_list.length > 0) {
        failStdout = result.std_output_list[0] ?? '';
      }

      return [
        {
          input: failInput,
          output: failOutput,
          expected: failExpected,
          stdout: failStdout,
          passed: false,
          hasOutput: failOutput !== '',
          hasExpected: failExpected !== '',
        },
      ];
    }

    // Successful submission with no per-case data — nothing to show per case
    return [];
  }

  /**
   * Returns the total number of test cases for the status banner.
   */
  private getTotalCases(data: TestResultDisplayData, cases: CaseData[]): number {
    const { result } = data;
    // Prefer total_testcases from LeetCode for submissions
    if (
      data.type === 'submit' &&
      result.total_testcases !== null &&
      result.total_testcases !== undefined
    ) {
      return result.total_testcases;
    }
    return cases.length;
  }

  /**
   * Returns the count of correct test cases for the status banner.
   */
  private getTotalCorrect(data: TestResultDisplayData, cases: CaseData[]): number {
    const { result } = data;
    // Prefer total_correct from LeetCode for submissions
    if (
      data.type === 'submit' &&
      result.total_correct !== null &&
      result.total_correct !== undefined
    ) {
      return result.total_correct;
    }
    return cases.filter((c) => c.passed).length;
  }

  /**
   * Returns the color associated with a LeetCode status code.
   *
   * @param statusCode - LeetCode status code (10=Accepted, 11=Wrong Answer, etc.).
   */
  private getStatusColor(statusCode: number): string {
    switch (statusCode) {
      case 10:
        return '#2cbb5d'; // Accepted
      case 20:
        return '#ffa116'; // Compile Error
      default:
        return '#ef4743'; // Wrong Answer, Runtime Error, TLE, etc.
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
