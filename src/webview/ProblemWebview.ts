import * as vscode from 'vscode';
import { ProblemDetails } from '../leetcode/types';
import { DiscussionWebview } from './DiscussionWebview';

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return match;
    }
  });
}

export class ProblemWebview {
  public static currentPanel: ProblemWebview | undefined;
  public static readonly viewType = 'problemWebview';

  public currentProblemSlug?: string;
  public currentTopicId?: number | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    details: ProblemDetails,
    viewColumn?: vscode.ViewColumn,
  ): void {
    if (ProblemWebview.currentPanel) {
      ProblemWebview.currentPanel._panel.reveal(viewColumn);
      ProblemWebview.currentPanel.update(details);
      return;
    }

    const column = viewColumn !== undefined ? viewColumn : vscode.ViewColumn.One;

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

    this._panel.webview.onDidReceiveMessage(
      (message: { command?: string; topicId?: number; title?: string }) => {
        switch (message.command) {
          case 'showDiscussions':
            if (
              this.currentProblemSlug !== undefined &&
              this.currentProblemSlug !== '' &&
              typeof message.topicId === 'number' &&
              !isNaN(message.topicId)
            ) {
              void vscode.commands.executeCommand('better-leetcode.showDiscussions', {
                titleSlug: this.currentProblemSlug,
                topicId: message.topicId,
                title: message.title,
              });
            }
            return;
        }
      },
      null,
      this._disposables,
    );
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

    // Close associated discussion panel when the problem is closed
    if (this.currentTopicId !== undefined) {
      DiscussionWebview.closeByTopicId(this.currentTopicId);
    }
  }

  public update(details: ProblemDetails): void {
    this.currentProblemSlug = details.titleSlug;
    if (details.topicId !== undefined && details.topicId !== null) {
      this.currentTopicId = details.topicId;
    } else {
      this.currentTopicId = undefined;
    }
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
      ${
        details.topicId !== undefined && details.topicId !== null
          ? `
        <button id="discussions-btn" class="tags-toggle-btn" style="background: rgba(88, 166, 255, 0.15); color: rgb(88, 166, 255); border-color: rgba(88, 166, 255, 0.3);">
          <span>Show Discussions</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-left: 4px;">
            <path fill-rule="evenodd" d="M1.5 2.75a.25.25 0 01.25-.25h8.5a.25.25 0 01.25.25v5.5a.25.25 0 01-.25.25h-3.5a.75.75 0 00-.53.22L3.5 11.44V9.25a.75.75 0 00-.75-.75h-1a.25.25 0 01-.25-.25v-5.5zM1.75 1A1.75 1.75 0 000 2.75v5.5C0 9.216.784 10 1.75 10H2v3.544a.5.5 0 00.854.354L5.646 11.1h5.104A1.75 1.75 0 0012.5 9.35V2.75A1.75 1.75 0 0010.75 1h-9z"/>
            <path d="M14.5 4.75a.25.25 0 00-.25-.25h-1.25a.75.75 0 110-1.5h1.25A1.75 1.75 0 0116 4.75v5.5A1.75 1.75 0 0114.25 12H14v3.544a.5.5 0 01-.854.354L10.354 13.1H8.75a.75.75 0 010-1.5h1.896a.25.25 0 00.177.073l2.677 2.677V12.25a.75.75 0 01.75-.75h.25a.25.25 0 00.25-.25v-5.5z"/>
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
          ${details.hints.map((hint, index) => `<div class="hint-item"><strong>Hint ${index + 1}:</strong> <span>${escapeHtml(hint)}</span></div>`).join('')}
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

        const vscode = acquireVsCodeApi();
        const discussionsBtn = document.getElementById('discussions-btn');
        if (discussionsBtn) {
          discussionsBtn.addEventListener('click', () => {
            vscode.postMessage({
              command: 'showDiscussions',
              topicId: ${details.topicId},
              title: ${JSON.stringify(details.title)}
            });
          });
        }
      })();
    </script>
</body>
</html>`;
  }
}
