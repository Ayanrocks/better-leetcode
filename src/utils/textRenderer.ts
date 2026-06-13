import { marked } from 'marked';
import xss = require('xss');
import katex from 'katex';

// Initialize the XSS filter once
const whiteList = xss.getDefaultWhiteList();
for (const tag in whiteList) {
  if (Object.prototype.hasOwnProperty.call(whiteList, tag)) {
    const attrs = whiteList[tag];
    if (attrs) {
      if (!attrs.includes('class')) {
        attrs.push('class');
      }
      if (!attrs.includes('style')) {
        attrs.push('style');
      }
    }
  }
}

// Add custom iframe whitelist for safe LeetCode iframes
whiteList.iframe = ['src', 'width', 'height', 'frameborder', 'style', 'class', 'allow'];

const xssFilter = new xss.FilterXSS({
  whiteList,
  onTagAttr: (tag: string, name: string, value: string): string | undefined => {
    if (tag === 'iframe' && name === 'src') {
      const isLeetCode = /^(https?:)?\/\/(.+\.)?leetcode\.(com|cn)\//i.test(value);
      if (!isLeetCode) {
        return ''; // block iframe from non-LeetCode sources
      }
    }
    return undefined; // use default behavior
  },
});

/**
 * Utility class for parsing and rendering text from LeetCode.
 * Handles decoding double-escaped sequences, processing math blocks (LaTeX) via KaTeX,
 * converting markdown to HTML, and sanitizing the HTML output to prevent XSS.
 */
export class TextRenderer {
  /**
   * Parses and renders raw text from LeetCode APIs.
   * LeetCode's API often returns double-escaped strings containing
   * literal '\\n' for new lines and '\\uXXXX' for emojis/unicode.
   *
   * @param content The raw string from the API
   * @returns Formatted HTML string ready for the webview
   */
  public static render(content: string | null | undefined): string {
    if (content === null || content === undefined || content === '') {
      return '';
    }

    // 1. Decode double-escaped characters (e.g. \\n to \n, \\uXXXX to unicode)
    // to allow marked to parse standard markdown blocks (like code blocks, lists) correctly.
    const decoded = content.replace(/\\(u[0-9a-fA-F]{4}|n|r|t|["'\\/])/g, (match, p1: string) => {
      if (p1.startsWith('u')) {
        return String.fromCharCode(parseInt(p1.substring(1), 16));
      }
      switch (p1) {
        case 'n':
          return '\n';
        case 'r':
          return '\r';
        case 't':
          return '\t';
        case '"':
          return '"';
        case "'":
          return "'";
        case '\\':
          return '\\';
        case '/':
          return '/';
        default:
          return match;
      }
    });

    // 2. Extract math blocks ($...$ and $$...$$) before markdown parsing to protect backslashes.
    const mathBlocks: { content: string; displayMode: boolean }[] = [];
    let tempContent = decoded;

    // Extract block math $$...$$
    tempContent = tempContent.replace(/\$\$([\s\S]+?)\$\$/g, (_match: string, p1: string) => {
      const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
      mathBlocks.push({ content: p1, displayMode: true });
      return placeholder;
    });

    // Extract inline math $...$
    tempContent = tempContent.replace(/\$([^\n$]+?)\$/g, (_match: string, p1: string) => {
      const placeholder = `MATHBLOCKPLACEHOLDER${mathBlocks.length}`;
      mathBlocks.push({ content: p1, displayMode: false });
      return placeholder;
    });

    // 3. Parse markdown to HTML using marked with GFM line breaks enabled
    const html = marked.parse(tempContent, { breaks: true }) as string;

    // 4. Sanitize HTML to prevent XSS vulnerabilities while allowing safe HTML tags
    const sanitizedHtml = xssFilter.process(html);

    // 5. Restore the math blocks (rendered via KaTeX)
    let finalHtml = sanitizedHtml;
    for (let i = 0; i < mathBlocks.length; i++) {
      const placeholder = `MATHBLOCKPLACEHOLDER${i}`;
      const mathObj = mathBlocks[i];
      if (mathObj !== undefined) {
        let renderedMath = '';
        try {
          renderedMath = katex.renderToString(mathObj.content, {
            displayMode: mathObj.displayMode,
            throwOnError: false,
          });
        } catch (e) {
          renderedMath = mathObj.displayMode ? `$$${mathObj.content}$$` : `$${mathObj.content}$`;
        }
        finalHtml = finalHtml.replace(placeholder, () => renderedMath);
      }
    }

    return finalHtml;
  }
}
