# EVE SSO Callback Page

Handles EVE SSO OAuth callback and provides an ESI API testing interface.

## Route

`/callback` — `app/callback/page.tsx`

## Purpose

This page serves two functions:

1. **OAuth Callback Handler** — Receives authorization code from EVE SSO and exchanges it for tokens
2. **ESI API Explorer** — Test EVE ESI endpoints with your access token

## Features

### Authentication Flow

When redirected from EVE SSO with `?code=xxx&state=xxx`:

1. Page detects `code` parameter
2. Shows loading state
3. POSTs to `/api/auth/eve/callback` with code and state
4. Receives tokens and stores in localStorage
5. Displays tokens for copying

### Token Display

```
┌────────────────────────────────────────────────────────────────┐
│  ✓ Authentication Successful                                   │
│                                                                │
│  Refresh Token (save this!)                                    │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ gEy...long_refresh_token_string...                   │ 📋  │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

- Refresh token displayed in monospace code block
- Copy button with visual feedback (checkmark on success)
- Green styling indicates success

### Header Section

```
┌────────────────────────────────────────────────────────────────┐
│  ESI API Explorer                          Logged in as [Name] │
│  Test EVE Online ESI endpoints                  [Logout] [Home]│
└────────────────────────────────────────────────────────────────┘
```

Shows:
- Character name (parsed from JWT)
- Logout button (clears tokens)
- Back to Home navigation

### ESI API Tester

Expandable route cards for testing authenticated ESI endpoints:

```
┌────────────────────────────────────────────────────────────────┐
│ GET  /api/esi/keepstar-3t7         Get Keepstar...    [Auth] ▼ │
├────────────────────────────────────────────────────────────────┤
│ Searches for structures and returns any Keepstar in 3T7-M8... │
│                                                                │
│ Parameters                                                     │
│ character_id*  integer   [123456789        ]                   │
│                         Your character ID                       │
│ search         string   [3T7-M8            ]                   │
│                         Search term (min 3 chars)              │
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

**Available Routes:**

| Route | Description |
|-------|-------------|
| `/api/esi/keepstar-3t7` | Search for 3T7-M8 Keepstar |
| `/api/esi/structure-orders` | Get market orders from a structure |

**Features:**
- Collapsible route cards
- Auto-populated character_id from token
- Method badges (GET = green, POST = blue)
- Auth badge for authenticated routes
- Execute button (disabled without token)
- Response timing display
- Copy response button
- Syntax-highlighted JSON response

### Status States

| State | Display |
|-------|---------|
| idle | Login button, no token display |
| loading | Spinner with "Exchanging authorization code..." |
| success | Green success card with tokens |
| error | Red alert with error message |

## State

```typescript
const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle")
const [tokens, setTokens] = useState<TokenData | null>(null)
const [error, setError] = useState<string>("")
const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null)

// Route testing state
const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
const [routeParams, setRouteParams] = useState<Record<string, Record<string, string>>>({})
const [routeResponses, setRouteResponses] = useState<Record<string, ApiResponse>>({})
const [loadingRoute, setLoadingRoute] = useState<string | null>(null)
```

## API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `POST /api/auth/eve/callback` | On code parameter present | Exchange code for tokens |
| Various `/api/esi/*` | User clicks Execute | Test ESI endpoints |

## JWT Parsing

The page parses the access token JWT to extract character info:

```typescript
function parseJWT(token: string): CharacterInfo | null {
  const payload = JSON.parse(atob(token.split('.')[1]))
  return {
    character_id: parseInt(payload.sub.split(':')[2]),
    character_name: payload.name,
  }
}
```

## Token Persistence

Tokens are stored in localStorage:

```typescript
// Save on successful auth
localStorage.setItem("eve_sso_tokens", JSON.stringify(data))

// Load on page mount
const savedTokens = localStorage.getItem("eve_sso_tokens")

// Clear on logout
localStorage.removeItem("eve_sso_tokens")
```

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
| `Label` | shadcn/ui | Form labels |
| `Alert` | shadcn/ui | Error display |
| `Loader2` | lucide-react | Loading spinner |
| `CheckCircle` | lucide-react | Success icon |
| `AlertCircle` | lucide-react | Error icon |
| `Copy` | lucide-react | Copy button icon |
| `Check` | lucide-react | Copied confirmation |
| `Play` | lucide-react | Execute button icon |
| `ChevronDown/Right` | lucide-react | Expand/collapse |

## Styling

- Dark theme: `bg-zinc-950`, `text-zinc-100`
- Border colors: `border-zinc-800`
- Method badges with colored backgrounds
- Monospace font for code/tokens
- Subtle animations for interactions

## Related Files

- `app/callback/page.tsx` — Page component
- `app/api/auth/eve/callback/route.ts` — Token exchange endpoint
- `app/api/esi/*` — ESI proxy endpoints
- `lib/eve-sso.ts` — SSO helper functions

