/**
 * Logger utility for consistent logging across the application
 */
import chalk from 'chalk';

export class Logger {
  constructor(module) {
    this.module = module;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Get current timestamp
   * @private
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   * @private
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const modulePrefix = `[${this.module}]`;
    
    let formattedMessage = `${timestamp} ${modulePrefix} ${level.toUpperCase()}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      formattedMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return formattedMessage;
  }

  /**
   * Check if should log based on level
   * @private
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Log error message
   */
  error(message, error = null, meta = {}) {
    if (!this.shouldLog('error')) return;
    
    const formattedMessage = this.formatMessage('error', message, meta);
    console.error(chalk.red(formattedMessage));
    
    if (error && error.stack) {
      console.error(chalk.red(error.stack));
    }
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    if (!this.shouldLog('warn')) return;
    
    const formattedMessage = this.formatMessage('warn', message, meta);
    console.warn(chalk.yellow(formattedMessage));
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    if (!this.shouldLog('info')) return;
    
    const formattedMessage = this.formatMessage('info', message, meta);
    console.log(chalk.blue(formattedMessage));
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    if (!this.shouldLog('debug')) return;
    
    const formattedMessage = this.formatMessage('debug', message, meta);
    console.log(chalk.gray(formattedMessage));
  }

  /**
   * Log success message
   */
  success(message, meta = {}) {
    if (!this.shouldLog('info')) return;
    
    const formattedMessage = this.formatMessage('success', message, meta);
    console.log(chalk.green(formattedMessage));
  }

  /**
   * Create child logger with additional context
   */
  child(context) {
    const childLogger = new Logger(`${this.module}:${context}`);
    childLogger.logLevel = this.logLevel;
    return childLogger;
  }
}

// Create default logger instance
export const logger = new Logger('App');
