import * as vscode from 'vscode';

export class ProblemWebview {
  public static currentPanel: ProblemWebview | undefined;
  public static readonly viewType = 'problemWebview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, problemSlug: string) {
    const column = vscode.ViewColumn.One;

    if (ProblemWebview.currentPanel) {
      ProblemWebview.currentPanel._panel.reveal(column);
      ProblemWebview.currentPanel.update(problemSlug);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ProblemWebview.viewType,
      `Problem: ${problemSlug}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
      }
    );

    ProblemWebview.currentPanel = new ProblemWebview(panel, extensionUri);
    ProblemWebview.currentPanel.update(problemSlug);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    ProblemWebview.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private update(problemSlug: string) {
    this._panel.title = `Problem: ${problemSlug}`;
    this._panel.webview.html = this._getHtmlForWebview(problemSlug);
  }

  private _getHtmlForWebview(problemSlug: string) {
    // Basic styling to match VSCode theme
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${problemSlug}</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
        line-height: 1.6;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 8px;
        text-transform: capitalize;
      }
      .badges {
        margin-bottom: 20px;
        display: flex;
        gap: 10px;
      }
      .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }
      .badge.easy { background: rgba(0, 184, 163, 0.15); color: rgb(0, 184, 163); }
      .badge.medium { background: rgba(255, 192, 30, 0.15); color: rgb(255, 192, 30); }
      .badge.hard { background: rgba(255, 55, 95, 0.15); color: rgb(255, 55, 95); }
      
      pre {
        background-color: var(--vscode-textCodeBlock-background);
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
      }
      code {
        font-family: var(--vscode-editor-font-family);
      }
    </style>
</head>
<body>
    <h1>${problemSlug.replace(/-/g, ' ')}</h1>
    <div class="badges">
      <span class="badge easy">Easy</span>
    </div>
    <div class="content">
      <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p>
      <p>You may assume that each input would have exactly one solution, and you may not use the same element twice.</p>
      <p>You can return the answer in any order.</p>
      
      <h3>Example 1:</h3>
      <pre><code>Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].</code></pre>
      
      <h3>Constraints:</h3>
      <ul>
        <li><code>2 <= nums.length <= 10^4</code></li>
        <li><code>-10^9 <= nums[i] <= 10^9</code></li>
        <li><code>-10^9 <= target <= 10^9</code></li>
      </ul>
    </div>
</body>
</html>`;
  }
}
