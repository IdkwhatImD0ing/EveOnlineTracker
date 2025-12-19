# Admin Dashboard

Administrator interface for managing user roles and access permissions.

## Overview

The Admin Dashboard provides a centralized interface for administrators to manage user accounts and their access levels. Only users with the `admin` role can access this page.

## Access

- **URL:** `/admin`
- **Required Role:** `admin`

## Features

### User Management

The dashboard displays all registered users in a table with the following columns:

| Column | Description |
|--------|-------------|
| Character | User's main character name with portrait |
| Role | Current role with dropdown to change |
| Created | When the user first registered |
| Updated | When the user's record was last modified |

### Role Statistics

A summary bar at the top shows the count of users in each role:

- **Public** - Pending approval
- **Slyce** - Alliance members (auto-approved)
- **User** - Manually approved users
- **Pro** - Premium access users
- **Admin** - Full admin access

### Changing User Roles

1. Find the user in the table
2. Click the role dropdown
3. Select the new role
4. Changes are applied immediately

**Note:** Administrators cannot change their own role to prevent accidental lockout.

## User Roles

| Role | Description | Auto-assigned | App Access |
|------|-------------|---------------|------------|
| `public` | New user, not in Slyce alliance | Yes | Pending |
| `slyce` | Member of Slyce alliance | Yes | Restricted* |
| `user` | Manually approved by admin | No | Restricted* |
| `pro` | Premium features | No | Restricted* |
| `admin` | Full access including admin dashboard | No | Full |

*Currently, all pages except admin dashboard are restricted to admin-only. This will be expanded in future updates.

## API Endpoints

### GET /api/admin/users

Returns all users with their roles.

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "main_character_id": 12345678,
      "main_character_name": "Character Name",
      "role": "user",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### PATCH /api/admin/users

Updates a user's role.

**Request Body:**
```json
{
  "user_id": "uuid",
  "role": "user"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "main_character_id": 12345678,
    "main_character_name": "Character Name",
    "role": "user",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

## Role Assignment Logic

When a new user registers:

1. System fetches character's corporation from ESI
2. System fetches corporation's alliance from ESI
3. If alliance ID matches `SLYCE_ALLIANCE_ID` environment variable → assign `slyce` role
4. Otherwise → assign `public` role

## Environment Variables

```env
# Slyce alliance ID for auto-approval
# Find via ESI or zkillboard
SLYCE_ALLIANCE_ID=99001090
```

## Related Files

- `app/(authenticated)/admin/page.tsx` - Admin dashboard UI
- `app/api/admin/users/route.ts` - Admin API endpoints
- `lib/auth.ts` - Role assignment logic
- `lib/config.ts` - Alliance ID configuration
- `types/auth.ts` - Role type definitions
- `components/auth-gate.tsx` - Access control component

## Security

- All admin endpoints verify the requesting user has `admin` role
- Admins cannot modify their own role
- Role changes are logged to the console
- Uses server-side authentication (no client-side role checking for API access)

