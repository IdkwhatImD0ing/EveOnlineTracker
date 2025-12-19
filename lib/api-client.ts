/**
 * API Client with rate limit handling
 * 
 * Provides a wrapper around fetch that:
 * - Automatically handles 429 (Too Many Requests) responses
 * - Shows toast notifications when rate limited
 * - Returns typed responses
 */

import { toast } from 'sonner'

interface RateLimitError {
  error: string
  retryAfter: number
}

interface ApiError {
  error: string
  [key: string]: unknown
}

/**
 * Makes an API request and handles rate limiting
 * Shows a toast notification when rate limited
 * 
 * @param url - The API endpoint URL
 * @param options - Fetch options
 * @returns The response data or throws an error
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options)

  // Handle rate limiting
  if (response.status === 429) {
    const data: RateLimitError = await response.json()
    const retryAfter = data.retryAfter || 60
    
    toast.error('Too many requests', {
      description: `Please wait ${retryAfter} seconds before trying again.`,
      duration: Math.min(retryAfter * 1000, 10000), // Show for retry duration, max 10s
    })
    
    throw new RateLimitException(data.error, retryAfter)
  }

  // Handle other errors
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({ 
      error: `Request failed with status ${response.status}` 
    }))
    throw new ApiException(errorData.error, response.status, errorData)
  }

  return response.json()
}

/**
 * Exception thrown when the API rate limit is exceeded
 */
export class RateLimitException extends Error {
  public readonly retryAfter: number

  constructor(message: string, retryAfter: number) {
    super(message)
    this.name = 'RateLimitException'
    this.retryAfter = retryAfter
  }
}

/**
 * Generic API exception
 */
export class ApiException extends Error {
  public readonly status: number
  public readonly data: ApiError

  constructor(message: string, status: number, data: ApiError) {
    super(message)
    this.name = 'ApiException'
    this.status = status
    this.data = data
  }
}

/**
 * Hook-like function to check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitException {
  return error instanceof RateLimitException
}

/**
 * Wrapper for POST requests with JSON body
 */
export async function apiPost<T>(
  url: string,
  body: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  })
}

/**
 * Wrapper for DELETE requests
 */
export async function apiDelete<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'DELETE',
    ...options,
  })
}

/**
 * Wrapper for PATCH requests with JSON body
 */
export async function apiPatch<T>(
  url: string,
  body: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    ...options,
  })
}

