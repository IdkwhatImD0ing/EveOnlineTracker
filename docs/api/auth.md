# Authentication API

EVE SSO (Single Sign-On) authentication endpoints for obtaining OAuth tokens.

## Overview

These endpoints implement EVE Online's OAuth 2.0 Authorization Code flow. They are primarily used to obtain refresh tokens for use in external scripts or cron jobs.

## Endpoints

### GET /api/auth/eve/login

Initiates the EVE SSO authentication flow by redirecting to EVE's authorization page.

**Authentication:** None required

**Response:** 302 Redirect to `https://login.eveonline.com/v2/oauth/authorize`

**Flow:**
1. Generates a random state for CSRF protection
2. Stores state in an HTTP-only cookie (10 minute expiry)
3. Redirects to EVE SSO with configured scopes

**Configured Scopes:**

The login endpoint requests a comprehensive set of ESI scopes to enable full functionality:

| Category | Scopes |
|----------|--------|
| **Public** | `publicData` |
| **Calendar** | `esi-calendar.respond_calendar_events.v1`, `esi-calendar.read_calendar_events.v1` |
| **Location** | `esi-location.read_location.v1`, `esi-location.read_ship_type.v1`, `esi-location.read_online.v1` |
| **Mail** | `esi-mail.organize_mail.v1`, `esi-mail.read_mail.v1`, `esi-mail.send_mail.v1` |
| **Skills** | `esi-skills.read_skills.v1`, `esi-skills.read_skillqueue.v1` |
| **Wallet** | `esi-wallet.read_character_wallet.v1`, `esi-wallet.read_corporation_wallet.v1`, `esi-wallet.read_corporation_wallets.v1` |
| **Search & Universe** | `esi-search.search_structures.v1`, `esi-universe.read_structures.v1` |
| **Clones** | `esi-clones.read_clones.v1`, `esi-clones.read_implants.v1` |
| **Characters** | `esi-characters.read_contacts.v1`, `esi-characters.write_contacts.v1`, `esi-characters.read_loyalty.v1`, `esi-characters.read_chat_channels.v1`, `esi-characters.read_medals.v1`, `esi-characters.read_standings.v1`, `esi-characters.read_agents_research.v1`, `esi-characters.read_blueprints.v1`, `esi-characters.read_corporation_roles.v1`, `esi-characters.read_fatigue.v1`, `esi-characters.read_notifications.v1`, `esi-characters.read_titles.v1`, `esi-characters.read_fw_stats.v1`, `esi-characters.read_freelance_jobs.v1` |
| **Killmails** | `esi-killmails.read_killmails.v1`, `esi-killmails.read_corporation_killmails.v1` |
| **Corporations** | `esi-corporations.read_corporation_membership.v1`, `esi-corporations.read_structures.v1`, `esi-corporations.track_members.v1`, `esi-corporations.read_divisions.v1`, `esi-corporations.read_contacts.v1`, `esi-corporations.read_titles.v1`, `esi-corporations.read_blueprints.v1`, `esi-corporations.read_standings.v1`, `esi-corporations.read_starbases.v1`, `esi-corporations.read_container_logs.v1`, `esi-corporations.read_facilities.v1`, `esi-corporations.read_medals.v1`, `esi-corporations.read_fw_stats.v1`, `esi-corporations.read_projects.v1`, `esi-corporations.read_freelance_jobs.v1` |
| **Assets** | `esi-assets.read_assets.v1`, `esi-assets.read_corporation_assets.v1` |
| **Planets (PI)** | `esi-planets.manage_planets.v1`, `esi-planets.read_customs_offices.v1` |
| **Fleets** | `esi-fleets.read_fleet.v1`, `esi-fleets.write_fleet.v1` |
| **UI** | `esi-ui.open_window.v1`, `esi-ui.write_waypoint.v1` |
| **Fittings** | `esi-fittings.read_fittings.v1`, `esi-fittings.write_fittings.v1` |
| **Markets** | `esi-markets.structure_markets.v1`, `esi-markets.read_character_orders.v1`, `esi-markets.read_corporation_orders.v1` |
| **Industry** | `esi-industry.read_character_jobs.v1`, `esi-industry.read_corporation_jobs.v1`, `esi-industry.read_character_mining.v1`, `esi-industry.read_corporation_mining.v1` |
| **Contracts** | `esi-contracts.read_character_contracts.v1`, `esi-contracts.read_corporation_contracts.v1` |
| **Alliances** | `esi-alliances.read_contacts.v1` |

