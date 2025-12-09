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
| 401 | Unauthorized - Missing or invalid auth |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal error |

### Authentication

Most endpoints don't require authentication. ESI proxy endpoints require EVE SSO Bearer tokens:

```
Authorization: Bearer <access_token>
```

## Quick Reference

### Authentication Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/eve/login` | Redirect to EVE SSO |
| POST | `/api/auth/eve/callback` | Exchange code for tokens |

### ESI Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/esi/keepstar-3t7` | Search for 3T7-M8 Keepstar |
| GET | `/api/esi/structure-orders` | Get structure market orders |

### Industry Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/industry/blueprints/search` | Search blueprints |
| POST | `/api/industry/calculate` | Calculate build requirements |
| GET | `/api/industry/systems` | List popular systems |
| POST | `/api/industry/systems` | Get system cost index |

### Project Routes

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

