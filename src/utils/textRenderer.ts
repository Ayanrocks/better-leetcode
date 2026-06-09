export class TextRenderer {
  /**
   * Parses and renders raw text from LeetCode APIs.
   * LeetCode's discussion API often returns double-escaped strings containing 
   * literal '\\n' for new lines and '\\uXXXX' for emojis/unicode.
   * 
   * @param content The raw string from the API
   * @returns Formatted HTML string ready for the webview
   */
  public static render(content: string): string {
    if (!content) return '';

    return content.replace(/\\(u[0-9a-fA-F]{4}|n|r|t|"|'|\\)/g, (match, code: string) => {
      if (code.startsWith('u')) {
        return String.fromCharCode(parseInt(code.substring(1), 16));
      }
      switch (code) {
        case 'n': return '<br/>';
        case 'r': return '';
        case 't': return '&nbsp;&nbsp;&nbsp;&nbsp;';
        case '"': return '"';
        case "'": return "'";
        case '\\': return '\\';
        default: return match;
      }
    });
  }
}
