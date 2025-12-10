# Caching Strategy

This document describes the caching strategy used to reduce redundant API calls across pages and routes.

## Overview

The application uses Next.js 16's `"use cache"` directive with `cacheLife` profiles to cache expensive data fetches. This reduces load on external APIs (ESI, Janice) and Supabase, improving response times for users.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Pages / API Routes                        │
├─────────────────────────────────────────────────────────────────┤
│  /api/sell-opportunities    /api/market/opportunities           │
│  /api/market-seeder/analyze                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    lib/cached-data.ts                            │
│              (Next.js "use cache" functions)                     │
├─────────────────────────────────────────────────────────────────┤
│  getCachedJitaPrices()          cacheLife: 'minutes'            │
│  getCachedJaniceAppraisal()     cacheLife: 'minutes'            │
│  getCachedMarketStatistics()    cacheLife: 'hours'              │
│  getCachedMarketHistoryArrays() cacheLife: 'hours'              │
│  getCachedMarketSeederStats()   cacheLife: 'hours'              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Data Sources                        │
├─────────────────────────────────────────────────────────────────┤
│  ESI API           Janice API           Supabase                 │
│  (Market Orders)   (Item Prices)        (Market History)         │
└─────────────────────────────────────────────────────────────────┘
```

## Cache Profiles

Next.js provides built-in cache profiles via `cacheLife()`:

| Profile | Stale Time | Revalidate Time | Expire Time | Use Case |
|---------|------------|-----------------|-------------|----------|
| `minutes` | 5 min | 1 min | 1 hour | Frequently changing data (prices) |
| `hours` | 5 min | 1 hour | 1 day | Slowly changing data (market stats) |
| `days` | 5 min | 1 day | 1 week | Rarely changing data |

## Cached Functions

### `getCachedJitaPrices(typeIds: number[])`

Fetches current Jita sell prices from ESI regional market orders.

- **Cache Profile**: `minutes` (5 min stale, 1 min revalidate)
- **Cache Key**: Sorted array of type IDs
- **Source**: ESI `/markets/{region_id}/orders/`

### `getCachedJaniceAppraisal(itemNames: string[])`

Gets item prices via Janice API appraisal.

- **Cache Profile**: `minutes` (5 min stale, 1 min revalidate)
- **Cache Key**: Sorted array of item names
- **Source**: Janice API `/appraisal`

### `getCachedMarketStatistics(typeIds: number[])`

Fetches market statistics (ATH, mean price) from Supabase.

- **Cache Profile**: `hours` (1 hour revalidate)
- **Cache Key**: Sorted array of type IDs, region ID
- **Source**: Supabase RPC `get_sell_statistics`

### `getCachedMarketHistoryArrays(typeIds: number[], daysBack: number)`

Fetches market history arrays for signal analysis.

- **Cache Profile**: `hours` (1 hour revalidate)
- **Cache Key**: Sorted array of type IDs, days back, region ID
- **Source**: Supabase RPC `get_market_history_arrays`

### `getCachedMarketSeederStatistics(typeIds: number[], days: number)`

Fetches market seeder statistics (volume, trends).

- **Cache Profile**: `hours` (1 hour revalidate)
- **Cache Key**: Sorted array of type IDs, days, region ID
- **Source**: Supabase RPC `get_market_seeder_statistics`

## Configuration

### Enabling Cache Components

The `"use cache"` directive is enabled in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
}
```

## Cache Key Generation

Arguments to cached functions are serialized into cache keys. To ensure consistent cache hits:

1. **Arrays are sorted** before being used as arguments
2. **Type IDs** are sorted numerically: `[35, 34]` → `[34, 35]`
3. **Item names** are sorted alphabetically

This ensures that `getCachedJitaPrices([34, 35])` and `getCachedJitaPrices([35, 34])` hit the same cache entry.

## Serverless Considerations

On Vercel (serverless), the `"use cache"` directive uses in-memory LRU storage:

- **Per-instance caching**: Each serverless instance has its own cache
- **Cold starts**: Cache is empty on cold starts, requiring fresh fetches
- **Warm requests**: Subsequent requests within TTL are served from cache

### For More Robust Caching

If needed, Next.js supports `"use cache: remote"` for external cache handlers like Upstash Redis:

```ts
export async function getCachedJitaPrices(typeIds: number[]) {
  'use cache: remote'  // Uses external cache handler
  cacheLife('minutes')
  // ...
}
```

This requires configuring a cache handler in `next.config.ts`.

## Monitoring

Enable verbose cache logging for debugging:

```bash
NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
```

This logs cache hits, misses, and revalidation events.

## Best Practices

1. **Use appropriate TTLs**: Prices change frequently (minutes), stats change slowly (hours)
2. **Sort arguments**: Ensures consistent cache keys
3. **Pass minimal data**: Don't include auth tokens in cached function arguments
4. **Handle stale data**: UI should handle potentially stale prices gracefully

## Related Files

- `lib/cached-data.ts` - Cached data fetching functions
- `next.config.ts` - Cache components configuration
- `types/cache-life.d.ts` - Type definitions for cacheLife profiles

