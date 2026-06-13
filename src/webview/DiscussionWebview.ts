import * as vscode from 'vscode';
import { LeetCodeClient } from '../leetcode/client';
import { Logger } from '../logger';
import { TextRenderer } from '../utils/textRenderer';

/**
 * Generates a random nonce string for use in Content Security Policy.
 *
 * @returns A 32-character alphanumeric nonce.
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Webview panel for displaying and interacting with LeetCode discussion topics.
 */
export class DiscussionWebview {
  public static currentPanels: Map<number, DiscussionWebview> = new Map();
  public static readonly viewType = 'discussionWebview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _client: LeetCodeClient;
  private readonly _topicId: number;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates or shows a discussion webview panel for a given topic.
   *
   * @param extensionUri The extension's URI.
   * @param client The LeetCode client.
   * @param topicId The ID of the discussion topic.
   * @param title The title of the discussion.
   * @returns A promise that resolves when the panel is created or shown.
   */
  public static async createOrShow(
    extensionUri: vscode.Uri,
    client: LeetCodeClient,
    topicId: number,
    title: string,
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
      },
    );

    const discussionWebview = new DiscussionWebview(panel, client, topicId, extensionUri);
    DiscussionWebview.currentPanels.set(topicId, discussionWebview);
  }

  /**
   * Closes the discussion panel for the specified topic ID if it is open.
   *
   * @param topicId The ID of the topic.
   */
  public static closeByTopicId(topicId: number): void {
    if (DiscussionWebview.currentPanels.has(topicId)) {
      const existing = DiscussionWebview.currentPanels.get(topicId)!;
      existing.dispose();
    }
  }

  /**
   * Creates an instance of DiscussionWebview.
   *
   * @param panel The webview panel.
   * @param client The LeetCode client.
   * @param topicId The ID of the discussion topic.
   * @param extensionUri The extension URI, used to resolve local resource paths.
   */
  private constructor(
    panel: vscode.WebviewPanel,
    client: LeetCodeClient,
    topicId: number,
    extensionUri: vscode.Uri,
  ) {
    this._panel = panel;
    this._client = client;
    this._topicId = topicId;
    this._extensionUri = extensionUri;

    void this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message: {
        command?: string;
        page?: unknown;
        orderBy?: unknown;
        commentId?: unknown;
        skip?: unknown;
      }) => {
        switch (message.command) {
          case 'loadPage':
            if (typeof message.page === 'number' && typeof message.orderBy === 'string') {
              await this._loadPage(message.page, message.orderBy);
            }
            return;
          case 'loadReplies':
            if (typeof message.commentId === 'string' && typeof message.skip === 'number') {
              await this._loadReplies(message.commentId, message.skip);
            }
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  /**
   * Disposes the webview panel and cleans up associated resources.
   */
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

  /**
   * Updates the webview content with the HTML and loads the initial comments.
   *
   * @returns A promise that resolves when the update is complete.
   */
  private async _update(): Promise<void> {
    this._panel.webview.html = this._getHtmlForWebview();
    await this._loadPage(1, 'most_votes');
  }

  /**
   * Loads a specific page of comments for the discussion topic.
   *
   * @param page The page number to load.
   * @param orderBy The order of comments.
   * @returns A promise that resolves when the page is loaded.
   */
  private async _loadPage(page: number, orderBy: string = 'most_votes'): Promise<void> {
    try {
      const data = await this._client.getDiscussionComments(this._topicId, page, 15, orderBy);
      if (data !== undefined) {
        const mappedData = {
          ...data,
          data: data.data.map((node) => ({
            ...node,
            post: {
              ...node.post,
              content: TextRenderer.render(node.post.content),
            },
          })),
        };
        void this._panel.webview.postMessage({
          command: 'renderPage',
          data: mappedData,
          page: page,
          orderBy: orderBy,
        });
      }
    } catch (err) {
      Logger.getInstance().error('webview', `Failed to load discussion page ${page}`, err);
    }
  }

  /**
   * Loads replies for a specific comment.
   *
   * @param commentId The ID of the comment.
   * @param skip The number of replies to skip (offset).
   * @returns A promise that resolves when the replies are loaded.
   */
  private async _loadReplies(commentId: string, skip: number): Promise<void> {
    try {
      const data = await this._client.getCommentReplies(commentId, skip, 10);
      if (data !== undefined) {
        const newData = {
          ...data,
          edges: data.edges.map((edge) => ({
            ...edge,
            node: {
              ...edge.node,
              post: {
                ...edge.node.post,
                content: TextRenderer.render(edge.node.post.content),
              },
            },
          })),
        };
        void this._panel.webview.postMessage({
          command: 'renderReplies',
          commentId: commentId,
          data: newData,
          skip: skip,
        });
      }
    } catch (err) {
      Logger.getInstance().error('webview', `Failed to load replies for ${commentId}`, err);
    }
  }

  /**
   * Generates the HTML content for the webview.
   * Uses a nonce-based CSP and resolves KaTeX CSS from local extension resources.
   *
   * @returns The HTML string.
   */
  private _getHtmlForWebview(): string {
    const nonce = getNonce();
    const webview = this._panel.webview;
    const cspSource = webview.cspSource;

    // Resolve local KaTeX CSS via VS Code's webview URI scheme
    const katexCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', 'katex', 'katex.min.css'),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      style-src ${cspSource} 'unsafe-inline';
      font-src ${cspSource};
      img-src ${cspSource} https: data:;
      script-src 'nonce-${nonce}';
    ">
    <title>Discussions</title>
    <link rel="stylesheet" href="${katexCssUri.toString()}">
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
      <select id="order-filter" class="filter-select">
        <option value="most_votes">Best</option>
        <option value="newest_to_oldest">Newest to Oldest</option>
      </select>
    </div>
    <div id="loading" class="loading">Loading discussions...</div>
    <div id="comments-container"></div>
    <div id="pagination" class="pagination"></div>

    <script nonce="${nonce}">
      (function() {
        const vscode = acquireVsCodeApi();
        const loadingEl = document.getElementById('loading');
        const containerEl = document.getElementById('comments-container');
        const paginationEl = document.getElementById('pagination');
        const filterSelect = document.getElementById('order-filter');

        let currentPage = 1;
        let currentOrderBy = 'most_votes';

        filterSelect.addEventListener('change', function() {
          currentOrderBy = filterSelect.value;
          goToPage(1);
        });

        // Listen for messages from the extension
        window.addEventListener('message', function(event) {
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

        /**
         * Escapes a string for safe injection as text content in HTML.
         * Use textContent instead where possible; this is for attribute values.
         *
         * @param {string} str - The string to escape.
         * @returns {string} The HTML-escaped string.
         */
        function escHtml(str) {
          if (str === null || str === undefined) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }

        function formatDate(timestamp) {
          return new Date(timestamp * 1000).toLocaleDateString();
        }

        /**
         * Builds a safe comment DOM element. Uses textContent for plain text
         * and only injects pre-sanitized HTML (from TextRenderer) for post content.
         *
         * @param {object} node - The comment node from the API.
         * @param {boolean} isReply - Whether this is a reply.
         * @returns {HTMLElement} The constructed comment element.
         */
        function createCommentElement(node, isReply) {
          const post = node.post;
          if (!post) return null;

          const author = post.author || {};
          const profile = author.profile || {};
          const avatarUrl = profile.userAvatar || '';
          const authorName = author.username || 'Anonymous';
          const numChildren = node.numChildren || 0;
          const commentId = String(node.id || '');

          // Build comment wrapper
          const wrapper = document.createElement('div');
          wrapper.className = 'comment' + (isReply ? ' reply' : '');

          // Header
          const header = document.createElement('div');
          header.className = 'comment-header';

          // Avatar — src set via attribute (safe URL only)
          const avatarDiv = document.createElement('div');
          avatarDiv.className = 'avatar';
          if (avatarUrl) {
            const img = document.createElement('img');
            img.alt = 'avatar';
            // Only allow https URLs to prevent data: or javascript: URIs
            if (String(avatarUrl).toLowerCase().startsWith('https://')) {
              img.src = avatarUrl;
            }
            avatarDiv.appendChild(img);
          }
          header.appendChild(avatarDiv);

          // Author name — set via textContent (safe)
          const nameSpan = document.createElement('span');
          nameSpan.className = 'author-name';
          nameSpan.textContent = authorName;
          header.appendChild(nameSpan);

          // Date
          const metaSpan = document.createElement('span');
          metaSpan.className = 'meta';
          metaSpan.textContent = formatDate(post.creationDate);
          header.appendChild(metaSpan);

          wrapper.appendChild(header);

          // Content — this is pre-sanitized HTML from TextRenderer on the extension side
          const contentDiv = document.createElement('div');
          contentDiv.className = 'comment-content';
          contentDiv.innerHTML = post.content;
          wrapper.appendChild(contentDiv);

          // Actions
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'comment-actions';

          const votesSpan = document.createElement('span');
          votesSpan.textContent = '\\uD83D\\uDC4D ' + (post.voteUpCount || 0);
          actionsDiv.appendChild(votesSpan);

          if (!isReply && numChildren > 0) {
            const replyBtn = document.createElement('button');
            replyBtn.className = 'action-btn';
            replyBtn.textContent = 'View ' + numChildren + ' replies';
            // Use data attribute for commentId — no inline eval
            replyBtn.dataset.commentId = commentId;
            replyBtn.dataset.skip = '0';
            replyBtn.addEventListener('click', function() {
              handleLoadReplies(this.dataset.commentId, parseInt(this.dataset.skip, 10), this);
            });
            actionsDiv.appendChild(replyBtn);
          }

          wrapper.appendChild(actionsDiv);

          // Replies container
          if (!isReply && numChildren > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.id = 'replies-' + escHtml(commentId);
            repliesContainer.className = 'replies-container';
            repliesContainer.style.display = 'none';
            wrapper.appendChild(repliesContainer);
          }

          return wrapper;
        }

        function renderPage(data, page) {
          loadingEl.style.display = 'none';
          containerEl.innerHTML = '';

          if (!data || !data.data || data.data.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'loading';
            msg.textContent = 'No discussions found.';
            containerEl.appendChild(msg);
            return;
          }

          data.data.forEach(function(node) {
            const el = createCommentElement(node, false);
            if (el) containerEl.appendChild(el);
          });

          renderPagination(data.totalNum, page);
        }

        function renderPagination(totalNum, page) {
          const numPerPage = 15;
          const totalPages = Math.ceil(totalNum / numPerPage);

          paginationEl.innerHTML = '';
          if (totalPages <= 1) return;

          const start = Math.max(1, page - 2);
          const end = Math.min(totalPages, start + 4);

          function makePageBtn(label, targetPage, isActive) {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (isActive ? ' active' : '');
            btn.textContent = String(label);
            btn.addEventListener('click', function() { goToPage(targetPage); });
            return btn;
          }

          if (page > 1) paginationEl.appendChild(makePageBtn('Prev', page - 1, false));
          for (let i = start; i <= end; i++) {
            paginationEl.appendChild(makePageBtn(i, i, i === page));
          }
          if (end < totalPages) {
            if (end < totalPages - 1) {
              const ellipsis = document.createElement('span');
              ellipsis.textContent = '...';
              paginationEl.appendChild(ellipsis);
            }
            paginationEl.appendChild(makePageBtn(totalPages, totalPages, false));
          }
          if (page < totalPages) paginationEl.appendChild(makePageBtn('Next', page + 1, false));
        }

        function goToPage(page) {
          currentPage = page;
          loadingEl.style.display = 'block';
          containerEl.innerHTML = '';
          paginationEl.innerHTML = '';
          vscode.postMessage({ command: 'loadPage', page: page, orderBy: currentOrderBy });
          window.scrollTo(0, 0);
        }

        function handleLoadReplies(commentId, skip, btn) {
          const repliesContainer = document.getElementById('replies-' + escHtml(commentId));
          if (!repliesContainer) return;

          if (repliesContainer.style.display === 'block' && skip === 0) {
            repliesContainer.style.display = 'none';
            btn.textContent = btn.dataset.originalText || ('View replies');
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
        }

        function renderReplies(commentId, data, skip) {
          const container = document.getElementById('replies-' + escHtml(commentId));
          if (!container) return;

          if (skip === 0) {
            container.innerHTML = '';
          } else {
            // Remove "Loading more..." placeholder if present
            const placeholder = container.querySelector('.loading-more');
            if (placeholder) placeholder.remove();
          }

          if (data && data.edges) {
            data.edges.forEach(function(edge) {
              const el = createCommentElement(edge.node, true);
              if (el) container.appendChild(el);
            });

            const loaded = skip + data.edges.length;
            if (loaded < data.totalNum) {
              const loadMoreBtn = document.createElement('button');
              loadMoreBtn.className = 'action-btn loading-more';
              loadMoreBtn.style.marginTop = '8px';
              loadMoreBtn.textContent = 'Load more replies (' + (data.totalNum - loaded) + ' remaining)';
              loadMoreBtn.dataset.commentId = commentId;
              loadMoreBtn.dataset.skip = String(loaded);
              loadMoreBtn.addEventListener('click', function() {
                this.textContent = 'Loading...';
                this.disabled = true;
                vscode.postMessage({
                  command: 'loadReplies',
                  commentId: this.dataset.commentId,
                  skip: parseInt(this.dataset.skip, 10),
                });
              });
              container.appendChild(loadMoreBtn);
            }
          } else if (skip === 0) {
            container.innerHTML = '<div class="meta">No replies found.</div>';
          }
        }
      })();
    </script>
</body>
</html>`;
  }
}
