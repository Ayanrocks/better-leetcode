/* eslint-disable no-console */
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Bootstraps and executes the VS Code extension integration test suite.
 */
async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to run tests: ${message}`);
    process.exit(1);
  }
}

void main();
