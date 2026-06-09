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
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
        line-height: 1.6;
      }
      h1 {
        font-size: 22px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--vscode-titleBar-activeForeground, var(--vscode-editor-foreground));
      }
      .badges {
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .badge.easy { background: rgba(0, 184, 163, 0.15); color: rgb(0, 184, 163); }
      .badge.medium { background: rgba(255, 192, 30, 0.15); color: rgb(255, 192, 30); }
      .badge.hard { background: rgba(255, 55, 95, 0.15); color: rgb(255, 55, 95); }
      
      .tags-toggle-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.05));
        color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
        border: 1px solid var(--vscode-button-border, rgba(255, 255, 255, 0.15));
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    transform 0.1s ease;
      }
      .tags-toggle-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.1));
        border-color: var(--vscode-button-border, rgba(255, 255, 255, 0.3));
      }
      .tags-toggle-btn:active {
        transform: scale(0.98);
      }
      .tags-toggle-btn .chevron {
        width: 12px;
        height: 12px;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .tags-toggle-btn.active .chevron {
        transform: rotate(90deg);
      }

      .tags-container {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1), 
                    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    margin-bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        margin-bottom: 0;
        overflow: hidden;
      }
      .tags-container.expanded {
        grid-template-rows: 1fr;
        opacity: 1;
        margin-bottom: 20px;
      }
      .tags-list {
        min-height: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 4px 2px;
      }
      .tag-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        background: rgba(128, 128, 128, 0.08);
        border: 1px solid rgba(128, 128, 128, 0.12);
        color: var(--vscode-editor-foreground);
        opacity: 0.9;
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .tag-badge:hover {
        background: rgba(128, 128, 128, 0.16);
        border-color: rgba(128, 128, 128, 0.25);
        color: var(--vscode-editor-foreground);
        opacity: 1;
        transform: translateY(-1px);
      }
      
      .hints-list {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        background: rgba(128, 128, 128, 0.05);
        border-radius: 8px;
        border: 1px solid rgba(128, 128, 128, 0.1);
      }
      .hint-item {
        font-size: 13px;
        color: var(--vscode-editor-foreground);
      }
      .hint-item strong {
        color: var(--vscode-textPreformat-foreground, var(--vscode-editor-foreground));
      }

      pre {
        background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid rgba(128, 128, 128, 0.1);
        overflow-x: auto;
      }
      code {
        font-family: var(--vscode-editor-font-family, Consolas, Monaco, monospace);
        font-size: 13px;
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
      ${
        details.topicTags && details.topicTags.length > 0
          ? `
        <button id="tags-toggle" class="tags-toggle-btn">
          <span>Show Tags</span>
          <svg class="chevron" viewBox="0 0 24 24">
            <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </button>
      `
          : ''
      }
      ${
        details.hints && details.hints.length > 0
          ? `
        <button id="hints-toggle" class="tags-toggle-btn">
          <span>Show Hints</span>
          <svg class="chevron" viewBox="0 0 24 24">
            <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </button>
      `
          : ''
      }
    </div>
    ${
      details.topicTags && details.topicTags.length > 0
        ? `
      <div id="tags-container" class="tags-container">
        <div class="tags-list">
          ${details.topicTags.map((tag) => `<span class="tag-badge">${tag.name}</span>`).join('')}
        </div>
      </div>
    `
        : ''
    }
    ${
      details.hints && details.hints.length > 0
        ? `
      <div id="hints-container" class="tags-container">
        <div class="hints-list">
          ${details.hints.map((hint, index) => `<div class="hint-item"><strong>Hint ${index + 1}:</strong> <span>${hint}</span></div>`).join('')}
        </div>
      </div>
    `
        : ''
    }
    <div class="content">
      ${details.content}
    </div>

    <script>
      (function() {
        function setupToggle(btnId, containerId, showText, hideText) {
          const toggleBtn = document.getElementById(btnId);
          const container = document.getElementById(containerId);
          if (toggleBtn && container) {
            toggleBtn.addEventListener('click', () => {
              const isExpanded = container.classList.toggle('expanded');
              toggleBtn.classList.toggle('active', isExpanded);
              const btnText = toggleBtn.querySelector('span');
              if (btnText) {
                btnText.textContent = isExpanded ? hideText : showText;
              }
            });
          }
        }

        setupToggle('tags-toggle', 'tags-container', 'Show Tags', 'Hide Tags');
        setupToggle('hints-toggle', 'hints-container', 'Show Hints', 'Hide Hints');
      })();
    </script>
</body>
</html>`;
  }
}
