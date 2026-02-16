/**
 * Structured Logger using Pino
 * 
 * Provides JSON-formatted logs with correlation ID support
 * for distributed tracing.
 */

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'booking-service',
    version: process.env.npm_package_version || '1.0.0',
  },
});

/**
 * Create a child logger with correlation ID
 * @param {string} correlationId - Unique request ID
 */
logger.childWithCorrelation = function(correlationId) {
  return this.child({ correlationId });
};

module.exports = logger;
