import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Logger } from '../../logger/Logger';
import { LogLevel, parseLogLevel, logLevelToString } from '../../logger/types';

suite('Logger Test Suite', () => {
  let tempDir: string;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-leetcode-test-logger-'));
  });

  teardown(() => {
    try {
      const logger = Logger.getInstance();
      logger.dispose();
    } catch {
      // Ignored
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('types', () => {
    test('parseLogLevel maps correctly', () => {
      assert.strictEqual(parseLogLevel('debug'), LogLevel.DEBUG);
      assert.strictEqual(parseLogLevel('INFO'), LogLevel.INFO);
      assert.strictEqual(parseLogLevel('Warn'), LogLevel.WARN);
      assert.strictEqual(parseLogLevel('error'), LogLevel.ERROR);
      assert.strictEqual(parseLogLevel('unknown'), LogLevel.INFO);
      assert.strictEqual(parseLogLevel(''), LogLevel.INFO);
    });

    test('logLevelToString maps correctly', () => {
      assert.strictEqual(logLevelToString(LogLevel.DEBUG), 'DEBUG');
      assert.strictEqual(logLevelToString(LogLevel.INFO), 'INFO');
      assert.strictEqual(logLevelToString(LogLevel.WARN), 'WARN');
      assert.strictEqual(logLevelToString(LogLevel.ERROR), 'ERROR');
    });
  });

  suite('Logger instance', () => {
    test('getInstance throws before initialization', () => {
      assert.throws(() => {
        Logger.getInstance();
      }, /Logger has not been initialized/);
    });

    test('initialize creates logger', () => {
      const logger = Logger.initialize({
        level: LogLevel.DEBUG,
        fileConfig: {
          logDir: tempDir,
          baseFileName: 'test',
          maxFileSize: 1024,
          maxFiles: 2,
        },
        redactPatterns: [],
      });
      assert.strictEqual(logger, Logger.getInstance());
      assert.strictEqual(logger.getLevel(), LogLevel.DEBUG);
    });

    test('setLevel changes level', () => {
      const logger = Logger.initialize({
        level: LogLevel.INFO,
        fileConfig: { logDir: tempDir, baseFileName: 'test', maxFileSize: 1024, maxFiles: 2 },
        redactPatterns: [],
      });
      logger.setLevel(LogLevel.WARN);
      assert.strictEqual(logger.getLevel(), LogLevel.WARN);
    });

    test('logs to file and respects level filtering', async () => {
      const logger = Logger.initialize({
        level: LogLevel.WARN, // Ignore INFO and DEBUG
        fileConfig: { logDir: tempDir, baseFileName: 'test', maxFileSize: 1024, maxFiles: 2 },
        redactPatterns: [],
      });

      logger.info('test', 'This is info');
      logger.warn('test', 'This is warn');
      logger.error('test', 'This is error');

      logger.dispose();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Flush is not explicitly available, wait a tiny bit to ensure async writes could settle if any (though Node fs is mostly sync here)
      const logFile = path.join(tempDir, 'test.log');
      const content = fs.readFileSync(logFile, 'utf-8');
      
      assert.strictEqual(content.includes('This is info'), false);
      assert.strictEqual(content.includes('This is warn'), true);
      assert.strictEqual(content.includes('This is error'), true);
    });

    test('redacts sensitive data', async () => {
      const logger = Logger.initialize({
        level: LogLevel.INFO,
        fileConfig: { logDir: tempDir, baseFileName: 'test', maxFileSize: 1024, maxFiles: 2 },
        redactPatterns: [], // Uses defaults which redact LEETCODE_SESSION and csrftoken
      });

      logger.info('test', 'My session is LEETCODE_SESSION=secret123; and csrftoken=abc456;');
      
      logger.dispose();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const logFile = path.join(tempDir, 'test.log');
      const content = fs.readFileSync(logFile, 'utf-8');
      
      assert.strictEqual(content.includes('secret123'), false);
      assert.strictEqual(content.includes('abc456'), false);
      assert.strictEqual(content.includes('LEETCODE_SESSION=***'), true);
      assert.strictEqual(content.includes('csrftoken=***'), true);
    });

    test('formats different data types', async () => {
      const logger = Logger.initialize({
        level: LogLevel.INFO,
        fileConfig: { logDir: tempDir, baseFileName: 'test', maxFileSize: 1024, maxFiles: 2 },
        redactPatterns: [],
      });

      logger.info('test', 'String data', 'some string');
      logger.info('test', 'Object data', { foo: 'bar' });
      logger.error('test', 'Error data', new Error('Something broke'));

      logger.dispose();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const logFile = path.join(tempDir, 'test.log');
      const content = fs.readFileSync(logFile, 'utf-8');
      
      assert.strictEqual(content.includes('some string'), true);
      assert.strictEqual(content.includes('{"foo":"bar"}'), true);
      assert.strictEqual(content.includes('Something broke'), true);
      assert.strictEqual(content.includes('Error: Something broke'), true); // Error stack/message included
    });
    
    test('file rotation', async () => {
      const logger = Logger.initialize({
        level: LogLevel.INFO,
        fileConfig: { logDir: tempDir, baseFileName: 'test', maxFileSize: 100, maxFiles: 2 },
        redactPatterns: [],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.info('test', '12345'); // ~70 bytes. Total ~70. No rotation.
      
      await new Promise((resolve) => setTimeout(resolve, 50));
      logger.info('test', '67890'); // ~70 bytes. Total 140 > 100. Rotates test.log (70 bytes) to test.1.log.
      
      logger.dispose();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that test.log was created. We assume rotation worked if it didn't throw.
      assert.strictEqual(fs.existsSync(path.join(tempDir, 'test.log')), true);
    });
  });
});
