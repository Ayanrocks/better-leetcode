import * as assert from 'assert';
import { BoilerplateManager } from '../../leetcode/boilerplate';
import { matchSnapshot } from './snapshot';

suite('BoilerplateManager Test Suite', () => {
  const boilerplateLangs = [
    'golang',
    'java',
    'python3',
    'python',
    'c',
    'cpp',
    'csharp',
    'rust',
    'php',
  ];
  
  const noBoilerplateLangs = [
    'kotlin',
    'swift',
    'ruby',
    'scala',
    'javascript',
    'typescript',
  ];

  test('hasBoilerplate returns true for languages with boilerplate', () => {
    for (const lang of boilerplateLangs) {
      assert.strictEqual(BoilerplateManager.hasBoilerplate(lang), true, `Expected ${lang} to have boilerplate`);
    }
  });

  test('hasBoilerplate returns false for languages without boilerplate', () => {
    for (const lang of noBoilerplateLangs) {
      assert.strictEqual(BoilerplateManager.hasBoilerplate(lang), false, `Expected ${lang} to NOT have boilerplate`);
    }
  });

  test('getConfig returns empty config for unknown language', () => {
    const config = BoilerplateManager.getConfig('unknown_lang');
    assert.strictEqual(config.prefix, '');
    assert.strictEqual(config.suffix, '');
  });

  test('wrapWithBoilerplate wraps correctly', function () {
    const snippet = 'function solution() {}';
    for (const lang of [...boilerplateLangs, ...noBoilerplateLangs]) {
      const wrapped = BoilerplateManager.wrapWithBoilerplate(lang, snippet);
      matchSnapshot(this, wrapped, `wrapWithBoilerplate_${lang}`);
    }
  });

  suite('extractSolutionCode', () => {
    test('Strategy 1: Extracts using originalSnippet matching', () => {
      const fileContent = `
// Some prefix stuff
class Solution {
    public void someMethod() {
        // user code here
    }
}
// Some suffix stuff
`;
      const originalSnippet = `
class Solution {
    public void someMethod() {
        
    }
}
`;
      const extracted = BoilerplateManager.extractSolutionCode('java', fileContent, originalSnippet);
      assert.strictEqual(extracted.includes('class Solution {'), true);
      assert.strictEqual(extracted.includes('// Some prefix stuff'), false);
    });

    test('Strategy 2: Extracts by stripping known prefix', () => {
      const prefix = BoilerplateManager.getConfig('golang').prefix;
      const userCode = `func main() {\n  fmt.Println("test")\n}`;
      const fileContent = prefix + userCode;
      
      const extracted = BoilerplateManager.extractSolutionCode('golang', fileContent);
      assert.strictEqual(extracted.trim(), userCode.trim());
    });

    test('Strategy 3: Fallback to full content', () => {
      const fileContent = `function hello() { return 1; }`;
      const extracted = BoilerplateManager.extractSolutionCode('javascript', fileContent);
      assert.strictEqual(extracted.trim(), fileContent.trim());
    });
  });
});
