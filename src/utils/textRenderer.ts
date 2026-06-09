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

    let result = content;

    // 1. Unescape unicode sequences (e.g. \uD83D\uDE02 -> 😂)
    result = result.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // 2. Unescape new lines and carriage returns
    // Replacing literal \n with <br/> since this will be injected into HTML
    result = result.replace(/\\n/g, '<br/>');
    result = result.replace(/\\r/g, '');

    // 3. Unescape tabs
    result = result.replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');

    // 4. Unescape quotes and slashes
    result = result.replace(/\\"/g, '"');
    result = result.replace(/\\'/g, "'");
    
    // 5. Unescape double slashes
    result = result.replace(/\\\\/g, '\\');

    return result;
  }
}
