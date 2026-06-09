import * as vscode from 'vscode';
import { LeetCodeClient } from '../leetcode/client';
import { Logger } from '../logger';
import { TextRenderer } from '../utils/textRenderer';

export class DiscussionWebview {
  public static currentPanels: Map<number, DiscussionWebview> = new Map();
  public static readonly viewType = 'discussionWebview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _client: LeetCodeClient;
  private readonly _topicId: number;
  private readonly _titleSlug: string;
  private _disposables: vscode.Disposable[] = [];

  public static async createOrShow(
    extensionUri: vscode.Uri,
    client: LeetCodeClient,
    titleSlug: string,
    topicId: number,
    title: string
  ): Promise<void> {
    if (DiscussionWebview.currentPanels.has(topicId)) {
      const existing = DiscussionWebview.currentPanels.get(topicId)!;
      existing._panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    // Split the current editor down to open the discussion panel below
    await vscode.commands.executeCommand('workbench.action.splitEditorDown');

    const panel = vscode.window.createWebviewPanel(
      DiscussionWebview.viewType,
      `Discussions: ${title}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
        retainContextWhenHidden: true,
      }
    );

    const discussionWebview = new DiscussionWebview(panel, extensionUri, client, titleSlug, topicId);
    DiscussionWebview.currentPanels.set(topicId, discussionWebview);
  }

  public static closeByTopicId(topicId: number): void {
    if (DiscussionWebview.currentPanels.has(topicId)) {
      const existing = DiscussionWebview.currentPanels.get(topicId)!;
      existing.dispose();
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    client: LeetCodeClient,
    titleSlug: string,
    topicId: number
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._client = client;
    this._titleSlug = titleSlug;
    this._topicId = topicId;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'loadPage':
            await this._loadPage(message.page, message.orderBy);
            return;
          case 'loadReplies':
            await this._loadReplies(message.commentId, message.skip);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    DiscussionWebview.currentPanels.delete(this._topicId);
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update(): Promise<void> {
    this._panel.webview.html = this._getHtmlForWebview();
    await this._loadPage(1, 'most_votes');
  }

  private async _loadPage(page: number, orderBy: string = 'most_votes'): Promise<void> {
    try {
      const data = await this._client.getDiscussionComments(this._topicId, page, 15, orderBy);
      if (data && data.data) {
        data.data.forEach(node => {
          if (node.post && node.post.content) {
            node.post.content = TextRenderer.render(node.post.content);
          }
        });
        this._panel.webview.postMessage({
          command: 'renderPage',
          data: data,
          page: page,
          orderBy: orderBy
        });
      }
    } catch (err) {
      Logger.getInstance().error('webview', `Failed to load discussion page ${page}`, err);
    }
  }

  private async _loadReplies(commentId: string, skip: number): Promise<void> {
    try {
      const data = await this._client.getCommentReplies(commentId, skip, 10);
      if (data && data.edges) {
        data.edges.forEach(edge => {
          if (edge.node.post && edge.node.post.content) {
            edge.node.post.content = TextRenderer.render(edge.node.post.content);
          }
        });
        this._panel.webview.postMessage({
          command: 'renderReplies',
          commentId: commentId,
          data: data,
          skip: skip
        });
      }
    } catch (err) {
      Logger.getInstance().error('webview', `Failed to load replies for ${commentId}`, err);
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discussions</title>
    <style>
      body {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
        line-height: 1.5;
      }
      .header-controls {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
      }
      select.filter-select {
        background-color: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        padding: 4px 8px;
        border-radius: 4px;
        font-family: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .loading {
        text-align: center;
        padding: 20px;
        opacity: 0.7;
      }
      .comment {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        background: var(--vscode-editorWidget-background);
      }
      .comment-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 8px;
      }
      .avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: var(--vscode-badge-background);
        overflow: hidden;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .author-name {
        font-weight: 600;
        color: var(--vscode-textLink-foreground);
      }
      .meta {
        font-size: 11px;
        opacity: 0.7;
      }
      .comment-content {
        margin-bottom: 8px;
        word-wrap: break-word;
      }
      .comment-content img {
        max-width: 100%;
        border-radius: 4px;
      }
      .comment-content pre {
        background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
      }
      .comment-content code {
        font-family: var(--vscode-editor-font-family, Consolas, Monaco, monospace);
        font-size: 13px;
      }
      .comment-actions {
        display: flex;
        gap: 16px;
        font-size: 12px;
        opacity: 0.8;
      }
      .action-btn {
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        padding: 0;
        font-family: inherit;
        font-size: inherit;
      }
      .action-btn:hover {
        text-decoration: underline;
      }
      .replies-container {
        margin-left: 20px;
        padding-left: 12px;
        border-left: 2px solid var(--vscode-panel-border);
        margin-top: 12px;
      }
      .reply {
        margin-bottom: 12px;
      }
      .reply:last-child {
        margin-bottom: 0;
      }
      .pagination {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
      }
      .page-btn {
        padding: 6px 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 4px;
        cursor: pointer;
      }
      .page-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .page-btn.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
    </style>
</head>
<body>
    <div class="header-controls">
      <select id="order-filter" class="filter-select" onchange="onFilterChange()">
        <option value="most_votes">Best</option>
        <option value="newest_to_oldest">Newest to Oldest</option>
      </select>
    </div>
    <div id="loading" class="loading">Loading discussions...</div>
    <div id="comments-container"></div>
    <div id="pagination" class="pagination"></div>

    <script>
      const vscode = acquireVsCodeApi();
      const loadingEl = document.getElementById('loading');
      const containerEl = document.getElementById('comments-container');
      const paginationEl = document.getElementById('pagination');
      const filterSelect = document.getElementById('order-filter');
      
      let currentPage = 1;
      let currentOrderBy = 'most_votes';

      window.onFilterChange = function() {
        currentOrderBy = filterSelect.value;
        goToPage(1);
      };

      // Listen for messages from the extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'renderPage':
            renderPage(message.data, message.page);
            if (message.orderBy) {
              currentOrderBy = message.orderBy;
              filterSelect.value = currentOrderBy;
            }
            break;
          case 'renderReplies':
            renderReplies(message.commentId, message.data, message.skip);
            break;
        }
      });

      function formatDate(timestamp) {
        return new Date(timestamp * 1000).toLocaleDateString();
      }

      function createCommentHtml(node, isReply = false) {
        const post = node.post;
        if (!post) return '';
        
        const author = post.author || {};
        const profile = author.profile || {};
        const avatarUrl = profile.userAvatar || '';
        const authorName = author.username || 'Anonymous';
        
        const avatarHtml = avatarUrl ? \`<div class="avatar"><img src="\${avatarUrl}" alt="avatar" /></div>\` : '<div class="avatar"></div>';
        
        const numChildren = node.numChildren || 0;
        let repliesHtml = '';
        if (!isReply && numChildren > 0) {
          repliesHtml = \`
            <div class="comment-actions">
              <span>👍 \${post.voteUpCount || 0}</span>
              <button class="action-btn" onclick="loadReplies('\${node.id}', 0, this)">View \${numChildren} replies</button>
            </div>
            <div id="replies-\${node.id}" class="replies-container" style="display: none;"></div>
          \`;
        } else {
          repliesHtml = \`
            <div class="comment-actions">
              <span>👍 \${post.voteUpCount || 0}</span>
            </div>
          \`;
        }

        return \`
          <div class="comment \${isReply ? 'reply' : ''}">
            <div class="comment-header">
              \${avatarHtml}
              <span class="author-name">\${authorName}</span>
              <span class="meta">\${formatDate(post.creationDate)}</span>
            </div>
            <div class="comment-content">
              \${post.content}
            </div>
            \${repliesHtml}
          </div>
        \`;
      }

      function renderPage(data, page) {
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '';
        
        if (!data || !data.data || data.data.length === 0) {
          containerEl.innerHTML = '<div class="loading">No discussions found.</div>';
          return;
        }

        let html = '';
        data.data.forEach(node => {
          html += createCommentHtml(node, false);
        });
        containerEl.innerHTML = html;

        // Render pagination
        renderPagination(data.totalNum, page);
      }

      function renderPagination(totalNum, currentPage) {
        const numPerPage = 15; // Based on backend
        const totalPages = Math.ceil(totalNum / numPerPage);
        
        if (totalPages <= 1) {
          paginationEl.innerHTML = '';
          return;
        }

        let html = '';
        
        // Show up to 5 pages + Last
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, start + 4);
        
        if (currentPage > 1) {
          html += \`<button class="page-btn" onclick="goToPage(\${currentPage - 1})">Prev</button>\`;
        }
        
        for (let i = start; i <= end; i++) {
          html += \`<button class="page-btn \${i === currentPage ? 'active' : ''}" onclick="goToPage(\${i})">\${i}</button>\`;
        }

        if (end < totalPages) {
          if (end < totalPages - 1) html += '<span>...</span>';
          html += \`<button class="page-btn" onclick="goToPage(\${totalPages})">\${totalPages}</button>\`;
        }
        
        if (currentPage < totalPages) {
          html += \`<button class="page-btn" onclick="goToPage(\${currentPage + 1})">Next</button>\`;
        }

        paginationEl.innerHTML = html;
      }

      window.goToPage = function(page) {
        currentPage = page;
        loadingEl.style.display = 'block';
        containerEl.innerHTML = '';
        paginationEl.innerHTML = '';
        vscode.postMessage({ command: 'loadPage', page: page, orderBy: currentOrderBy });
        window.scrollTo(0, 0);
      };

      window.loadReplies = function(commentId, skip, btn) {
        const repliesContainer = document.getElementById(\`replies-\${commentId}\`);
        if (repliesContainer.style.display === 'block' && skip === 0) {
          // Toggle off
          repliesContainer.style.display = 'none';
          btn.textContent = btn.dataset.originalText;
          return;
        }
        
        if (skip === 0) {
          btn.dataset.originalText = btn.textContent;
          btn.textContent = 'Hide replies';
          repliesContainer.style.display = 'block';
          repliesContainer.innerHTML = '<div class="meta">Loading replies...</div>';
        } else {
          btn.textContent = 'Loading...';
        }
        
        vscode.postMessage({ command: 'loadReplies', commentId: commentId, skip: skip });
      };

      function renderReplies(commentId, data, skip) {
        const container = document.getElementById(\`replies-\${commentId}\`);
        if (!container) return;

        let html = skip === 0 ? '' : container.innerHTML.replace('<div class="meta">Loading more...</div>', '');
        
        if (data && data.edges) {
          data.edges.forEach(edge => {
            html += createCommentHtml(edge.node, true);
          });
          
          const loaded = skip + data.edges.length;
          if (loaded < data.totalNum) {
            html += \`
              <button class="action-btn" style="margin-top: 8px;" onclick="loadMoreReplies('\${commentId}', \${loaded}, this)">
                Load more replies (\${data.totalNum - loaded} remaining)
              </button>
            \`;
          }
        } else if (skip === 0) {
          html = '<div class="meta">No replies found.</div>';
        }
        
        container.innerHTML = html;
      }
      
      window.loadMoreReplies = function(commentId, skip, btn) {
        btn.textContent = 'Loading...';
        btn.disabled = true;
        vscode.postMessage({ command: 'loadReplies', commentId: commentId, skip: skip });
      };
    </script>
</body>
</html>`;
  }
}
