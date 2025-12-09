# EVE ESI Integration

Integration with EVE Online's official ESI (EVE Swagger Interface) API.

## Overview

ESI is the official API for EVE Online, providing access to:

- Universe data (systems, types, structures)
- Character data (with authentication)
- Market data
- Industry data

## API Information

| Property | Value |
|----------|-------|
| Base URL | `https://esi.evetech.net/latest` |
| Documentation | https://esi.evetech.net/ui/ |
| Authentication | OAuth 2.0 (for character-specific data) |

## Authentication

ESI uses EVE SSO OAuth 2.0 for authenticated endpoints. See [Auth API Documentation](../api/auth.md) for our implementation.

### Scopes Used

| Scope | Purpose |
|-------|---------|
| `esi-search.search_structures.v1` | Search for structures by name |
| `esi-universe.read_structures.v1` | Get structure details (name, type, owner) |
| `esi-markets.structure_markets.v1` | Access structure market orders |

## Endpoints Used

### Structure Search

Search for structures a character can access.

```http
GET /characters/{character_id}/search/
  ?categories=structure
  &search=3T7
  &strict=false
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "structure": [1051567430261, 1051567430262]
}
```

### Structure Details

Get information about a structure.

```http
GET /universe/structures/{structure_id}/
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "name": "3T7-M8 - Goonswarm Keepstar",
  "owner_id": 1354830081,
  "position": {
    "x": 123456789,
    "y": 987654321,
    "z": 456789123
  },
  "solar_system_id": 30002938,
  "type_id": 35834
}
```

### Structure Market Orders

Get all market orders in a structure.

```http
GET /markets/structures/{structure_id}/
  ?page=1
Authorization: Bearer {access_token}
```

**Response:**
```json
[
  {
    "duration": 90,
    "is_buy_order": false,
    "issued": "2024-01-15T10:30:00Z",
    "location_id": 1051567430261,
    "min_volume": 1,
    "order_id": 6741234567,
    "price": 450000000000,
    "range": "station",
    "type_id": 23773,
    "volume_remain": 1,
    "volume_total": 1
  }
]
```

Pagination via `X-Pages` header.

### Type Information

Get details about an item type (no auth required).

```http
GET /universe/types/{type_id}/
```

**Response:**
```json
{
  "capacity": 0,
  "description": "The Molok is a Blood Raider...",
  "group_id": 30,
  "icon_id": 20988,
  "name": "Molok",
  "published": true,
  "type_id": 23773,
  "volume": 16250000000
}
```

### Market Prices

Get adjusted prices for industry calculations (no auth required).

```http
GET /markets/prices/
```

**Response:**
```json
[
  {
    "adjusted_price": 5.75,
    "average_price": 5.50,
    "type_id": 34
  }
]
```

### Market History

Get historical market statistics for a type in a region (no auth required).

```http
GET /markets/{region_id}/history/?type_id={type_id}
X-Compatibility-Date: 2025-11-06
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| region_id | integer | EVE region ID (e.g., 10000002 for The Forge) |
| type_id | integer | EVE type ID |

**Response:**
```json
[
  {
    "average": 3.99,
    "date": "2025-12-08",
    "highest": 4.01,
    "lowest": 3.94,
    "order_count": 2106,
    "volume": 7126308159
  },
  {
    "average": 3.99,
    "date": "2025-12-07",
    "highest": 4.00,
    "lowest": 3.98,
    "order_count": 2378,
    "volume": 6473742465
  }
]
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| average | number | Average price for the day |
| date | string | Date in YYYY-MM-DD format |
| highest | number | Highest price for the day |
| lowest | number | Lowest price for the day |
| order_count | integer | Total orders that day |
| volume | integer | Total units traded |

**Cache:** Expires daily at 11:05 UTC

**Rate Limit:** This endpoint is public and has generous rate limits (~100 req/sec)

## Implementation

### Proxied Routes

We proxy ESI calls through our API routes to:

- Add authorization headers
- Process and format responses
- Handle pagination
- Add type name lookups

**Structure Orders Example:**

```typescript
// app/api/esi/structure-orders/route.ts
export async function GET(request: NextRequest) {
  const structureId = request.nextUrl.searchParams.get('structure_id')
  const authHeader = request.headers.get('authorization')

  // Fetch all pages
  let allOrders = []
  let page = 1
  let totalPages = 1

  do {
    const response = await fetch(
      `${ESI_BASE}/markets/structures/${structureId}/?page=${page}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      }
    )
    
    totalPages = parseInt(response.headers.get('X-Pages') || '1')
    const orders = await response.json()
    allOrders = allOrders.concat(orders)
    page++
  } while (page <= totalPages)

  // Process and return
  // ... (see full implementation in source)
}
```

### EVE SSO OAuth

```typescript
// lib/eve-sso.ts
const EVE_SSO_AUTH_URL = 'https://login.eveonline.com/v2/oauth/authorize'
const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token'

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
    scope: scopes.join(' '),
  })
  return `${EVE_SSO_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
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
      grant_type: 'authorization_code',
      code: code,
    }).toString(),
  })

  return response.json()
}
```

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 304 | Not Modified | Use cached data |
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Token expired, refresh needed |
| 403 | Forbidden | Missing scope or access |
| 404 | Not Found | Resource doesn't exist |
| 420 | Error Limited | Rate limited, wait and retry |
| 500 | Server Error | ESI is having issues |
| 503 | Service Unavailable | ESI maintenance |

## Rate Limiting

ESI has rate limits:

- ~20 requests per second per IP
- Status code 420 when limited
- `X-Esi-Error-Limit-Remain` header shows remaining

The application doesn't implement rate limiting internally but handles 420 responses gracefully.

## Compatibility Date

We use the compatibility date header for stable responses:

```typescript
headers: {
  'X-Compatibility-Date': '2025-11-06',
}
```

This ensures response formats remain consistent.

## Known Structure IDs

| Structure | ID | Type |
|-----------|-----|------|
| 3T7-M8 Keepstar | 1051567430261 | Keepstar (35834) |

## Environment Variables

```env
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret
EVE_CALLBACK_URL=http://localhost:3000/callback
```

## Related Files

- `lib/eve-sso.ts` - OAuth helper functions
- `app/api/auth/eve/login/route.ts` - Login redirect
- `app/api/auth/eve/callback/route.ts` - Token exchange
- `app/api/esi/keepstar-3t7/route.ts` - Structure search
- `app/api/esi/structure-orders/route.ts` - Market orders
- `app/api/esi/market-history/route.ts` - Market history batch fetch
- `app/api/esi/market-history-test/route.ts` - Market history test endpoint

## See Also

- [ESI Documentation](https://esi.evetech.net/ui/)
- [EVE Developers Portal](https://developers.eveonline.com/)
- [Auth API Documentation](../api/auth.md)
- [ESI API Documentation](../api/esi.md)

