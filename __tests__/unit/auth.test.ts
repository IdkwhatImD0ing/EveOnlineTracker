/**
 * Unit tests for lib/auth.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockCookies, connection } from '../mocks/next-headers'
import { mockSupabaseClient, mockCreateClient } from '../mocks/supabase'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies),
}))

// Mock next/server
vi.mock('next/server', () => ({
  connection: connection,
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}))

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mocks are set up
import {
  parseEveJWT,
  setSessionCookie,
  clearSessionCookie,
  getSessionUserId,
} from '@/lib/auth'

describe('lib/auth', () => {
  beforeEach(() => {
    mockCookies.__clear()
    mockSupabaseClient.__clearMockResults()
    vi.clearAllMocks()
  })

  describe('parseEveJWT', () => {
    it('should parse a valid JWT and extract character info', () => {
      // Create a valid JWT payload
      const payload = {
        sub: 'CHARACTER:EVE:12345678',
        name: 'Test Pilot',
        owner: 'abc123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'login.eveonline.com',
      }
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const mockToken = `eyJhbGciOiJSUzI1NiJ9.${base64Payload}.fake-signature`

      const result = parseEveJWT(mockToken)

      expect(result).toEqual({
        characterId: 12345678,
        characterName: 'Test Pilot',
      })
    })

    it('should return null for invalid JWT format', () => {
      const result = parseEveJWT('invalid-token')
      expect(result).toBeNull()
    })

    it('should return null for malformed base64', () => {
      const result = parseEveJWT('header.!!!invalid-base64!!!.signature')
      expect(result).toBeNull()
    })

    it('should return null for empty token', () => {
      const result = parseEveJWT('')
      expect(result).toBeNull()
    })

    it('should handle JWT with different character ID formats', () => {
      const payload = {
        sub: 'CHARACTER:EVE:87654321',
        name: 'Another Pilot',
        owner: 'xyz789',
        exp: 9999999999,
        iss: 'login.eveonline.com',
      }
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const mockToken = `header.${base64Payload}.signature`

      const result = parseEveJWT(mockToken)

      expect(result).toEqual({
        characterId: 87654321,
        characterName: 'Another Pilot',
      })
    })
  })

  describe('setSessionCookie', () => {
    it('should set the session cookie with correct options', async () => {
      const userId = 'test-user-id-123'

      await setSessionCookie(userId)

      expect(mockCookies.set).toHaveBeenCalledWith(
        'eve_session',
        userId,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      )
    })

    it('should set secure flag based on NODE_ENV', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      await setSessionCookie('user-id')

      expect(mockCookies.set).toHaveBeenCalledWith(
        'eve_session',
        'user-id',
        expect.objectContaining({
          secure: true,
        })
      )

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('clearSessionCookie', () => {
    it('should delete the session cookie', async () => {
      await clearSessionCookie()

      expect(mockCookies.delete).toHaveBeenCalledWith('eve_session')
    })
  })

  describe('getSessionUserId', () => {
    it('should return user ID when session cookie exists', async () => {
      mockCookies.__set('eve_session', 'stored-user-id')

      const result = await getSessionUserId()

      expect(result).toBe('stored-user-id')
    })

    it('should return null when no session cookie exists', async () => {
      mockCookies.__clear()

      const result = await getSessionUserId()

      expect(result).toBeNull()
    })
  })
})

