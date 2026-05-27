import * as vscode from 'vscode';
import { ProblemDetails } from '../leetcode/types';

export class ProblemWebview {
  public static currentPanel: ProblemWebview | undefined;
  public static readonly viewType = 'problemWebview';

  public currentProblemSlug?: string;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, details: ProblemDetails): void {
    const column = vscode.ViewColumn.One;

    if (ProblemWebview.currentPanel) {
      ProblemWebview.currentPanel._panel.reveal(column);
      ProblemWebview.currentPanel.update(details);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ProblemWebview.viewType,
      `Problem: ${details.title}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
      },
    );

    ProblemWebview.currentPanel = new ProblemWebview(panel);
    ProblemWebview.currentPanel.update(details);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose(): void {
    ProblemWebview.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public update(details: ProblemDetails): void {
    this.currentProblemSlug = details.titleSlug;
    this._panel.title = `${details.questionFrontendId}. ${details.title}`;
    this._panel.webview.html = this._getHtmlForWebview(details);
  }

  private _getHtmlForWebview(details: ProblemDetails): string {
    const difficultyClass = details.difficulty.toLowerCase();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${details.title}</title>
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
        line-height: 1.6;
      }
      h1 {
        font-size: 22px;
        margin-bottom: 8px;
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
      ul, ol {
        padding-left: 20px;
      }
      li {
        margin-bottom: 4px;
      }
    </style>
</head>
<body>
    <h1>${details.questionFrontendId}. ${details.title}</h1>
    <div class="badges">
      <span class="badge ${difficultyClass}">${details.difficulty}</span>
    </div>
    <div class="content">
      ${details.content}
    </div>
</body>
</html>`;
  }
}
