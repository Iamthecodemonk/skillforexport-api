/**
 * Professional Logger with environment-based configuration
 * 
 * LOG_LEVEL environment variable (default: 'info'):
 *   - 'silent': No logging
 *   - 'error': Only errors
 *   - 'warn': Errors and warnings
 *   - 'info': Errors, warnings, and info messages (default)
 *   - 'debug': All messages including debug
 * 
 * Usage:
 *   import logger from './utils/logger.js';
 *   logger.info('User registered', { userId: 123 });
 *   logger.error('Database connection failed', { code: 'ECONNREFUSED' });
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Log level hierarchy
const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

// Current level
const CURRENT_LEVEL = LEVELS[LOG_LEVEL] ?? LEVELS.info;

// Color codes for console output (disabled in production)
const COLORS = NODE_ENV === 'production' ? {} : {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m'
};

/**
 * Format timestamp as ISO string
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message with context
 */
function formatMessage(level, prefix, message, data) {
  let output = `[${getTimestamp()}] [${level.toUpperCase()}]`;
  
  if (prefix) {
    output += ` [${prefix}]`;
  }
  
  output += ` ${message}`;
  
  if (data) {
    output += ' ' + JSON.stringify(data);
  }
  
  return output;
}

/**
 * Apply color to message (only in development)
 */
function colorize(message, color) {
  if (!COLORS[color]) {
    return message;
  }
  return `${COLORS[color]}${message}${COLORS.reset}`;
}

/**
 * Log a message at the appropriate level
 */
function log(level, prefix, message, data) {
  // Skip if current level is below this log level
  if (CURRENT_LEVEL < LEVELS[level]) {
    return;
  }

  const formatted = formatMessage(level, prefix, message, data);

  // Use appropriate console method
  switch (level) {
    case 'error':
      console.error(colorize(formatted, 'red'));
      break;
    case 'warn':
      console.warn(colorize(formatted, 'yellow'));
      break;
    case 'info':
      console.log(colorize(formatted, 'cyan'));
      break;
    case 'debug':
      console.log(colorize(formatted, 'gray'));
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Create a logger instance with optional prefix
 */
function createLogger(prefix = null) {
  return {
    /**
     * Log error message
     * @param {string} message - Error message
     * @param {object} data - Optional error data or error object
     */
    error: (message, data) => {
      log('error', prefix, message, data);
    },

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {object} data - Optional warning data
     */
    warn: (message, data) => {
      log('warn', prefix, message, data);
    },

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {object} data - Optional info data
     */
    info: (message, data) => {
      log('info', prefix, message, data);
    },

    /**
     * Log debug message (only logged in debug mode)
     * @param {string} message - Debug message
     * @param {object} data - Optional debug data
     */
    debug: (message, data) => {
      log('debug', prefix, message, data);
    },

    /**
     * Create a child logger with additional prefix
     * @param {string} childPrefix - Prefix for child logger
     * @returns {object} - New logger instance with combined prefix
     */
    child: (childPrefix) => {
      const combinedPrefix = prefix ? `${prefix}:${childPrefix}` : childPrefix;
      return createLogger(combinedPrefix);
    }
  };
}

// Default export: Root logger without prefix
const logger = createLogger('APP');

export default logger;
export { createLogger };
