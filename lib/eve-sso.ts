/**
 * EVE Online SSO Authentication
 * Based on OAuth 2.0 Authorization Code flow
 */

const EVE_SSO_AUTH_URL = 'https://login.eveonline.com/v2/oauth/authorize'
const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token'

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

export interface TokenError {
  error: string
  error_description?: string
}

/**
 * Generate a random state string for CSRF protection
 */
export function generateState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Build the EVE SSO authorization URL
 */
export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[] = []
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
  })

  if (scopes.length > 0) {
    params.set('scope', scopes.join(' '))
  }

  return `${EVE_SSO_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  // Create Basic Auth header
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(EVE_SSO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
    }).toString(),
  })

  if (!response.ok) {
    const errorData = await response.json() as TokenError
    throw new Error(errorData.error_description || errorData.error || 'Token exchange failed')
  }

  return response.json() as Promise<TokenResponse>
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(EVE_SSO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorData = await response.json() as TokenError
    throw new Error(errorData.error_description || errorData.error || 'Token refresh failed')
  }

  return response.json() as Promise<TokenResponse>
}

