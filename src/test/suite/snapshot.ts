import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

/**
 * A lightweight snapshot testing utility for Mocha tests.
 * Writes actual outputs to a .snap file and compares them on subsequent runs.
 */
export function matchSnapshot(
  testContext: Mocha.Context | undefined,
  actual: string,
  snapshotName: string,
): void {
  if (!testContext || !testContext.test || !testContext.test.file) {
    throw new Error('matchSnapshot must be called within a Mocha test block with context.');
  }

  const testFile = testContext.test.file;
  const snapDir = path.join(path.dirname(testFile), '__snapshots__');
  const snapFile = path.join(snapDir, path.basename(testFile) + '.snap');

  if (!fs.existsSync(snapDir)) {
    fs.mkdirSync(snapDir, { recursive: true });
  }

  let snapshots: Record<string, string> = {};
  if (fs.existsSync(snapFile)) {
    try {
      snapshots = JSON.parse(fs.readFileSync(snapFile, 'utf-8'));
    } catch {
      // Ignore parse errors, just overwrite
    }
  }

  const testTitle = testContext.test.fullTitle();
  const key = `${testTitle} - ${snapshotName}`;

  // If running with UPDATE_SNAPSHOTS env var, or if snapshot doesn't exist, update it
  if (process.env.UPDATE_SNAPSHOTS || !snapshots[key]) {
    snapshots[key] = actual;
    fs.writeFileSync(snapFile, JSON.stringify(snapshots, null, 2), 'utf-8');
    return; // Pass
  }

  // Otherwise compare
  const expected = snapshots[key];
  assert.strictEqual(actual, expected, `Snapshot mismatch for "${key}"`);
}
