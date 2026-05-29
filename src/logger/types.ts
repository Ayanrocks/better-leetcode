/**
 * Severity levels for log entries.
 * Numeric values determine filtering priority — only messages at or above
 * the configured level are emitted.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Maps a string representation of a log level to its enum value.
 * Used to parse the VS Code configuration setting.
 *
 * @param value - The lowercase string from settings (e.g., "debug", "info").
 * @returns The corresponding LogLevel, defaulting to INFO for unknown values.
 */
export function parseLogLevel(value: string): LogLevel {
  switch (value.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Returns the human-readable label for a LogLevel.
 *
 * @param level - The LogLevel enum value.
 * @returns Uppercase label string (e.g., "DEBUG", "INFO").
 */
export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
  }
}

/** Configuration for the file-based log sink with rotation. */
export interface FileLogConfig {
  /** Absolute path to the log directory (e.g., ~/.better-leetcode/logs/). */
  logDir: string;
  /** Base name for log files (e.g., "app" → app.log, app.1.log). */
  baseFileName: string;
  /** Maximum size of a single log file in bytes before rotation. */
  maxFileSize: number;
  /** Maximum number of rotated files to retain (excluding the active file). */
  maxFiles: number;
}

/** Options for creating the Logger instance. */
export interface LoggerOptions {
  /** Minimum log level to emit. Messages below this level are suppressed. */
  level: LogLevel;
  /** File rotation configuration. */
  fileConfig: FileLogConfig;
  /**
   * Regex patterns for redacting sensitive data in log output.
   * Each pattern's first capture group (if present) is replaced with '***'.
   */
  redactPatterns: RegExp[];
}
