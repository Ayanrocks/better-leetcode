import * as assert from 'assert';
import { TextRenderer } from '../../utils/textRenderer';

suite('TextRenderer Test Suite', () => {
  test('Should handle null or empty content', () => {
    assert.strictEqual(TextRenderer.render(''), '');
    assert.strictEqual(TextRenderer.render(null), '');
    assert.strictEqual(TextRenderer.render(undefined), '');
  });

  test('Should unescape unicode characters (e.g. emojis)', () => {
    // Single unicode escape
    const heart = '\\u2764';
    assert.strictEqual(TextRenderer.render(heart), '<p>❤</p>\n');

    // Surrogate pairs (e.g., 😂 is \\uD83D\\uDE02)
    const joy = '\\uD83D\\uDE02';
    assert.strictEqual(TextRenderer.render(`lol ${joy}`), '<p>lol 😂</p>\n');
  });

  test('Should unescape newlines', () => {
    const text = 'Line 1\\nLine 2';
    assert.strictEqual(TextRenderer.render(text), '<p>Line 1<br>Line 2</p>\n');

    // Multiple new lines
    const multi = 'A\\n\\nB';
    assert.strictEqual(TextRenderer.render(multi), '<p>A</p>\n<p>B</p>\n');
  });

  test('Should handle carriage returns', () => {
    const text = 'Line 1\\r\\nLine 2';
    assert.strictEqual(TextRenderer.render(text), '<p>Line 1<br>Line 2</p>\n');
  });

  test('Should unescape tabs', () => {
    const text = 'A\\tB';
    assert.strictEqual(TextRenderer.render(text), '<p>A\tB</p>\n');
  });

  test('Should unescape quotes', () => {
    const text = '\\"Hello\\"';
    assert.strictEqual(TextRenderer.render(text), '<p>&quot;Hello&quot;</p>\n');

    const single = "\\'Hello\\'";
    assert.strictEqual(TextRenderer.render(single), '<p>&#39;Hello&#39;</p>\n');
  });

  test('Should unescape double slashes', () => {
    const text = '\\\\n'; // represents '\\n' in raw string
    assert.strictEqual(TextRenderer.render(text), '<p>\\n</p>\n');
  });

  test('Should handle complex real-world string', () => {
    const complex =
      'This is absolutely weird Question i have ever seen. \\n\\nThe problem statement create the hype like i phone 17 and the solution is Nokia. \\uD83D\\uDE02';
    const expected =
      '<p>This is absolutely weird Question i have ever seen. </p>\n<p>The problem statement create the hype like i phone 17 and the solution is Nokia. 😂</p>\n';
    assert.strictEqual(TextRenderer.render(complex), expected);
  });

  test('Should render markdown bold, italic, links, images, and lists', () => {
    const md = 'This is **bold** and *italic* and [link](https://leetcode.com) and ![img](https://leetcode.com/logo.png).\\n- Item 1\\n- Item 2';
    const expected =
      '<p>This is <strong>bold</strong> and <em>italic</em> and <a href="https://leetcode.com">link</a> and <img src="https://leetcode.com/logo.png" alt="img">.</p>\n' +
      '<ul>\n' +
      '<li>Item 1</li>\n' +
      '<li>Item 2</li>\n' +
      '</ul>\n';
    assert.strictEqual(TextRenderer.render(md), expected);
  });

  test('Should render markdown code blocks', () => {
    const codeBlock = 'Here is a block:\\n\`\`\`javascript\\nconst a = 1;\\nconsole.log(a);\\n\`\`\`';
    const expected =
      '<p>Here is a block:</p>\n' +
      '<pre><code class="language-javascript">const a = 1;\n' +
      'console.log(a);\n' +
      '</code></pre>\n';
    assert.strictEqual(TextRenderer.render(codeBlock), expected);
  });

  test('Should allow safe HTML tags and classes/styles', () => {
    const html = '<div class="custom-class" style="color: red;">Hello <strong>world</strong></div>';
    const expected = '<div class="custom-class" style="color:red;">Hello <strong>world</strong></div>';
    assert.strictEqual(TextRenderer.render(html), expected);
  });

  test('Should sanitize malicious script tag', () => {
    const malicious = 'Safe text <script>alert("XSS")</script> and safe <iframe src="https://leetcode.com/problem"></iframe>';
    const expected = '<p>Safe text &lt;script&gt;alert("XSS")&lt;/script&gt; and safe <iframe src="https://leetcode.com/problem"></iframe></p>\n';
    assert.strictEqual(TextRenderer.render(malicious), expected);
  });

  test('Should block dangerous iframe source but allow LeetCode iframe', () => {
    const iframeCode = '<iframe src="https://malicious-site.com/steal-cookie"></iframe><iframe src="https://leetcode.com/solution-iframe"></iframe>';
    const expected = '<iframe></iframe><iframe src="https://leetcode.com/solution-iframe"></iframe>';
    assert.strictEqual(TextRenderer.render(iframeCode), expected);
  });

  test('Should render LaTeX math blocks using KaTeX', () => {
    const latexText = 'Using binomial sum: $\\binom{k}{1} + \\binom{k}{3} \\dots = 2^{k-1}$ and block math $$a < b$$';
    const result = TextRenderer.render(latexText);
    assert.ok(result.includes('class="katex"'), 'Should contain inline KaTeX rendering');
    assert.ok(result.includes('class="katex-display"'), 'Should contain block KaTeX rendering');
    assert.ok(result.includes('binom'), 'Should contain original formula elements');
  });
});
