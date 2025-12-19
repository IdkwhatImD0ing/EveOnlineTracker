/**
 * EVE SSO mock for testing
 */
import { vi } from 'vitest'
import type { TokenResponse } from '@/lib/eve-sso'

// Valid mock JWT payload for character ID 12345678
// Format: header.payload.signature
// Payload: { sub: "CHARACTER:EVE:12345678", name: "Test Character", owner: "abc", exp: 9999999999, iss: "login.eveonline.com" }
export const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJDSEFSQUNURVI6RVZFOTI7MzQ1Njc4IiwibmFtZSI6IlRlc3QgQ2hhcmFjdGVyIiwib3duZXIiOiJhYmMiLCJleHAiOjk5OTk5OTk5OTksImlzcyI6ImxvZ2luLmV2ZW9ubGluZS5jb20ifQ.fake-signature'

// Default mock token response
export const mockTokenResponse: TokenResponse = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: 'Bearer',
  expires_in: 1199,
  refresh_token: 'mock-refresh-token',
}

// Mock exchangeCodeForTokens
export const mockExchangeCodeForTokens = vi.fn(async (): Promise<TokenResponse> => {
  return mockTokenResponse
})

// Mock refreshAccessToken
export const mockRefreshAccessToken = vi.fn(async (): Promise<TokenResponse> => {
  return mockTokenResponse
})

// Mock generateState
export const mockGenerateState = vi.fn(() => 'mock-state-12345')

// Mock getAuthorizationUrl
export const mockGetAuthorizationUrl = vi.fn(
  (clientId: string, redirectUri: string, state: string, scopes: string[] = []) => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
    })
    if (scopes.length > 0) {
      params.set('scope', scopes.join(' '))
    }
    return `https://login.eveonline.com/v2/oauth/authorize?${params.toString()}`
  }
)

