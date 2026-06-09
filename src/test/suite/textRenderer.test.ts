import * as assert from 'assert';
import { TextRenderer } from '../../utils/textRenderer';

suite('TextRenderer Test Suite', () => {
  test('Should handle null or empty content', () => {
    assert.strictEqual(TextRenderer.render(''), '');
    assert.strictEqual(TextRenderer.render(null as any), '');
  });

  test('Should unescape unicode characters (e.g. emojis)', () => {
    // Single unicode escape
    const heart = '\\u2764';
    assert.strictEqual(TextRenderer.render(heart), '❤');

    // Surrogate pairs (e.g., 😂 is \\uD83D\\uDE02)
    const joy = '\\uD83D\\uDE02';
    assert.strictEqual(TextRenderer.render(`lol ${joy}`), 'lol 😂');
  });

  test('Should unescape newlines', () => {
    const text = 'Line 1\\nLine 2';
    assert.strictEqual(TextRenderer.render(text), 'Line 1<br/>Line 2');
    
    // Multiple new lines
    const multi = 'A\\n\\nB';
    assert.strictEqual(TextRenderer.render(multi), 'A<br/><br/>B');
  });

  test('Should handle carriage returns', () => {
    const text = 'Line 1\\r\\nLine 2';
    assert.strictEqual(TextRenderer.render(text), 'Line 1<br/>Line 2');
  });

  test('Should unescape tabs', () => {
    const text = 'A\\tB';
    assert.strictEqual(TextRenderer.render(text), 'A&nbsp;&nbsp;&nbsp;&nbsp;B');
  });

  test('Should unescape quotes', () => {
    const text = '\\"Hello\\"';
    assert.strictEqual(TextRenderer.render(text), '"Hello"');
    
    const single = "\\'Hello\\'";
    assert.strictEqual(TextRenderer.render(single), "'Hello'");
  });

  test('Should unescape double slashes', () => {
    const text = '\\\\n'; // represents '\\n' in raw string
    assert.strictEqual(TextRenderer.render(text), '\\n');
  });

  test('Should handle complex real-world string', () => {
    const complex = 'This is absolutely weird Question i have ever seen. \\n\\nThe problem statement create the hype like i phone 17 and the solution is Nokia. \\uD83D\\uDE02';
    const expected = 'This is absolutely weird Question i have ever seen. <br/><br/>The problem statement create the hype like i phone 17 and the solution is Nokia. 😂';
    assert.strictEqual(TextRenderer.render(complex), expected);
  });
});
