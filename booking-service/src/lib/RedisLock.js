/**
 * Redis Distributed Lock Implementation
 * 
 * Prevents race conditions in distributed systems by ensuring
 * only one process can execute a critical section at a time.
 * 
 * Uses Redis SETNX with automatic expiration (lease-based locking).
 */

const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class RedisLock {
  constructor(redisUrl = 'redis://localhost:6379') {
    this.client = redis.createClient({ url: redisUrl });
    this.instanceId = uuidv4(); // Unique ID for this service instance
    this.defaultTTL = 10000; // 10 seconds default lock TTL
    this.retryInterval = 50; // 50ms between retry attempts
    this.maxRetries = 100; // Max retries before giving up
  }

  async connect() {
    await this.client.connect();
    
    this.client.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis for distributed locking');
    });

    // Handle reconnection
    this.client.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });
  }

  async disconnect() {
    await this.client.quit();
  }

  /**
   * Acquire a distributed lock
   * 
   * @param {string} resourceKey - Unique key for the resource to lock
   * @param {number} ttl - Time-to-live in milliseconds (lease duration)
   * @returns {Promise<LockHandle|null>} - Lock handle if acquired, null if failed
   */
  async acquire(resourceKey, ttl = this.defaultTTL) {
    const lockValue = `${this.instanceId}:${Date.now()}`;
    const lockKey = `lock:${resourceKey}`;
    
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        // SETNX with expiration - atomic operation
        // NX = only set if Not eXists
        const result = await this.client.set(lockKey, lockValue, {
          NX: true,
          PX: ttl,
        });

        if (result === 'OK') {
          logger.debug(`Lock acquired: ${resourceKey} by ${this.instanceId}`);
          
          return new LockHandle(
            this,
            resourceKey,
            lockKey,
            lockValue,
            ttl,
            Date.now() + ttl
          );
        }

        // Lock already held by another process
        retries++;
        
        // Check if lock is held by dead instance (expired)
        const existingTTL = await this.client.pttl(lockKey);
        if (existingTTL === -2) {
          // Key doesn't exist, retry immediately
          continue;
        }
        
        // Wait before retrying
        await this._sleep(this.retryInterval);
        
      } catch (error) {
        logger.error(`Error acquiring lock ${resourceKey}:`, error);
        throw error;
      }
    }

    logger.warn(`Failed to acquire lock after ${this.maxRetries} retries: ${resourceKey}`);
    return null;
  }

  /**
   * Release a distributed lock
   */
  async release(lockKey, lockValue) {
    try {
      // Only release if we own the lock (compare values)
      const currentValue = await this.client.get(lockKey);
      
      if (currentValue === lockValue) {
        await this.client.del(lockKey);
        logger.debug(`Lock released: ${lockKey}`);
        return true;
      }
      
      return false; // Lock was already released or owned by another instance
    } catch (error) {
      logger.error(`Error releasing lock ${lockKey}:`, error);
      throw error;
    }
  }

  /**
   * Extend an existing lock's TTL
   */
  async extend(lockKey, lockValue, additionalTTL) {
    try {
      const currentValue = await this.client.get(lockKey);
      
      if (currentValue === lockValue) {
        await this.client.pexpire(lockKey, additionalTTL);
        logger.debug(`Lock extended: ${lockKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error extending lock ${lockKey}:`, error);
      throw error;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Lock Handle - Represents an acquired lock
 * Ensures proper cleanup even if errors occur
 */
class LockHandle {
  constructor(lockManager, resourceKey, lockKey, lockValue, ttl, expiresAt) {
    this.lockManager = lockManager;
    this.resourceKey = resourceKey;
    this.lockKey = lockKey;
    this.lockValue = lockValue;
    this.ttl = ttl;
    this.expiresAt = expiresAt;
    this.released = false;
  }

  /**
   * Release the lock manually
   */
  async release() {
    if (!this.released) {
      await this.lockManager.release(this.lockKey, this.lockValue);
      this.released = true;
    }
  }

  /**
   * Extend the lock TTL
   */
  async extend(additionalTTL) {
    await this.lockManager.extend(this.lockKey, this.lockValue, additionalTTL);
    this.expiresAt = Date.now() + additionalTTL;
  }

  /**
   * Check if lock is about to expire
   */
  isExpiringSoon(thresholdMs = 2000) {
    return Date.now() + thresholdMs >= this.expiresAt;
  }

  /**
   * Auto-release lock when garbage collected (safety net)
   */
  [Symbol.dispose]() {
    if (!this.released) {
      // Fire and forget - best effort cleanup
      this.release().catch(err => {
        console.error('Failed to release lock in cleanup:', err);
      });
    }
  }
}

module.exports = RedisLock;
