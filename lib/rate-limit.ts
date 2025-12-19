/**
 * Rate limiting utility using Vercel KV
 * Implements sliding window rate limiting per user
 */

import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 // 1 minute in seconds
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per minute

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp when the window resets
}

/**
 * Check if a user has exceeded their rate limit
 * Uses sliding window counter stored in Vercel KV
 * 
 * @param userId - The user ID to check rate limit for
 * @returns RateLimitResult with success status and metadata
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - RATE_LIMIT_WINDOW
  const key = `rate_limit:${userId}`

  try {
    // Use a pipeline for atomic operations
    const pipeline = kv.pipeline()
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart)
    
    // Count requests in current window
    pipeline.zcard(key)
    
    // Add current request with timestamp as score
    pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` })
    
    // Set expiry on the key
    pipeline.expire(key, RATE_LIMIT_WINDOW)
    
    const results = await pipeline.exec()
    
    // The count is the second result (index 1)
    const count = (results[1] as number) || 0
    
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count - 1)
    const reset = now + RATE_LIMIT_WINDOW

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      return {
        success: false,
        limit: RATE_LIMIT_MAX_REQUESTS,
        remaining: 0,
        reset,
      }
    }

    return {
      success: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining,
      reset,
    }
  } catch (error) {
    // If KV is unavailable, allow the request (fail open)
    console.error('[RateLimit] KV error, allowing request:', error)
    return {
      success: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      reset: now + RATE_LIMIT_WINDOW,
    }
  }
}

/**
 * Create rate limit headers for the response
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toString())
  return headers
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000))
  
  const headers = createRateLimitHeaders(result)
  headers.set('Retry-After', retryAfter.toString())

  return NextResponse.json(
    {
      error: 'Too many requests',
      retryAfter,
    },
    {
      status: 429,
      headers,
    }
  )
}

/**
 * Apply rate limit headers to an existing response
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.reset.toString())
  return response
}

