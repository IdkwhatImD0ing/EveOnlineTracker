# External Integrations

This section documents the external APIs and services used by the EVE Online Industry Tracker.

## Overview

The application integrates with several external services:

| Service | Purpose | Auth Required |
|---------|---------|---------------|
| [Janice API](./janice-api.md) | Market prices and item parsing | API Key |
| [EVE ESI](./eve-esi.md) | Game data and character info | OAuth (for some) |
| [eve-industry.org](./eve-industry-org.md) | Cost indices and job costs | None |
| Supabase | Database storage | Service Key |

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVE Industry Tracker                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Janice    │  │     ESI     │  │    eve-industry.org     │ │
│  │    API      │  │             │  │                         │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │              │
│         ▼                ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    lib/ Functions                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │  │
│  │  │janice.ts │  │ eve-sso.ts│  │        esi.ts         │ │  │
│  │  │          │  │          │  │                        │ │  │
│  │  │• Prices  │  │• OAuth   │  │• Cost indices          │ │  │
│  │  │• Parsing │  │• Tokens  │  │• Job base costs        │ │  │
│  │  └──────────┘  └──────────┘  │• Adjusted prices       │ │  │
│  │                              │• Ore compression       │ │  │
│  │                              └────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     API Routes                           │  │
│  │  /api/projects   /api/industry   /api/auth   /api/esi   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Price Fetching (Janice)

```
User creates project
        │
        ▼
POST /api/projects
        │
        ▼
lib/janice.ts createAppraisal()
        │
        ▼
POST https://janice.e-351.com/api/rest/v2/appraisal
        │
        ▼
Parse response, extract prices
        │
        ▼
Store in Supabase
```

### Cost Index Fetching (eve-industry.org)

```
User calculates build
        │
        ▼
POST /api/industry/calculate
        │
        ▼
lib/esi.ts getSystemCostIndex()
        │
        ▼
GET http://api.eve-industry.org/system-cost-index.xml
        │
        ▼
Parse XML, return cost index
```

### Authenticated ESI Calls

```
User authenticates via EVE SSO
        │
        ▼
GET /api/auth/eve/login → EVE SSO → callback
        │
        ▼
POST /api/auth/eve/callback → tokens
        │
        ▼
User stores access_token
        │
        ▼
GET /api/esi/structure-orders
        │
        ▼
Proxy to ESI with token
```

### Market History (ESI - Public)

```
Weekly cron job (Sundays 12:00 UTC)
        │
        ▼
GET /api/esi/market-history
        │
        ▼
Read tradeable-items.jsonl (5,841 items)
        │
        ▼
Batch fetch ESI market history (50 concurrent)
GET https://esi.evetech.net/markets/10000002/history/?type_id={id}
        │
        ▼
Filter to last 7 days
        │
        ▼
Upsert to Supabase market_history table
```

## Error Handling

All integrations handle failures gracefully:

| Service | On Failure | Fallback |
|---------|------------|----------|
| Janice | Return empty prices | Items parsed, prices = 0 |
| eve-industry.org | Log warning | Use default cost index (0.0001) |
| EVE ESI | Return error response | User must retry |

## Rate Limiting

| Service | Limit | Notes |
|---------|-------|-------|
| Janice | Fair use | No hard limit documented |
| EVE ESI | Standard ESI limits | ~20 requests/second |
| eve-industry.org | None documented | Use responsibly |

## Caching

| Data | Cache Duration | Implementation |
|------|----------------|----------------|
| System cost indices | 1 hour | In-memory Map |
| Job base costs | Indefinite | In-memory Map |
| Market prices (Janice) | None | Fetched per request |
| Market history (ESI) | 1 week | Supabase `market_history` table |

## Environment Variables

```env
# Janice API (required for prices)
JANICE_API_KEY=your_api_key

# EVE SSO (required for ESI auth)
# EVE SSO (callback URL auto-detected based on environment)
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Service Status

If integrations fail, check:

- **Janice**: https://janice.e-351.com/
- **EVE ESI**: https://esi.evetech.net/ui/
- **eve-industry.org**: http://eve-industry.org/
- **Supabase**: Your project dashboard

## Related Files

| File | Purpose |
|------|---------|
| `lib/janice.ts` | Janice API client |
| `lib/eve-sso.ts` | EVE SSO OAuth helpers |
| `lib/esi.ts` | eve-industry.org and ESI utilities |

