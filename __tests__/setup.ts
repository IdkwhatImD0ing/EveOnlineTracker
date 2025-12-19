/**
 * Vitest global test setup
 */
import '@testing-library/jest-dom/vitest'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.EVE_CLIENT_ID = 'test-client-id'
process.env.EVE_CLIENT_SECRET = 'test-client-secret'
process.env.NODE_ENV = 'test'

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

