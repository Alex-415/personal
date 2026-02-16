/**
 * Concurrency Tests for Booking Service
 * 
 * These tests verify that the booking service correctly handles
 * concurrent requests and prevents double-booking (race conditions).
 * 
 * Run with: npm run test:concurrency
 */

const { PrismaClient } = require('@prisma/client');
const RedisLock = require('../src/lib/RedisLock');
const BookingService = require('../src/services/BookingService');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://booking:booking123@localhost:5432/booking_db';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let bookingService;
let prisma;

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Setup test environment
 */
beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  bookingService = new BookingService(DATABASE_URL, REDIS_URL);
  
  await prisma.$connect();
  await bookingService.initialize();
  
  // Clean up any existing test data
  await prisma.booking.deleteMany({ where: { userId: 'test-user-concurrency' } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'test-concurrency-' } } });
}, 30000);

/**
 * Cleanup after tests
 */
afterAll(async () => {
  if (bookingService) {
    await bookingService.shutdown();
  }
  if (prisma) {
    await prisma.$disconnect();
  }
}, 30000);

/**
 * TEST 1: Simultaneous booking requests for the same time slot
 * 
 * This test simulates multiple users trying to book the EXACT same time slot
 * at the exact same moment. Only ONE should succeed.
 */
describe('Concurrency Tests', () => {
  
  test('should prevent double-booking when multiple requests arrive simultaneously', async () => {
    const userId = 'test-user-concurrency';
    const startTime = new Date(Date.now() + 60000); // 1 minute from now
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes
    
    const results = [];
    const errors = [];
    
    // Create 10 simultaneous booking requests for the same time slot
    const bookingPromises = Array.from({ length: 10 }).map(async (_, i) => {
      try {
        const idempotencyKey = `concurrent-test-${uuidv4()}`;
        
        const booking = await bookingService.createBooking(
          {
            userId,
            startTime,
            endTime,
            metadata: { title: `Concurrent Test Booking ${i}` },
          },
          idempotencyKey
        );
        
        results.push({ success: true, booking, index: i });
      } catch (error) {
        errors.push({ success: false, error: error.message, code: error.code, index: i });
        results.push({ success: false, error, index: i });
      }
    });
    
    // Execute all promises simultaneously
    await Promise.allSettled(bookingPromises);
    
    // Verify results
    const successfulBookings = results.filter(r => r.success);
    const failedBookings = results.filter(r => !r.success);
    
    console.log(`\n=== Concurrent Booking Test Results ===`);
    console.log(`Total requests: ${results.length}`);
    console.log(`Successful: ${successfulBookings.length}`);
    console.log(`Failed (expected): ${failedBookings.length}`);
    
    // ASSERTIONS
    expect(successfulBookings.length).toBe(1); // ONLY ONE should succeed
    expect(failedBookings.length).toBe(9); // Rest should fail
    
    // Verify the successful booking
    expect(successfulBookings[0].booking).toBeDefined();
    expect(successfulBookings[0].booking.userId).toBe(userId);
    
    // Verify failed requests have appropriate error codes
    failedBookings.forEach(failure => {
      expect(['TIME_SLOT_CONFLICT', 'OVERLAP_CONFLICT', 'LOCK_CONFLICT'])
        .toContain(failure.error?.code || failure.code);
    });
    
    // Verify only one booking exists in database
    const bookingsInDb = await prisma.booking.findMany({
      where: { userId },
    });
    
    expect(bookingsInDb.length).toBe(1);
  }, 30000);

  /**
   * TEST 2: Idempotency - Same request twice should return same result
   */
  test('should return same booking for duplicate idempotency key', async () => {
    const userId = `test-user-idempotent-${uuidv4()}`;
    const startTime = new Date(Date.now() + 120000);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    const idempotencyKey = `idempotent-test-${uuidv4()}`;
    
    // First request
    const booking1 = await bookingService.createBooking(
      {
        userId,
        startTime,
        endTime,
        metadata: { title: 'Idempotency Test' },
      },
      idempotencyKey
    );
    
    // Second request with SAME idempotency key
    const booking2 = await bookingService.createBooking(
      {
        userId,
        startTime,
        endTime,
        metadata: { title: 'Idempotency Test Duplicate' }, // Different data
      },
      idempotencyKey
    );
    
    // Should return the SAME booking (not create a new one)
    expect(booking1.id).toBe(booking2.id);
    expect(booking1.idempotencyKey).toBe(idempotencyKey);
    
    // Verify only one booking exists
    const bookingsInDb = await prisma.booking.findMany({
      where: { idempotencyKey },
    });
    
    expect(bookingsInDb.length).toBe(1);
  }, 15000);

  /**
   * TEST 3: Overlapping time slots should be rejected
   */
  test('should reject bookings that overlap with existing bookings', async () => {
    const userId = `test-user-overlap-${uuidv4()}`;
    const baseTime = new Date(Date.now() + 180000);
    
    // Create initial booking: 2:00 PM - 2:30 PM
    const booking1 = await bookingService.createBooking(
      {
        userId,
        startTime: baseTime,
        endTime: new Date(baseTime.getTime() + 30 * 60 * 1000),
        metadata: { title: 'Original Booking' },
      },
      `overlap-test-1-${uuidv4()}`
    );
    
    // Try to create overlapping bookings
    const overlappingScenarios = [
      {
        // Completely overlaps
        startTime: baseTime,
        endTime: new Date(baseTime.getTime() + 30 * 60 * 1000),
        description: 'Exact same time',
      },
      {
        // Partially overlaps (starts before, ends during)
        startTime: new Date(baseTime.getTime() - 15 * 60 * 1000),
        endTime: new Date(baseTime.getTime() + 15 * 60 * 1000),
        description: 'Partial overlap (start)',
      },
      {
        // Partially overlaps (starts during, ends after)
        startTime: new Date(baseTime.getTime() + 15 * 60 * 1000),
        endTime: new Date(baseTime.getTime() + 45 * 60 * 1000),
        description: 'Partial overlap (end)',
      },
      {
        // Completely contained
        startTime: new Date(baseTime.getTime() + 5 * 60 * 1000),
        endTime: new Date(baseTime.getTime() + 25 * 60 * 1000),
        description: 'Contained within',
      },
    ];
    
    for (const scenario of overlappingScenarios) {
      await expect(
        bookingService.createBooking(
          {
            userId,
            startTime: scenario.startTime,
            endTime: scenario.endTime,
            metadata: { title: scenario.description },
          },
          `overlap-test-${uuidv4()}`
        )
      ).rejects.toThrow();
    }
    
    // Non-overlapping booking should succeed
    const nonOverlapping = await bookingService.createBooking(
      {
        userId,
        startTime: new Date(baseTime.getTime() + 30 * 60 * 1000), // Starts right after
        endTime: new Date(baseTime.getTime() + 60 * 60 * 1000),
        metadata: { title: 'Non-overlapping' },
      },
      `overlap-test-ok-${uuidv4()}`
    );
    
    expect(nonOverlapping).toBeDefined();
    
    // Verify we have exactly 2 bookings
    const bookingsInDb = await prisma.booking.findMany({
      where: { userId },
    });
    
    expect(bookingsInDb.length).toBe(2);
  }, 20000);

  /**
   * TEST 4: Cancel and reschedule should be atomic
   */
  test('should handle cancel and reschedule atomically', async () => {
    const userId = `test-user-atomic-${uuidv4()}`;
    const startTime = new Date(Date.now() + 240000);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    
    // Create booking
    const booking = await bookingService.createBooking(
      {
        userId,
        startTime,
        endTime,
        metadata: { title: 'Atomic Test' },
      },
      `atomic-test-${uuidv4()}`
    );
    
    // Cancel the booking
    const cancelled = await bookingService.cancelBooking(
      booking.id,
      userId,
      'Test cancellation'
    );
    
    expect(cancelled.status).toBe('CANCELLED');
    
    // Try to cancel again (should fail)
    await expect(
      bookingService.cancelBooking(booking.id, userId, 'Duplicate cancel')
    ).rejects.toThrow();
    
    // Reschedule the booking
    const newStartTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const newEndTime = new Date(newStartTime.getTime() + 30 * 60 * 1000);
    
    const rescheduled = await bookingService.rescheduleBooking(
      booking.id,
      userId,
      newStartTime,
      newEndTime
    );
    
    expect(rescheduled.startTime.toISOString()).toBe(newStartTime.toISOString());
    expect(rescheduled.endTime.toISOString()).toBe(newEndTime.toISOString());
  }, 20000);

  /**
   * TEST 5: Distributed lock prevents concurrent access
   */
  test('should acquire and release distributed locks correctly', async () => {
    const redisLock = new RedisLock(REDIS_URL);
    await redisLock.connect();
    
    const resourceKey = `test-lock-${uuidv4()}`;
    
    // Acquire lock
    const lock1 = await redisLock.acquire(resourceKey, 5000);
    expect(lock1).toBeDefined();
    expect(lock1.released).toBe(false);
    
    // Try to acquire same lock (should fail)
    const lock2 = await redisLock.acquire(resourceKey, 5000);
    expect(lock2).toBeNull(); // Should return null when lock is held
    
    // Release first lock
    await lock1.release();
    expect(lock1.released).toBe(true);
    
    // Now should be able to acquire
    const lock3 = await redisLock.acquire(resourceKey, 5000);
    expect(lock3).toBeDefined();
    
    await lock3.release();
    await redisLock.disconnect();
  }, 10000);

  /**
   * TEST 6: High-load concurrent booking stress test
   */
  test('should handle high-load concurrent booking requests', async () => {
    const userId = `test-user-stress-${uuidv4()}`;
    const results = [];
    
    // Create 50 booking requests for DIFFERENT time slots
    const bookingPromises = Array.from({ length: 50 }).map(async (_, i) => {
      try {
        const startTime = new Date(Date.now() + 300000 + (i * 60 * 60 * 1000)); // Each 1 hour apart
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        
        const booking = await bookingService.createBooking(
          {
            userId,
            startTime,
            endTime,
            metadata: { title: `Stress Test Booking ${i}` },
          },
          `stress-test-${uuidv4()}`
        );
        
        results.push({ success: true, booking, index: i });
      } catch (error) {
        results.push({ success: false, error: error.message, index: i });
      }
    });
    
    // Execute all simultaneously
    await Promise.allSettled(bookingPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n=== Stress Test Results ===`);
    console.log(`Total requests: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    // All should succeed since they're for different time slots
    expect(successful.length).toBe(50);
    expect(failed.length).toBe(0);
    
    // Verify all bookings exist in database
    const bookingsInDb = await prisma.booking.findMany({
      where: { userId },
    });
    
    expect(bookingsInDb.length).toBe(50);
  }, 60000);
});

/**
 * Utility: Print test summary
 */
afterAll(() => {
  console.log('\n=== Concurrency Test Suite Complete ===\n');
});
