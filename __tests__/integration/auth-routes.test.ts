/**
 * Integration tests for auth API routes
 * Tests the full request/response cycle for authentication endpoints
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockCookies, connection } from '../mocks/next-headers'
import { mockSupabaseClient, mockCreateClient, createMockQueryBuilder } from '../mocks/supabase'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies),
}))

// Mock next/server
vi.mock('next/server', () => ({
  connection: connection,
  NextRequest: class MockNextRequest {
    constructor(
      public url: string,
      public init?: { method?: string; body?: string; headers?: Record<string, string> }
    ) {}
    async json() {
      return this.init?.body ? JSON.parse(this.init.body) : {}
    }
    get headers() {
      return new Map(Object.entries(this.init?.headers || {}))
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Headers }) => ({
      body,
      status: init?.status || 200,
      async json() {
        return body
      },
    }),
    redirect: (url: string) => ({
      type: 'redirect',
      url,
      status: 302,
    }),
  },
}))

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Mock eve-sso for callback tests
vi.mock('@/lib/eve-sso', () => ({
  exchangeCodeForTokens: vi.fn().mockResolvedValue({
    access_token: 'mock-access-token',
    token_type: 'Bearer',
    expires_in: 1199,
    refresh_token: 'mock-refresh-token',
  }),
  refreshAccessToken: vi.fn().mockResolvedValue({
    access_token: 'new-access-token',
    token_type: 'Bearer',
    expires_in: 1199,
    refresh_token: 'new-refresh-token',
  }),
}))

describe('Auth API Routes', () => {
  beforeEach(() => {
    mockCookies.__clear()
    mockSupabaseClient.__clearMockResults()
    vi.clearAllMocks()
  })

  describe('POST /api/auth/logout', () => {
    it('should clear session cookie and return success', async () => {
      // Set up a session
      mockCookies.__set('eve_session', 'user-123')

      // Import the route handler
      const { POST } = await import('@/app/api/auth/logout/route')

      const response = await POST()
      const body = await response.json()

      expect(body.success).toBe(true)
      expect(body.message).toBe('Logged out successfully')
      expect(mockCookies.delete).toHaveBeenCalledWith('eve_session')
    })
  })

  describe('GET /api/auth/session', () => {
    it('should return authenticated: false when no session exists', async () => {
      mockCookies.__clear()

      const { GET } = await import('@/app/api/auth/session/route')

      const response = await GET()
      const body = await response.json()

      expect(body.authenticated).toBe(false)
    })

    it('should return user data when authenticated', async () => {
      // Set up session cookie
      mockCookies.__set('eve_session', 'user-123')

      // Mock user query result
      const mockUser = {
        id: 'user-123',
        main_character_id: 12345678,
        main_character_name: 'Test Pilot',
        role: 'slyce',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const mockCharacters = [
        {
          id: 'char-1',
          user_id: 'user-123',
          character_id: 12345678,
          character_name: 'Test Pilot',
          is_main: true,
          refresh_token: 'token',
          access_token: 'access',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      // Configure mock to return user data
      const userBuilder = createMockQueryBuilder({ data: mockUser, error: null })
      const charsBuilder = createMockQueryBuilder({ data: mockCharacters, error: null })

      let callCount = 0
      mockCreateClient.mockImplementation(() => ({
        from: (table: string) => {
          if (table === 'users') {
            return userBuilder
          } else if (table === 'characters') {
            return charsBuilder
          }
          return createMockQueryBuilder({ data: null, error: null })
        },
      }))

      // Re-import to pick up new mock
      vi.resetModules()
      vi.doMock('@/utils/supabase/server', () => ({
        createClient: mockCreateClient,
      }))

      const { GET } = await import('@/app/api/auth/session/route')

      const response = await GET()
      const body = await response.json()

      expect(body.authenticated).toBe(true)
      expect(body.user.id).toBe('user-123')
      expect(body.user.main_character_name).toBe('Test Pilot')
      expect(body.characters).toHaveLength(1)
      expect(body.characters[0].character_name).toBe('Test Pilot')
    })
  })

  describe('POST /api/auth/eve/callback', () => {
    const validPayload = {
      sub: 'CHARACTER:EVE:12345678',
      name: 'Test Pilot',
      owner: 'abc123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'login.eveonline.com',
    }

    beforeEach(() => {
      // Set up state cookie for CSRF validation
      mockCookies.__set('eve_sso_state', 'valid-state')
    })

    it('should return error when authorization code is missing', async () => {
      const { NextRequest } = await import('next/server')
      const { POST } = await import('@/app/api/auth/eve/callback/route')

      const request = new NextRequest('http://localhost/api/auth/eve/callback', {
        method: 'POST',
        body: JSON.stringify({ state: 'valid-state' }),
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Authorization code is required')
    })

    it('should return error when state is invalid (CSRF protection)', async () => {
      mockCookies.__set('eve_sso_state', 'stored-state')

      const { NextRequest } = await import('next/server')
      const { POST } = await import('@/app/api/auth/eve/callback/route')

      const request = new NextRequest('http://localhost/api/auth/eve/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'auth-code', state: 'wrong-state' }),
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Invalid state parameter')
    })

    it('should create new user on first login', async () => {
      // Create a valid mock JWT
      const base64Payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url')
      const mockAccessToken = `header.${base64Payload}.signature`

      // Mock exchangeCodeForTokens to return the valid token
      const eveSso = await import('@/lib/eve-sso')
      vi.mocked(eveSso.exchangeCodeForTokens).mockResolvedValueOnce({
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 1199,
        refresh_token: 'refresh-token',
      })

      // Create a comprehensive mock that handles both character lookup and user creation
      mockCreateClient.mockImplementation(() => {
        const fromMock = vi.fn((table: string) => {
          // For characters table - first returns not found, then handles insert
          if (table === 'characters') {
            return {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } }),
            }
          }
          // For users table
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'new-user-id',
                      main_character_id: 12345678,
                      main_character_name: 'Test Pilot',
                      role: 'public',
                    },
                    error: null,
                  }),
                }),
              }),
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }
          return createMockQueryBuilder({ data: null, error: null })
        })
        return { from: fromMock }
      })

      const { NextRequest } = await import('next/server')
      
      vi.resetModules()
      const { POST } = await import('@/app/api/auth/eve/callback/route')

      const request = new NextRequest('http://localhost/api/auth/eve/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-auth-code', state: 'valid-state' }),
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(body.success).toBe(true)
      expect(body.mode).toBe('login')
    })

    it('should handle add_alt mode when user is logged in', async () => {
      // Set up existing session and add_alt state
      mockCookies.__set('eve_session', 'existing-user-id')
      mockCookies.__set('eve_sso_state', 'valid-state:add_alt')

      // Create a valid mock JWT for the alt
      const altPayload = {
        sub: 'CHARACTER:EVE:87654321',
        name: 'Alt Character',
        owner: 'xyz789',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'login.eveonline.com',
      }
      const base64Payload = Buffer.from(JSON.stringify(altPayload)).toString('base64url')
      const mockAccessToken = `header.${base64Payload}.signature`

      const eveSso = await import('@/lib/eve-sso')
      vi.mocked(eveSso.exchangeCodeForTokens).mockResolvedValueOnce({
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 1199,
        refresh_token: 'alt-refresh-token',
      })

      // Mock no existing character for the alt
      const noCharacterBuilder = createMockQueryBuilder({ data: null, error: { message: 'Not found' } })
      const newAltBuilder = createMockQueryBuilder({
        data: {
          id: 'alt-char-id',
          user_id: 'existing-user-id',
          character_id: 87654321,
          character_name: 'Alt Character',
          is_main: false,
        },
        error: null,
      })

      mockCreateClient.mockImplementation(() => ({
        from: vi.fn((table: string) => {
          if (table === 'characters') {
            // Return different builders based on the operation
            const builder = {
              select: vi.fn().mockReturnThis(),
              insert: vi.fn().mockReturnThis(),
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }
            // For insert, return the new alt
            builder.insert = vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'alt-char-id',
                    user_id: 'existing-user-id',
                    character_id: 87654321,
                    character_name: 'Alt Character',
                    is_main: false,
                  },
                  error: null,
                }),
              }),
            })
            return builder
          }
          return createMockQueryBuilder({ data: null, error: null })
        }),
      }))

      const { NextRequest } = await import('next/server')
      
      vi.resetModules()
      const { POST } = await import('@/app/api/auth/eve/callback/route')

      const request = new NextRequest('http://localhost/api/auth/eve/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-auth-code', state: 'valid-state:add_alt' }),
      })

      const response = await POST(request as any)
      const body = await response.json()

      expect(body.success).toBe(true)
      expect(body.mode).toBe('add_alt')
      expect(body.character.character_name).toBe('Alt Character')
    })
  })
})