> **Note:** These scopes must also be enabled in your EVE Developer Application at [developers.eveonline.com](https://developers.eveonline.com)

**Environment Variables Required:**
- `EVE_CLIENT_ID` - Your EVE application client ID
- `EVE_CALLBACK_URL` - Callback URL (default: `http://localhost:3000/callback`)

**Example Usage:**
```html
<a href="/api/auth/eve/login">Login with EVE SSO</a>
```

**Error Response (500):**
```json
{
  "error": "EVE_CLIENT_ID not configured"
}
```

---

### POST /api/auth/eve/callback

Exchanges the authorization code for access and refresh tokens.

**Authentication:** None required (uses state cookie for CSRF protection)

**Request Body:**
```json
{
  "code": "authorization_code_from_callback",
  "state": "state_parameter_from_callback"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | string | Yes | Authorization code from EVE SSO callback |
| state | string | Yes | State parameter for CSRF validation |

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "gEy...refresh_token_value",
  "expires_in": 1199,
  "token_type": "Bearer"
}
```

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | JWT access token for ESI calls (valid ~20 minutes) |
| refresh_token | string | Long-lived token to obtain new access tokens |
| expires_in | number | Seconds until access token expires |
| token_type | string | Always "Bearer" |

**Error Responses:**

*Missing code (400):*
```json
{
  "error": "Authorization code is required"
}
```

*Invalid state (400):*
```json
{
  "error": "Invalid state parameter - possible CSRF attack"
}
```

*Token exchange failed (500):*
```json
{
  "error": "Token exchange failed: invalid_grant"
}
```

**Environment Variables Required:**
- `EVE_CLIENT_ID` - Your EVE application client ID
- `EVE_CLIENT_SECRET` - Your EVE application client secret

---

## OAuth Flow Diagram

```
┌──────────┐     1. Click Login     ┌─────────────────────┐
│  Client  │ ─────────────────────> │ /api/auth/eve/login │
└──────────┘                        └─────────────────────┘
                                              │
                                    2. Generate state,
                                       set cookie,
                                       redirect
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │   EVE SSO Server    │
                                    │ login.eveonline.com │
                                    └─────────────────────┘
                                              │
                                    3. User authenticates,
                                       grants permissions
                                              │
                                              ▼
┌──────────┐     4. Redirect with   ┌─────────────────────┐
│  Client  │ <───── code & state ── │      /callback      │
└──────────┘                        └─────────────────────┘
      │
      │ 5. POST code & state
      ▼
┌───────────────────────────┐
│ /api/auth/eve/callback    │
└───────────────────────────┘
      │
      │ 6. Validate state cookie
      │ 7. Exchange code for tokens
      │
      ▼
┌───────────────────────────┐
│  Return tokens to client  │
└───────────────────────────┘
```

---

## Using Tokens

### Access Token

Use the access token for ESI API calls:

```typescript
const response = await fetch('https://esi.evetech.net/latest/characters/123456/', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  }
})
```

### Refresh Token

Use the refresh token to get new access tokens when they expire:

```typescript
const response = await fetch('https://login.eveonline.com/v2/oauth/token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken,
  }),
})
```

---

## Parsing the Access Token

The access token is a JWT containing character information:

```typescript
function parseJWT(token: string) {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const payload = JSON.parse(atob(base64))
  
  return {
    character_id: parseInt(payload.sub.split(':')[2]),
    character_name: payload.name,
    scopes: payload.scp,
    expires: new Date(payload.exp * 1000)
  }
}
```

---

## Security Considerations

1. **State Parameter**: Always validate the state parameter matches the cookie to prevent CSRF attacks
2. **HTTP-Only Cookie**: The state is stored in an HTTP-only cookie to prevent XSS access
3. **Token Storage**: Store refresh tokens securely; they grant access to your EVE account
4. **Client Secret**: Never expose the client secret in client-side code

---

## Related Files

- `lib/eve-sso.ts` - SSO helper functions
- `app/api/auth/eve/login/route.ts` - Login route implementation
- `app/api/auth/eve/callback/route.ts` - Callback route implementation
- `app/callback/page.tsx` - Callback UI page

