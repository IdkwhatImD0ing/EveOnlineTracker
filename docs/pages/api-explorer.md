# API Explorer Page

Interactive tool for testing ESI API endpoints with your authenticated session.

## Route

`/api-explorer` — `app/(authenticated)/api-explorer/page.tsx`

## Purpose

The API Explorer provides a developer-friendly interface to test the application's ESI proxy endpoints. It displays your current session and allows executing API calls with custom parameters.

## Features

### Session Display

Shows the currently authenticated character:

```
┌────────────────────────────────────────────────────────────────┐
│  ESI API Explorer                                              │
│  Test EVE Online ESI endpoints                                 │
│                                                                │
│                    [Portrait] Testing as Character Name        │
└────────────────────────────────────────────────────────────────┘
```

### Route Cards

Expandable cards for each available API endpoint:

```
┌────────────────────────────────────────────────────────────────┐
│ GET  /api/esi/keepstar-3t7         Get Keepstar...           ▼ │
├────────────────────────────────────────────────────────────────┤
│ Searches for structures and returns any Keepstar in 3T7-M8... │
│                                                                │
│ Parameters                                                     │
│ search      string   [3T7-M8            ]                      │
│                     Search term (min 3 chars)                  │
│                                                                │
│ [Execute]                                                      │
├────────────────────────────────────────────────────────────────┤
│ 200 OK                                              152ms  📋  │
│ {                                                              │
│   "structure_id": 1051567430261,                              │
│   "name": "3T7-M8 - Goonswarm Keepstar",                      │
│   ...                                                          │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘
```

### Available Routes

| Route | Description |
|-------|-------------|
| `/api/esi/market-history-raw` | Raw market history from ESI (debugging) |
| `/api/esi/keepstar-3t7` | Search for 3T7-M8 Keepstar structure |
| `/api/esi/structure-orders` | Get market orders from a structure |
| `/api/esi/character-assets` | Get character assets |
| `/api/esi/character-orders` | Get character market orders |
| `/api/esi/wallet` | Get wallet balance |
| `/api/esi/undercut-check` | Check for undercut orders |
| `/api/esi/capital-efficiency` | Capital efficiency analysis |

### Features

- Collapsible route cards
- Method badges (GET = green, POST = blue)
- Parameter inputs with descriptions
- Execute button
- Response timing display
- Copy response button
- Syntax-highlighted JSON response

## Authentication

This page is part of the authenticated layout and uses session cookie authentication. All API calls include credentials automatically.

## State

```typescript
const [session, setSession] = useState<SessionData | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string>("")

// Route testing state
const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
const [routeParams, setRouteParams] = useState<Record<string, Record<string, string>>>({})
const [routeResponses, setRouteResponses] = useState<Record<string, ApiResponse>>({})
const [loadingRoute, setLoadingRoute] = useState<string | null>(null)
```

## API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `GET /api/auth/session` | On page load | Get current session info |
| Various `/api/esi/*` | User clicks Execute | Test ESI endpoints |

## Response Color Coding

| Status Code | Color |
|-------------|-------|
| 2xx | Green |
| 3xx | Blue |
| 4xx | Amber |
| 5xx | Red |

## Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Card` | shadcn/ui | Content containers |
| `Button` | shadcn/ui | Actions |
| `Input` | shadcn/ui | Parameter inputs |
| `Alert` | shadcn/ui | Error display |
| `Loader2` | lucide-react | Loading spinner |
| `Play` | lucide-react | Execute button icon |
| `ChevronDown/Right` | lucide-react | Expand/collapse |
| `Copy` | lucide-react | Copy button icon |
| `Check` | lucide-react | Copied confirmation |

## Related Files

- `app/(authenticated)/api-explorer/page.tsx` — Page component
- `app/api/auth/session/route.ts` — Session endpoint
- `app/api/esi/*` — ESI proxy endpoints
- `lib/auth.ts` — Authentication utilities

