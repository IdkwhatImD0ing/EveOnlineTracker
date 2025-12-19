/**
 * Supabase mock for testing
 * Provides a configurable mock that can simulate different query results
 */
import { vi } from 'vitest'

export interface MockQueryResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
}

// Mock query builder that can be chained
export function createMockQueryBuilder<T = unknown>(result: MockQueryResult<T>) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    // For non-single queries, resolve with the result directly
    then: (resolve: (value: MockQueryResult<T>) => void) => Promise.resolve(result).then(resolve),
  }
  return builder
}

// Create a mock Supabase client
export function createMockSupabaseClient() {
  const mockResults: Map<string, MockQueryResult> = new Map()

  const client = {
    from: vi.fn((table: string) => {
      const result = mockResults.get(table) || { data: null, error: null }
      return createMockQueryBuilder(result)
    }),
    // Helper to set mock results for specific tables
    __setMockResult: (table: string, result: MockQueryResult) => {
      mockResults.set(table, result)
    },
    __clearMockResults: () => {
      mockResults.clear()
    },
  }

  return client
}

// Default mock client instance
export const mockSupabaseClient = createMockSupabaseClient()

// Mock the createClient function
export const mockCreateClient = vi.fn(() => mockSupabaseClient)

