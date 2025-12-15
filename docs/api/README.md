# API Reference

This section documents all API routes available in the EVE Online Industry Tracker.

## Overview

The application provides a REST API built with Next.js API Routes (App Router). All endpoints are located under `/api/`.

## API Categories

| Category | Base Path | Description |
|----------|-----------|-------------|
| [Authentication](./auth.md) | `/api/auth/eve/*` | EVE SSO OAuth authentication |
| [ESI Proxy](./esi.md) | `/api/esi/*` | Proxied EVE ESI endpoints |
| [Industry](./industry.md) | `/api/industry/*` | Industry calculator endpoints |
| [Market](./market.md) | `/api/market/*` | Market analysis endpoints |
| [Market Seeder](./market-seeder.md) | `/api/market-seeder/*` | Market seeding analysis |
| [Watchlist](./watchlist.md) | `/api/watchlist/*` | Item watchlist management |
| [Projects](./projects.md) | `/api/projects/*` | Project CRUD operations |

## Conventions

### Request Format

- All POST/PATCH requests expect `Content-Type: application/json`
- Query parameters use standard URL encoding
- Path parameters are denoted with `[param]` in route definitions

### Response Format

All responses return JSON with consistent structure:

**Success Response:**
```json
{
  "data": { ... }
}
```

Or for list endpoints:
```json
[
  { ... },
  { ... }
]
```

**Error Response:**
```json
{
  "error": "Error message description",
  "details": ["Optional array of details"]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (for POST creating resources) |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid session |
| 403 | Forbidden - Account pending approval |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal error |

### Authentication

**All endpoints require authentication** except for the public auth flow routes (`/api/auth/eve/login`, `/api/auth/eve/callback`, `/api/auth/session`).

Authentication is session-based using HTTP-only cookies set after EVE SSO login. Additionally, users must have `allowed=true` in the database to access protected endpoints. New users are created with `allowed=false` and must be approved by an administrator.

**Protected Endpoints** return:
- `401 Unauthorized` if no valid session exists
- `403 Forbidden` if user is authenticated but `allowed=false`

**Cron/Scheduled Job Endpoints** (`/api/esi/market-history*`) require the `CRON_SECRET` via Authorization header:

```
Authorization: Bearer <CRON_SECRET from environment>
```

When using Vercel Cron, set `CRON_SECRET` as an environment variable and Vercel will automatically include this header in cron requests.

**Public Auth Routes** (no authentication required):
- `GET /api/auth/eve/login` - Initiates OAuth flow
- `POST /api/auth/eve/callback` - Handles OAuth callback
- `GET /api/auth/session` - Returns current session status
- `POST /api/auth/logout` - Clears session

## Quick Reference

### Authentication Routes (Public)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/eve/login` | Public | Redirect to EVE SSO |
| POST | `/api/auth/eve/callback` | Public | Exchange code for tokens |
| GET | `/api/auth/session` | Public | Get current session status |
| POST | `/api/auth/logout` | Session | Clear session cookie |
| GET | `/api/auth/eve/add-alt` | Session + Allowed | Add alt character |
| POST | `/api/auth/eve/refresh` | Session | Refresh access token |

### Character Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/characters` | List linked characters |
| DELETE | `/api/characters` | Remove a character |
| POST | `/api/characters/[id]/main` | Set main character |

### ESI Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esi/keepstar-3t7` | Search for 3T7-M8 Keepstar |
| GET | `/api/esi/structure-orders` | Get structure market orders |
| GET | `/api/esi/character-orders` | Get character market orders |
| GET | `/api/esi/character-assets` | Get character assets |
| GET | `/api/esi/wallet` | Get wallet balances |
| GET | `/api/esi/undercut-check` | Check for undercut orders |
| GET | `/api/esi/capital-efficiency` | Analyze capital efficiency |
| GET | `/api/esi/sell-order-generator` | Generate sell orders |
| POST | `/api/esi/ui/open-market-window` | Open market window in EVE |

### ESI Cron Routes (CRON_SECRET header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esi/market-history` | Fetch market history for all items |
| GET | `/api/esi/market-history-raw` | Raw ESI market history debugging |
| GET | `/api/esi/market-history-test` | Test market history for single item |

### Industry Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/industry/blueprints/search` | Search blueprints |
| POST | `/api/industry/calculate` | Calculate build requirements |
| GET | `/api/industry/systems` | List popular systems |
| POST | `/api/industry/systems` | Get system cost index |

### Market Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market/opportunities` | Find undervalued items using mean reversion |
| POST | `/api/sell-opportunities` | Analyze sell opportunities for assets |

### Market Seeder Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market-seeder/analyze` | Run market seeding analysis |
| GET | `/api/market-seeder/depletion` | Predict stock depletion |
| GET | `/api/market-seeder/market-data` | Get market data for type IDs |

### Watchlist Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/watchlist` | Get watchlist items with stock levels |
| POST | `/api/watchlist` | Add item to watchlist |
| DELETE | `/api/watchlist/[typeId]` | Remove item from watchlist |
| GET | `/api/items/search` | Search tradeable items |

### Project Routes (Session + Allowed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/[id]` | Get project details |
| DELETE | `/api/projects/[id]` | Delete project |
| POST | `/api/projects/[id]/costs` | Add additional cost |
| DELETE | `/api/projects/[id]/costs` | Remove additional cost |
| PATCH | `/api/projects/[id]/items/[itemId]` | Update item status |
| POST | `/api/projects/from-calculation` | Create from calculator |

## Rate Limiting

The application does not implement rate limiting directly, but external APIs have their own limits:

- **Janice API**: Fair use policy
- **EVE ESI**: Standard ESI rate limits apply
- **eve-industry.org**: No documented limits, use responsibly

## Error Handling

All API routes follow consistent error handling:

1. Validate required parameters
2. Return 400 for validation errors
3. Return 404 for missing resources
4. Return 500 for unexpected errors
5. Log errors to console for debugging

Example error handling in routes:

```typescript
if (!requiredParam) {
  return NextResponse.json(
    { error: 'requiredParam is required' },
    { status: 400 }
  )
}
```

