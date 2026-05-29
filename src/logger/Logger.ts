import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogLevel, logLevelToString, FileLogConfig, LoggerOptions } from './types';

/**
 * Default regex patterns for redacting sensitive information from logs.
 * Matches cookie key=value pairs and replaces the value with '***'.
 */
const DEFAULT_REDACT_PATTERNS: RegExp[] = [/LEETCODE_SESSION=[^;,\s]+/g, /csrftoken=[^;,\s]+/g];

/**
 * Dual-sink logger that writes to both a VS Code OutputChannel (for the
 * Output panel) and rotating log files on disk.
 *
 * Usage:
 * ```ts
 * const logger = Logger.getInstance();
 * logger.info('api', 'Fetched problem details for "two-sum"');
 * logger.error('auth', 'Login failed', err);
 * ```
 *
 * The singleton is initialised once via `Logger.initialize()` during
 * extension activation, then accessed everywhere via `Logger.getInstance()`.
 */
export class Logger implements vscode.Disposable {
  private static instance: Logger | undefined;

  private readonly outputChannel: vscode.OutputChannel;
  private readonly fileConfig: FileLogConfig;
  private readonly redactPatterns: RegExp[];
  private level: LogLevel;
  private fileStream: fs.WriteStream | undefined;
  private currentFileSize: number = 0;
  private disposed: boolean = false;

  private constructor(options: LoggerOptions) {
    this.level = options.level;
    this.fileConfig = options.fileConfig;
    this.redactPatterns =
      options.redactPatterns.length > 0 ? options.redactPatterns : DEFAULT_REDACT_PATTERNS;

    this.outputChannel = vscode.window.createOutputChannel('Better LeetCode');
    this.ensureLogDirectory();
    this.openFileStream();
  }

  /**
   * Creates and returns the singleton Logger instance.
   * Must be called exactly once during extension activation.
   *
   * @param options - Logger configuration options.
   * @returns The initialized Logger instance.
   * @throws Error if called more than once.
   */
  public static initialize(options: LoggerOptions): Logger {
    if (Logger.instance !== undefined) {
      Logger.instance.dispose();
    }
    Logger.instance = new Logger(options);
    return Logger.instance;
  }

  /**
   * Returns the singleton Logger instance.
   *
   * @throws Error if `initialize()` has not been called yet.
   */
  public static getInstance(): Logger {
    if (Logger.instance === undefined) {
      throw new Error('Logger has not been initialized. Call Logger.initialize() first.');
    }
    return Logger.instance;
  }

  /**
   * Returns the default log directory path: ~/.better-leetcode/logs/
   */
  public static getDefaultLogDir(): string {
    return path.join(os.homedir(), '.better-leetcode', 'logs');
  }

  /**
   * Updates the minimum log level at runtime.
   * Used when the user changes the `better-leetcode.logLevel` setting.
   *
   * @param level - The new minimum LogLevel.
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Returns the current minimum log level.
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Reveals the Output Channel in the VS Code Output panel.
   * Triggered by the `better-leetcode.showLogs` command.
   */
  public show(): void {
    this.outputChannel.show(true);
  }

  // ── Public log methods ────────────────────────────────────────────

