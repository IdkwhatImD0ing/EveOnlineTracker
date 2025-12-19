/**
 * Next.js headers and cookies mock for testing
 */
import { vi } from 'vitest'

// In-memory cookie store for testing
const cookieStore = new Map<string, { value: string; options?: Record<string, unknown> }>()

export const mockCookies = {
  get: vi.fn((name: string) => {
    const cookie = cookieStore.get(name)
    return cookie ? { name, value: cookie.value } : undefined
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    cookieStore.set(name, { value, options })
  }),
  delete: vi.fn((name: string) => {
    cookieStore.delete(name)
  }),
  getAll: vi.fn(() => {
    return Array.from(cookieStore.entries()).map(([name, { value }]) => ({ name, value }))
  }),
  // Helper methods for testing
  __set: (name: string, value: string) => {
    cookieStore.set(name, { value })
  },
  __clear: () => {
    cookieStore.clear()
  },
  __getStore: () => cookieStore,
}

// Mock the cookies function from next/headers
export const cookies = vi.fn(async () => mockCookies)

// Mock the connection function from next/server
export const connection = vi.fn(async () => {})

// Mock headers
export const mockHeaders = {
  get: vi.fn((_name: string) => null),
  set: vi.fn(),
  delete: vi.fn(),
  entries: vi.fn(() => []),
}

export const headers = vi.fn(async () => mockHeaders)

