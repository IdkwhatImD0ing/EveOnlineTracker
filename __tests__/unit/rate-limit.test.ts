/**
 * Unit tests for lib/rate-limit.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockKv } from '../mocks/vercel-kv'

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: mockKv,
}))

// Import after mocks are set up
import {
  checkRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  applyRateLimitHeaders,
} from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number; headers?: Headers }) => {
      const response = {
        body,
        status: init?.status || 200,
        headers: new Map<string, string>(),
      }
      if (init?.headers) {
        init.headers.forEach((value: string, key: string) => {
          response.headers.set(key, value)
        })
      }
      return response
    }),
  },
}))

describe('lib/rate-limit', () => {
  beforeEach(() => {
    mockKv.__reset()
    vi.clearAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockKv.__setRequestCount(5) // 5 requests, limit is 10

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(true)
      expect(result.limit).toBe(10)
      expect(result.remaining).toBe(4) // 10 - 5 - 1 (current request)
      expect(result.reset).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should block request when at limit', async () => {
      mockKv.__setRequestCount(10) // At the limit

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should block request when over limit', async () => {
      mockKv.__setRequestCount(15) // Over the limit

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should allow request when exactly at limit minus one', async () => {
      mockKv.__setRequestCount(9) // 9 requests, 1 more allowed

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(0)
    })

    it('should fail open when KV throws an error', async () => {
      mockKv.__setError(new Error('KV connection failed'))

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(true) // Fail open
      expect(result.limit).toBe(10)
      expect(result.remaining).toBe(10)
    })

    it('should use correct key format for user', async () => {
      mockKv.__setRequestCount(0)

      await checkRateLimit('user-abc-123')

      const pipeline = mockKv.pipeline()
      expect(mockKv.pipeline).toHaveBeenCalled()
    })

    it('should set expiry on the rate limit key', async () => {
      mockKv.__setRequestCount(0)

      await checkRateLimit('user-123')

      const pipeline = mockKv.pipeline()
      expect(pipeline.expire).toHaveBeenCalled()
    })

    it('should bypass rate limiting for admin users', async () => {
      mockKv.__setRequestCount(100) // Way over the limit

      const result = await checkRateLimit('user-123', 'admin')

      expect(result.success).toBe(true)
      expect(result.limit).toBe(Infinity)
      expect(result.remaining).toBe(Infinity)
      expect(result.reset).toBe(0)
    })

    it('should not bypass rate limiting for non-admin roles', async () => {
      mockKv.__setRequestCount(15) // Over the limit

      // Test with 'slyce' role
      const slyceResult = await checkRateLimit('user-123', 'slyce')
      expect(slyceResult.success).toBe(false)

      // Test with 'user' role
      mockKv.__setRequestCount(15)
      const userResult = await checkRateLimit('user-123', 'user')
      expect(userResult.success).toBe(false)

      // Test with 'pro' role
      mockKv.__setRequestCount(15)
      const proResult = await checkRateLimit('user-123', 'pro')
      expect(proResult.success).toBe(false)

      // Test with 'public' role
      mockKv.__setRequestCount(15)
      const publicResult = await checkRateLimit('user-123', 'public')
      expect(publicResult.success).toBe(false)
    })

    it('should apply rate limiting when role is undefined', async () => {
      mockKv.__setRequestCount(15) // Over the limit

      const result = await checkRateLimit('user-123')

      expect(result.success).toBe(false)
    })
  })

  describe('createRateLimitHeaders', () => {
    it('should create headers with all rate limit info', () => {
      const result = {
        success: true,
        limit: 10,
        remaining: 5,
        reset: 1700000000,
      }

      const headers = createRateLimitHeaders(result)

      expect(headers.get('X-RateLimit-Limit')).toBe('10')
      expect(headers.get('X-RateLimit-Remaining')).toBe('5')
      expect(headers.get('X-RateLimit-Reset')).toBe('1700000000')
    })

    it('should handle zero remaining', () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: 1700000000,
      }

      const headers = createRateLimitHeaders(result)

      expect(headers.get('X-RateLimit-Remaining')).toBe('0')
    })
  })

  describe('createRateLimitResponse', () => {
    it('should create 429 response with correct body', () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 60,
      }

      const response = createRateLimitResponse(result)

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
          retryAfter: expect.any(Number),
        }),
        expect.objectContaining({
          status: 429,
        })
      )
    })

    it('should include Retry-After header', () => {
      const futureReset = Math.floor(Date.now() / 1000) + 30
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: futureReset,
      }

      createRateLimitResponse(result)

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.any(Number),
        }),
        expect.anything()
      )
    })
  })

  describe('applyRateLimitHeaders', () => {
    it('should add rate limit headers to existing response', () => {
      const mockResponse = {
        headers: {
          set: vi.fn(),
        },
      } as unknown as NextResponse

      const result = {
        success: true,
        limit: 10,
        remaining: 7,
        reset: 1700000000,
      }

      applyRateLimitHeaders(mockResponse, result)

      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '7')
      expect(mockResponse.headers.set).toHaveBeenCalledWith('X-RateLimit-Reset', '1700000000')
    })
  })
})

