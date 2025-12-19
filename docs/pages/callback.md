# EVE SSO Callback Page

Handles EVE SSO OAuth callback and token exchange.

## Route

`/callback` — `app/(public)/callback/page.tsx`

## Purpose

This page handles the OAuth 2.0 callback from EVE SSO. When a user authenticates with EVE Online, they are redirected here with an authorization code that gets exchanged for access tokens.

## Features

### Authentication Flow

When redirected from EVE SSO with `?code=xxx&state=xxx`:

1. Page detects `code` parameter
2. Shows loading state with "Authenticating..." message
3. POSTs to `/api/auth/eve/callback` with code and state
4. Server exchanges code for tokens and creates/updates session
5. Displays success message with character info
6. Redirects to dashboard after 1.5 seconds

### Alt Character Flow

When adding an alt character (state contains `add_alt` mode):

1. Same token exchange process
2. Shows "Alt Character Added!" message
3. Displays linked character name
4. Button to return to dashboard

### Status States

| State | Display |
|-------|---------|
| loading | Spinner with "Authenticating..." |
| success | Green success card, auto-redirect to dashboard |
| add_alt_success | Blue card showing linked alt, manual return button |
| error | Red alert with error message |

## Visual States

### Loading
```
┌────────────────────────────────────────────────────────────────┐
│                         ◌ Loading...                            │
│                    Exchanging authorization code                 │
└────────────────────────────────────────────────────────────────┘
```

### Success
```
┌────────────────────────────────────────────────────────────────┐
│                            ✓                                    │
│                    Account Created!                             │
│              Logged in as Character Name                        │
│                                                                 │
│                   ◌ Redirecting to dashboard...                 │
└────────────────────────────────────────────────────────────────┘
```

### Alt Added
```
┌────────────────────────────────────────────────────────────────┐
│                            👤+                                  │
│                   Alt Character Added!                          │
│       Alt Name has been linked to your account                  │
│                                                                 │
│                  [Return to Dashboard]                          │
└────────────────────────────────────────────────────────────────┘
```

### Error
```
┌────────────────────────────────────────────────────────────────┐
│                            ✗                                    │
│                  Authentication Failed                          │
│                    Error message here                           │
│                                                                 │
│                     [Return Home]                               │
└────────────────────────────────────────────────────────────────┘
```

## Behavior

- If accessed without `code` parameter, redirects to home `/`
- If authentication fails, shows error with return home button
- Uses `(public)` layout - no authentication required

## State

```typescript
const [status, setStatus] = useState<CallbackStatus>("loading")
const [result, setResult] = useState<CallbackResult | null>(null)
const [error, setError] = useState<string>("")
```

## API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `POST /api/auth/eve/callback` | On code parameter present | Exchange code for tokens |

## Session Management

Authentication is handled server-side via secure session cookies:

```typescript
// Token exchange creates session cookie automatically
const response = await fetch("/api/auth/eve/callback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, state }),
})

// Session cookie (eve_session) is set by the server
// Tokens are stored securely in the database
```

## Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Card` | shadcn/ui | Content containers |
| `Button` | shadcn/ui | Actions |
| `Loader2` | lucide-react | Loading spinner |
| `CheckCircle` | lucide-react | Success icon |
| `AlertCircle` | lucide-react | Error icon |
| `UserPlus` | lucide-react | Alt added icon |

## Styling

- Dark theme with gradient background
- Card with subtle backdrop blur
- Color-coded states (green = success, blue = alt, red = error)
- Centered layout with max-width container

## Related Files

- `app/(public)/callback/page.tsx` — Page component
- `app/api/auth/eve/callback/route.ts` — Token exchange endpoint
- `app/api/auth/eve/add-alt/route.ts` — Alt character login
- `lib/auth.ts` — Session management utilities
- `lib/eve-sso.ts` — SSO helper functions

## See Also

- [API Explorer](./api-explorer.md) — Interactive ESI endpoint testing
- [Auth API](../api/auth.md) — Authentication endpoints documentation
