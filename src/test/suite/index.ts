import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

/**
 * Runs the integration tests using the Mocha test framework.
 *
 * @returns A promise that resolves if all tests pass, or rejects with an error on failures.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname, '.');

  const files: string[] = [];

  function walkDir(dir: string): void {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.test.js')) {
        files.push(fullPath);
      }
    }
  }

  return new Promise<void>((resolve, reject) => {
    try {
      walkDir(testsRoot);

      // Add files to the test suite
      for (const file of files) {
        mocha.addFile(file);
      }

      // Run the mocha test suite
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err: unknown) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
