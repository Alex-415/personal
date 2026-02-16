/**
 * Fastify API Server
 * 
 * Production-ready REST API for the Booking Service
 * with proper error handling, validation, and security.
 */

require('dotenv').config();

const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const rateLimit = require('@fastify/rate-limit');
const fastifyStatic = require('@fastify/static');
const { v4: uuidv4 } = require('uuid');
const BookingService = require('./services/BookingService');
const logger = require('./utils/logger');
const {
  CreateBookingWithTimeValidation,
  CancelBookingSchema,
  RescheduleBookingSchema,
  GetSlotsSchema,
  ListBookingsQuerySchema,
} = require('./utils/validators');

// Initialize booking service
const bookingService = new BookingService(
  process.env.DATABASE_URL,
  process.env.REDIS_URL
);

// ============================================================================
// PLUGINS
// ============================================================================

// CORS
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Correlation-ID'],
  credentials: true,
});

// Security headers (Helmet)
fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
});

// Rate limiting
fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  },
});

// Serve static files (UI dashboard)
fastify.register(fastifyStatic, {
  root: require('path').join(__dirname, '../public'),
  prefix: '/',
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Add correlation ID to all requests
fastify.addHook('onRequest', async (request, reply) => {
  const correlationId = request.headers['x-correlation-id'] || uuidv4();
  request.correlationId = correlationId;
  request.log = logger.childWithCorrelation(correlationId);
  
  reply.header('X-Correlation-ID', correlationId);
});

// Request logging
fastify.addHook('onRequest', async (request, reply) => {
  request.log.info(
    { method: request.method, url: request.url },
    'Incoming request'
  );
});

// Response logging
fastify.addHook('onResponse', async (request, reply) => {
  request.log.info(
    { statusCode: reply.statusCode, responseTime: reply.getResponseTime() },
    'Request completed'
  );
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check
fastify.get('/health', async (request, reply) => {
  const health = await bookingService.healthCheck();
  reply.status(health.status === 'healthy' ? 200 : 503).send(health);
});

// Metrics endpoint (for Prometheus)
fastify.get('/metrics', async (request, reply) => {
  reply.type('text/plain');
  return `# HELP booking_service_up Booking service status
# TYPE booking_service_up gauge
booking_service_up 1
# HELP booking_service_version Booking service version
# TYPE booking_service_version gauge
booking_service_version 1
`;
});

/**
 * POST /api/bookings
 * Create a new booking
 */
fastify.post('/api/bookings', async (request, reply) => {
  try {
    // Validate request body
    const validationResult = CreateBookingWithTimeValidation.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const bookingData = validationResult.data;
    
    // Get or generate idempotency key
    const idempotencyKey = request.headers['x-idempotency-key'] || uuidv4();

    const booking = await bookingService.createBooking(bookingData, idempotencyKey);

    reply.status(201).header('X-Idempotency-Key', idempotencyKey).send({
      success: true,
      data: booking,
    });

  } catch (error) {
    request.log.error({ error: error.message, stack: error.stack }, 'Error creating booking');
    
    if (error.code === 'TIME_SLOT_CONFLICT' || error.code === 'OVERLAP_CONFLICT') {
      return reply.status(409).send({
        error: 'Booking conflict',
        message: error.message,
        code: error.code,
      });
    }

    if (error.code === 'LOCK_CONFLICT') {
      return reply.status(409).send({
        error: 'Conflict',
        message: error.message,
        code: error.code,
      });
    }

    reply.status(500).send({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    });
  }
});

/**
 * GET /api/bookings/:id
 * Get booking by ID
 */
fastify.get('/api/bookings/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const booking = await bookingService.getBooking(id);

    if (!booking) {
      return reply.status(404).send({
        error: 'Not found',
        message: 'Booking not found',
      });
    }

    reply.send({
      success: true,
      data: booking,
    });

  } catch (error) {
    request.log.error({ error: error.message }, 'Error getting booking');
    reply.status(500).send({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:userId/bookings
 * Get bookings for a user
 */
fastify.get('/api/users/:userId/bookings', async (request, reply) => {
  try {
    // Validate query params
    const validationResult = ListBookingsQuerySchema.safeParse(request.query);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { userId } = request.params;
    const options = validationResult.data;

    const result = await bookingService.getUserBookings(userId, options);

    reply.send({
      success: true,
      data: result.bookings,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });

  } catch (error) {
    request.log.error({ error: error.message }, 'Error getting user bookings');
    reply.status(500).send({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:userId/slots
 * Get available time slots for a user
 */
fastify.get('/api/users/:userId/slots', async (request, reply) => {
  try {
    // Validate query params
    const validationResult = GetSlotsSchema.safeParse(request.query);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { userId, startDate, endDate, slotDuration } = validationResult.data;

    const slots = await bookingService.getAvailableSlots(
      userId,
      new Date(startDate),
      new Date(endDate),
      slotDuration
    );

    reply.send({
      success: true,
      data: slots,
      count: slots.length,
    });

  } catch (error) {
    request.log.error({ error: error.message }, 'Error getting available slots');
    reply.status(500).send({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking
 */
fastify.post('/api/bookings/:id/cancel', async (request, reply) => {
  try {
    const { id } = request.params;
    
    // Validate request body
    const validationResult = CancelBookingSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    // In production, get userId from JWT token
    const userId = request.headers['x-user-id'] || request.body.userId;
    
    if (!userId) {
      return reply.status(400).send({
        error: 'Missing user ID',
        message: 'User ID must be provided via X-User-ID header or in body',
      });
    }

    const booking = await bookingService.cancelBooking(
      id,
      userId,
      validationResult.data.reason
    );

    reply.send({
      success: true,
      data: booking,
    });

  } catch (error) {
    request.log.error({ error: error.message }, 'Error cancelling booking');
    
    if (error.code === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'Not found', message: error.message });
    }
    
    if (error.code === 'UNAUTHORIZED' || error.code === 'ALREADY_CANCELLED') {
      return reply.status(400).send({ error: error.message });
    }

    reply.status(500).send({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings/:id/reschedule
 * Reschedule a booking
 */
fastify.post('/api/bookings/:id/reschedule', async (request, reply) => {
  try {
    const { id } = request.params;
    
    // Validate request body
    const validationResult = RescheduleBookingSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    // In production, get userId from JWT token
    const userId = request.headers['x-user-id'] || request.body.userId;
    
    if (!userId) {
      return reply.status(400).send({
        error: 'Missing user ID',
      });
    }

    const booking = await bookingService.rescheduleBooking(
      id,
      userId,
      new Date(validationResult.data.startTime),
      new Date(validationResult.data.endTime)
    );

    reply.send({
      success: true,
      data: booking,
    });

  } catch (error) {
    request.log.error({ error: error.message }, 'Error rescheduling booking');
    
    if (error.code === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'Not found', message: error.message });
    }
    
    if (error.code === 'TIME_SLOT_CONFLICT') {
      return reply.status(409).send({
        error: 'Conflict',
        message: error.message,
      });
    }

    reply.status(500).send({ error: 'Internal server error' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ error: error.message, stack: error.stack }, 'Unhandled error');

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'development' 
    ? error.message 
    : 'An unexpected error occurred';

  reply.status(error.statusCode || 500).send({
    error: error.name || 'Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: 'Not found',
    message: `Route ${request.method} ${request.url} not found`,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const start = async () => {
  try {
    // Initialize booking service
    await bookingService.initialize();
    
    const port = parseInt(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    logger.info(`Booking service listening on http://${host}:${port}`);
    logger.info(`Health check: http://${host}:${port}/health`);
    logger.info(`API docs: http://${host}:${port}/documentation`);
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start server');
    await bookingService.shutdown();
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await fastify.close();
    await bookingService.shutdown();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

start();
