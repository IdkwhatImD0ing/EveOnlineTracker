/**
 * Unit tests for lib/eve-sso.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the actual functions (no mocking needed for pure functions)
import {
  generateState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from '@/lib/eve-sso'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('lib/eve-sso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('generateState', () => {
    it('should generate a 16-character random string', () => {
      const state = generateState()

      expect(state).toHaveLength(16)
    })

    it('should only contain alphanumeric characters', () => {
      const state = generateState()

      expect(state).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should generate different values on each call', () => {
      const state1 = generateState()
      const state2 = generateState()
      const state3 = generateState()

      // While technically they could be the same, it's astronomically unlikely
      expect(new Set([state1, state2, state3]).size).toBeGreaterThan(1)
    })
  })

  describe('getAuthorizationUrl', () => {
    const clientId = 'test-client-id'
    const redirectUri = 'https://example.com/callback'
    const state = 'test-state-123'

    it('should build correct URL with required parameters', () => {
      const url = getAuthorizationUrl(clientId, redirectUri, state)

      expect(url).toContain('https://login.eveonline.com/v2/oauth/authorize')
      expect(url).toContain('response_type=code')
      expect(url).toContain(`client_id=${clientId}`)
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`)
      expect(url).toContain(`state=${state}`)
    })

    it('should include scopes when provided', () => {
      const scopes = ['esi-wallet.read_character_wallet.v1', 'esi-markets.read_character_orders.v1']

      const url = getAuthorizationUrl(clientId, redirectUri, state, scopes)

      expect(url).toContain('scope=')
      expect(url).toContain('esi-wallet.read_character_wallet.v1')
      expect(url).toContain('esi-markets.read_character_orders.v1')
    })

    it('should not include scope parameter when scopes array is empty', () => {
      const url = getAuthorizationUrl(clientId, redirectUri, state, [])

      expect(url).not.toContain('scope=')
    })

    it('should properly encode the redirect URI', () => {
      const complexRedirectUri = 'https://example.com/callback?foo=bar&baz=qux'

      const url = getAuthorizationUrl(clientId, complexRedirectUri, state)

      expect(url).toContain(encodeURIComponent(complexRedirectUri))
    })
  })

  describe('exchangeCodeForTokens', () => {
    const code = 'test-auth-code'
    const clientId = 'test-client-id'
    const clientSecret = 'test-client-secret'

    it('should call EVE SSO token endpoint with correct parameters', async () => {
      const mockResponse = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 1199,
        refresh_token: 'mock-refresh-token',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await exchangeCodeForTokens(code, clientId, clientSecret)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.eveonline.com/v2/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should use Basic auth with base64 encoded credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 1199,
          refresh_token: 'refresh',
        }),
      })

      await exchangeCodeForTokens(code, clientId, clientSecret)

      const expectedAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedAuth}`,
          }),
        })
      )
    })

    it('should throw error when token exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        }),
      })

      await expect(exchangeCodeForTokens(code, clientId, clientSecret)).rejects.toThrow(
        'Authorization code expired'
      )
    })

    it('should throw generic error when no error description provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'server_error',
        }),
      })

      await expect(exchangeCodeForTokens(code, clientId, clientSecret)).rejects.toThrow(
        'server_error'
      )
    })
  })

  describe('refreshAccessToken', () => {
    const refreshToken = 'test-refresh-token'
    const clientId = 'test-client-id'
    const clientSecret = 'test-client-secret'

    it('should call EVE SSO token endpoint with refresh_token grant', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 1199,
        refresh_token: 'new-refresh-token',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await refreshAccessToken(refreshToken, clientId, clientSecret)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.eveonline.com/v2/oauth/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error when refresh fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_token',
          error_description: 'Refresh token revoked',
        }),
      })

      await expect(refreshAccessToken(refreshToken, clientId, clientSecret)).rejects.toThrow(
        'Refresh token revoked'
      )
    })
  })
})