  /**
   * Logs a DEBUG-level message.
   *
   * @param source - Module/component tag (e.g., "api", "auth", "tree").
   * @param message - Human-readable log message.
   * @param data - Optional structured data to append.
   */
  public debug(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, source, message, data);
  }

  /**
   * Logs an INFO-level message.
   *
   * @param source - Module/component tag.
   * @param message - Human-readable log message.
   * @param data - Optional structured data to append.
   */
  public info(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, source, message, data);
  }

  /**
   * Logs a WARN-level message.
   *
   * @param source - Module/component tag.
   * @param message - Human-readable log message.
   * @param data - Optional structured data to append.
   */
  public warn(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, source, message, data);
  }

  /**
   * Logs an ERROR-level message.
   *
   * @param source - Module/component tag.
   * @param message - Human-readable log message.
   * @param data - Optional error object or structured data to append.
   */
  public error(source: string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, source, message, data);
  }

  // ── Disposal ──────────────────────────────────────────────────────

  /**
   * Disposes the logger by closing the file stream and the output channel.
   * Called automatically when the extension deactivates.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.info('logger', 'Logger shutting down');

    if (this.fileStream !== undefined) {
      this.fileStream.end();
      this.fileStream = undefined;
    }

    this.outputChannel.dispose();

    if (Logger.instance === this) {
      Logger.instance = undefined;
    }
  }

  // ── Internal ──────────────────────────────────────────────────────

  /**
   * Core logging method. Formats the message, applies redaction, and
   * writes to both sinks if the message meets the current level threshold.
   */
  private log(level: LogLevel, source: string, message: string, data?: unknown): void {
    if (level < this.level || this.disposed) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = logLevelToString(level);
    let formattedMessage = `[${timestamp}] [${levelStr}] [${source}] ${message}`;

    if (data !== undefined) {
      if (data instanceof Error) {
        formattedMessage += ` | ${data.message}`;
        if (data.stack !== undefined) {
          formattedMessage += `\n${data.stack}`;
        }
      } else if (typeof data === 'string') {
        formattedMessage += ` | ${data}`;
      } else {
        try {
          formattedMessage += ` | ${JSON.stringify(data)}`;
        } catch {
          formattedMessage += ` | [unserializable data]`;
        }
      }
    }

    const redactedMessage = this.redact(formattedMessage);

    // Write to VS Code Output Channel
    this.outputChannel.appendLine(redactedMessage);

    // Write to file
    this.writeToFile(redactedMessage);
  }

  /**
   * Applies redaction patterns to strip sensitive data from log output.
   *
   * @param message - The raw log message.
   * @returns The message with sensitive values replaced by '***'.
   */
  private redact(message: string): string {
    let redacted = message;
    for (const pattern of this.redactPatterns) {
      // Reset lastIndex for global regex patterns
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, (match) => {
        const eqIndex = match.indexOf('=');
        if (eqIndex !== -1) {
          return `${match.substring(0, eqIndex + 1)}***`;
        }
        return '***';
      });
    }
    return redacted;
  }

  /**
   * Creates the log directory if it does not exist.
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.fileConfig.logDir)) {
      fs.mkdirSync(this.fileConfig.logDir, { recursive: true });
    }
  }

  /**
   * Opens (or re-opens) the writable file stream for the active log file.
   * Measures the current file size so rotation triggers accurately.
   */
  private openFileStream(): void {
    const logFilePath = this.getActiveLogPath();

    if (fs.existsSync(logFilePath)) {
      try {
        const stats = fs.statSync(logFilePath);
        this.currentFileSize = stats.size;
      } catch {
        this.currentFileSize = 0;
      }
    } else {
      this.currentFileSize = 0;
    }

    this.fileStream = fs.createWriteStream(logFilePath, {
      flags: 'a',
      encoding: 'utf-8',
    });
  }

  /**
   * Writes a log line to the file sink. Triggers rotation if the active
   * file exceeds `maxFileSize`.
   *
   * @param message - The fully-formatted, redacted log message.
   */
  private writeToFile(message: string): void {
    if (this.fileStream === undefined) {
      return;
    }

    const line = message + '\n';
    const lineBytes = Buffer.byteLength(line, 'utf-8');

    // Check if rotation is needed BEFORE writing
    if (this.currentFileSize + lineBytes > this.fileConfig.maxFileSize) {
      this.rotateFiles();
    }

    this.fileStream.write(line);
    this.currentFileSize += lineBytes;
  }

  /**
   * Rotates log files by shifting each numbered file up by one:
   *   app.4.log → deleted (if maxFiles=5)
   *   app.3.log → app.4.log
   *   app.2.log → app.3.log
   *   app.1.log → app.2.log
   *   app.log   → app.1.log
   * Then opens a fresh app.log for writing.
   */
  private rotateFiles(): void {
    // Close the current stream
    if (this.fileStream !== undefined) {
      this.fileStream.end();
      this.fileStream = undefined;
    }

    const { logDir, baseFileName, maxFiles } = this.fileConfig;

    // Delete the oldest file if it exists
    const oldestPath = path.join(logDir, `${baseFileName}.${maxFiles}.log`);
    if (fs.existsSync(oldestPath)) {
      try {
        fs.unlinkSync(oldestPath);
      } catch {
        // Best-effort deletion — continue with rotation
      }
    }

    // Shift numbered files up: N-1 → N, N-2 → N-1, ..., 1 → 2
    for (let i = maxFiles - 1; i >= 1; i--) {
      const from = path.join(logDir, `${baseFileName}.${i}.log`);
      const to = path.join(logDir, `${baseFileName}.${i + 1}.log`);

      if (fs.existsSync(from)) {
        try {
          fs.renameSync(from, to);
        } catch {
          // Best-effort rename — continue with rotation
        }
      }
    }

    // Move the active log file to .1.log
    const activePath = this.getActiveLogPath();
    const firstRotatedPath = path.join(logDir, `${baseFileName}.1.log`);

    if (fs.existsSync(activePath)) {
      try {
        fs.renameSync(activePath, firstRotatedPath);
      } catch {
        // Best-effort rename — the new stream will overwrite
      }
    }

    // Open a fresh file stream
    this.openFileStream();
  }

  /**
   * Returns the absolute path to the active (non-rotated) log file.
   */
  private getActiveLogPath(): string {
    return path.join(this.fileConfig.logDir, `${this.fileConfig.baseFileName}.log`);
  }
}
