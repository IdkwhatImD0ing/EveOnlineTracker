/**
 * Vercel KV mock for testing rate limiting
 */
import { vi } from 'vitest'

export interface MockPipelineResult {
  results: (number | null)[]
}

// Mock pipeline that tracks operations
export function createMockPipeline(requestCount: number = 0) {
  const results: (number | null)[] = [
    null, // zremrangebyscore result
    requestCount, // zcard result (current request count)
    null, // zadd result
    null, // expire result
  ]

  return {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(results),
  }
}

// Mock KV client
export const mockKv = {
  pipeline: vi.fn(() => createMockPipeline(0)),
  // Helper to configure the mock
  __setRequestCount: (count: number) => {
    mockKv.pipeline.mockReturnValue(createMockPipeline(count))
  },
  __setError: (error: Error) => {
    const pipeline = createMockPipeline()
    pipeline.exec.mockRejectedValue(error)
    mockKv.pipeline.mockReturnValue(pipeline)
  },
  __reset: () => {
    mockKv.pipeline.mockReturnValue(createMockPipeline(0))
  },
}

