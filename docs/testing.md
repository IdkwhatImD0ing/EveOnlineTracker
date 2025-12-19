# Testing Guide

This document describes the testing infrastructure for the EVE Online Industry Tracker.

## Overview

The project uses [Vitest](https://vitest.dev/) for testing, with comprehensive unit and integration tests for authentication, rate limiting, and core API functionality.

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-run on file changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

```
__tests__/
├── setup.ts              # Global test setup and environment
├── mocks/                # Mock implementations
│   ├── index.ts          # Centralized exports
│   ├── supabase.ts       # Supabase client mock
│   ├── vercel-kv.ts      # Vercel KV mock for rate limiting
│   ├── next-headers.ts   # Next.js cookies/headers mock
│   └── eve-sso.ts        # EVE SSO API mock
├── unit/                 # Unit tests
│   ├── auth.test.ts      # lib/auth.ts tests
│   ├── auth-types.test.ts # types/auth.ts tests
│   ├── eve-sso.test.ts   # lib/eve-sso.ts tests
│   └── rate-limit.test.ts # lib/rate-limit.ts tests
└── integration/          # Integration tests
    └── auth-routes.test.ts # API route tests
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions in isolation. Use mocks to replace external dependencies.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseClient, mockCreateClient } from '../mocks/supabase'

// Mock the dependency
vi.mock('@/utils/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mocking
import { myFunction } from '@/lib/my-module'

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', () => {
    const result = myFunction()
    expect(result).toBe(expected)
  })
})
```

### Integration Tests

Integration tests test the full request/response cycle for API routes.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockCookies } from '../mocks/next-headers'

// Set up mocks
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies),
}))

describe('POST /api/my-route', () => {
  it('should return expected response', async () => {
    const { POST } = await import('@/app/api/my-route/route')
    
    const response = await POST()
    const body = await response.json()
    
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
```

## Mock Utilities

### Supabase Mock

```typescript
import { mockSupabaseClient, mockCreateClient, createMockQueryBuilder } from '../mocks/supabase'

// Set up a mock result for a specific table
mockSupabaseClient.__setMockResult('users', {
  data: { id: 'user-123', name: 'Test User' },
  error: null,
})

// Create a custom query builder for more complex scenarios
const builder = createMockQueryBuilder({
  data: myData,
  error: null,
})
```

### Vercel KV Mock (Rate Limiting)

```typescript
import { mockKv } from '../mocks/vercel-kv'

// Simulate a user with 5 requests in the window
mockKv.__setRequestCount(5)

// Simulate KV error (tests fail-open behavior)
mockKv.__setError(new Error('Connection failed'))

// Reset to default state
mockKv.__reset()
```

### Cookies Mock

```typescript
import { mockCookies } from '../mocks/next-headers'

// Set a cookie value for testing
mockCookies.__set('eve_session', 'user-123')

// Clear all cookies
mockCookies.__clear()

// Access the internal store
const store = mockCookies.__getStore()
```

## Test Coverage

Coverage reports are generated in the `coverage/` directory when running `pnpm test:coverage`.

Current coverage targets:
- `lib/**/*.ts` - Core library functions
- `types/**/*.ts` - TypeScript utility functions
- `app/api/**/*.ts` - API route handlers

## Best Practices

1. **Mock external services**: Always mock Supabase, Vercel KV, and EVE SSO to avoid network calls.

2. **Clear mocks between tests**: Use `beforeEach` to reset mock state.

3. **Test edge cases**: Include tests for error handling, empty states, and boundary conditions.

4. **Keep tests focused**: Each test should verify one specific behavior.

5. **Use descriptive names**: Test names should describe the expected behavior.

## Adding New Tests

When adding a new feature:

1. Create unit tests for any new functions in `lib/` or `types/`
2. Create integration tests for any new API routes
3. Add mocks for any new external dependencies
4. Update this documentation if adding new patterns

## Related Files

- [`vitest.config.ts`](../vitest.config.ts) - Vitest configuration
- [`__tests__/setup.ts`](../__tests__/setup.ts) - Global test setup
- [`package.json`](../package.json) - Test scripts

