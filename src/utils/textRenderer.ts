export class TextRenderer {
  /**
   * Parses and renders raw text from LeetCode APIs.
   * LeetCode's discussion API often returns double-escaped strings containing
   * literal '\\n' for new lines and '\\uXXXX' for emojis/unicode.
   *
   * @param content The raw string from the API
   * @returns Formatted HTML string ready for the webview
   */
  public static render(content: string | null | undefined): string {
    if (content === null || content === undefined || content === '') {
      return '';
    }

    // First HTML-escape the entire content (escape &, <, >, " and ')
    const escaped = content.replace(/[&<>"']/g, (match) => {
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

    return escaped.replace(/\\(u[0-9a-fA-F]{4}|n|r|t|&quot;|&#39;|\\)/g, (match, code: string) => {
      if (code.startsWith('u')) {
        return String.fromCharCode(parseInt(code.substring(1), 16));
      }
      switch (code) {
        case 'n':
          return '<br/>';
        case 'r':
          return '';
        case 't':
          return '&nbsp;&nbsp;&nbsp;&nbsp;';
        case '&quot;':
          return '&quot;';
        case '&#39;':
          return '&#39;';
        case '\\':
          return '\\';
        default:
          return match;
      }
    });
  }
}
