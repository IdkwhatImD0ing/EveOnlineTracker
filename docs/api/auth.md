# Authentication API

EVE SSO (Single Sign-On) authentication endpoints with multi-account (alt) support.

## Overview

The application uses EVE Online's OAuth 2.0 Authorization Code flow for authentication. Users authenticate with their EVE character, which becomes their main. They can link additional alt characters to their account.

Access is controlled via a `role` field in the database. New users are automatically assigned:
- `slyce` role if they are in the Slyce alliance (auto-approved)
- `public` role otherwise (pending approval)

Administrators can promote users to `user`, `pro`, or `admin` roles via the Admin Dashboard.

## User Roles

| Role | Description | Auto-assigned | App Access |
|------|-------------|---------------|------------|
| `public` | Pending approval | Yes (non-Slyce) | None |
| `slyce` | Slyce alliance member | Yes | Restricted* |
| `user` | Approved by admin | No | Restricted* |
| `pro` | Premium features | No | Restricted* |
| `admin` | Full access | No | Full |

*Currently all pages are admin-only. Access will be expanded in future updates.

## Authentication Flow

```
┌──────────┐     1. Visit app        ┌─────────────────────┐
│  Client  │ ───────────────────────> │    AuthGate         │
└──────────┘                         └─────────────────────┘
                                              │
                                    2. Check session cookie
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │ Session exists?     │
                                    └─────────────────────┘
                                       │            │
                                      No           Yes
                                       │            │
                                       ▼            ▼
                            ┌──────────────┐  ┌──────────────┐
                            │ Show Login   │  │ Check Role   │
                            └──────────────┘  └──────────────┘
                                   │               │
                                   ▼               ▼
                            EVE SSO OAuth   ┌──────────────┐
                                   │        │ Role=admin?  │
                                   │        └──────────────┘
                                   │            │       │
                                   │           No      Yes
                                   │            │       │
                                   │            ▼       ▼
                                   │      Restricted  Show App
                                   │      Access Screen
                                   ▼
                            ┌──────────────────┐
                            │ Character exists │
                            │ in database?     │
                            └──────────────────┘
                               │            │
                              Yes           No
                               │            │
                               ▼            ▼
                         Login user    Check Alliance
                         (set cookie)  via ESI
                                            │
                                ┌───────────┴───────────┐
                                ▼                       ▼
                          In Slyce?               Not in Slyce
                          role=slyce              role=public
```

## Endpoints

### GET /api/auth/eve/login

Initiates the EVE SSO authentication flow for login.

**Response:** 302 Redirect to EVE SSO authorization page

**Flow:**
1. Generates random state for CSRF protection
2. Stores state in HTTP-only cookie (10 minute expiry)
3. Redirects to EVE SSO with configured scopes

---

### GET /api/auth/eve/add-alt

Initiates the EVE SSO authentication flow to add an alt character.

**Authentication:** Requires active session (user must be logged in)

**Response:** 302 Redirect to EVE SSO authorization page

**Flow:**
1. Verifies user is authenticated
2. Generates state with `add_alt` marker
3. Redirects to EVE SSO

---

### POST /api/auth/eve/callback

Exchanges the authorization code for tokens and creates/updates user.

**Request Body:**
```json
{
  "code": "authorization_code_from_callback",
  "state": "state_parameter_from_callback"
}
```

**Success Response (Login):**
```json
{
  "success": true,
  "mode": "login",
  "user": {
    "id": "uuid",
    "main_character_name": "Character Name",
    "role": "slyce"
  },
  "is_new": false
}
```

**Success Response (Add Alt):**
```json
{
  "success": true,
  "mode": "add_alt",
  "character": {
    "character_id": 12345678,
    "character_name": "Alt Character"
  }
}
```

**Behavior:**
- For login: Creates user if new, updates tokens if existing
- For add_alt: Links character to current user's account
- Sets session cookie on successful login

---

### GET /api/auth/session

Returns the current user's session information.

**Success Response (Authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "main_character_id": 12345678,
    "main_character_name": "Main Character",
    "role": "admin"
  },
  "characters": [
    {
      "id": "uuid",
      "character_id": 12345678,
      "character_name": "Main Character",
      "is_main": true
    },
    {
      "id": "uuid",
      "character_id": 87654321,
      "character_name": "Alt Character",
      "is_main": false
    }
  ]
}
```

**Response (Not Authenticated):**
```json
{
  "authenticated": false
}
```

---

### POST /api/auth/logout

Clears the session cookie and logs the user out.

**Success Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/eve/refresh

Refreshes an EVE SSO access token using a refresh token.

**Request Body:**
```json
{
  "refresh_token": "..."
}
```

**Success Response:**
```json
{
  "access_token": "new_access_token",
  "refresh_token": "new_refresh_token",
  "expires_in": 1199,
  "token_type": "Bearer"
}
```

---

## Character Management

### GET /api/characters

Returns all characters linked to the current user.

**Success Response:**
```json
{
  "characters": [
    {
      "id": "uuid",
      "character_id": 12345678,
      "character_name": "Character Name",
      "is_main": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### DELETE /api/characters

Removes a character from the user's account.

**Request Body:**
```json
{
  "character_id": 87654321
}
```

**Note:** Cannot remove the main character. Set a different main first.

---

### POST /api/characters/[id]/main

Sets the specified character as the user's main character.

**URL Parameter:** `id` - EVE character ID

**Success Response:**
```json
{
  "success": true,
  "message": "Main character updated successfully"
}
```

---

## Session Management

Sessions are stored in HTTP-only cookies for security:

- **Cookie Name:** `eve_session`
- **Contents:** User ID (UUID)
- **Max Age:** 30 days
- **Flags:** HttpOnly, Secure (in production), SameSite=Lax

Tokens are stored in the database:
- Access tokens are cached and refreshed automatically when expired
- Refresh tokens are stored securely per character

---

## Access Control

New users are automatically assigned a role based on alliance membership:
- **Slyce alliance members** → `slyce` role (auto-approved)
- **Non-Slyce members** → `public` role (pending approval)

To change a user's role:

1. Login as an admin user
2. Navigate to the Admin Dashboard (`/admin`)
3. Find the user in the table
4. Select the new role from the dropdown

Available roles: `public`, `slyce`, `user`, `pro`, `admin`

**Note:** Currently all pages require `admin` role for access.

---

## Security Considerations

1. **Session Cookies**: HTTP-only cookies prevent XSS access
2. **CSRF Protection**: State parameter validated on callback
3. **Token Storage**: Refresh tokens stored in database, not client
4. **Service Role**: Database access uses server-side service role key

---

## Related Files

- `lib/auth.ts` - Auth utilities and session management
- `lib/eve-sso.ts` - SSO helper functions
- `types/auth.ts` - TypeScript types
- `app/api/auth/eve/login/route.ts` - Login route
- `app/api/auth/eve/add-alt/route.ts` - Add alt route
- `app/api/auth/eve/callback/route.ts` - Callback route
- `app/api/auth/session/route.ts` - Session route
- `app/api/auth/logout/route.ts` - Logout route
- `app/api/characters/route.ts` - Character management
- `components/auth-gate.tsx` - Auth gate component
