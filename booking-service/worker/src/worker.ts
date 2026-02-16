/**
 * Booking Service API - Cloudflare Workers Version
 * 
 * Production-ready booking service adapted for Cloudflare Workers
 * Uses D1 for database and KV for distributed locking
 */

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  CORS_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = handleCORS(request, env);
    if (cors) return cors;

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'cloudflare-workers'
      });
    }

    // Create booking
    if (path === '/api/bookings' && request.method === 'POST') {
      return await createBooking(request, env);
    }

    // Get bookings
    if (path === '/api/bookings' && request.method === 'GET') {
      return await getBookings(env);
    }

    // 404
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};

// CORS handling
function handleCORS(request: Request, env: Env): Response | null {
  const origin = request.headers.get('Origin') || '*';
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
  
  return null;
}

// Create booking with distributed lock
async function createBooking(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { startTime, endTime, metadata } = body;
    
    if (!startTime || !endTime) {
      return Response.json({ 
        error: 'Missing required fields: startTime, endTime' 
      }, { status: 400 });
    }

    const bookingId = crypto.randomUUID();
    const lockKey = `lock:${startTime}:${endTime}`;
    const lockValue = crypto.randomUUID();

    // Try to acquire distributed lock (KV with expiration)
    const acquired = await env.CACHE.put(lockKey, lockValue, { expirationTtl: 10 });
    
    if (!acquired) {
      return Response.json({
        error: 'Booking conflict',
        message: 'Another booking is being created for this time slot',
        code: 'LOCK_CONFLICT'
      }, { status: 409 });
    }

    try {
      // Check for overlapping bookings
      const overlapping = await env.DB.prepare(`
        SELECT id FROM bookings 
        WHERE status != 'CANCELLED'
          AND (
            (start_time <= ? AND end_time > ?)
            OR (start_time < ? AND end_time >= ?)
            OR (start_time >= ? AND end_time <= ?)
          )
        LIMIT 1
      `).bind(startTime, startTime, endTime, endTime, startTime, endTime).first();

      if (overlapping) {
        return Response.json({
          error: 'Booking conflict',
          message: 'Time slot overlaps with existing booking',
          code: 'TIME_SLOT_CONFLICT'
        }, { status: 409 });
      }

      // Create booking
      const result = await env.DB.prepare(`
        INSERT INTO bookings (id, start_time, end_time, status, metadata, created_at)
        VALUES (?, ?, ?, 'CONFIRMED', ?, ?)
      `).bind(bookingId, startTime, endTime, JSON.stringify(metadata || {}), new Date().toISOString()).run();

      return Response.json({
        success: true,
        data: {
          id: bookingId,
          startTime,
          endTime,
          status: 'CONFIRMED',
          metadata: metadata || {}
        }
      }, { status: 201 });

    } finally {
      // Release lock
      await env.CACHE.delete(lockKey);
    }

  } catch (error: any) {
    return Response.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

// Get all bookings
async function getBookings(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      SELECT * FROM bookings ORDER BY start_time DESC LIMIT 50
    `).all();

    return Response.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0
    });
  } catch (error: any) {
    return Response.json({
      error: 'Failed to fetch bookings',
      message: error.message
    }, { status: 500 });
  }
}
