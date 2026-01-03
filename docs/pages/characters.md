# Characters Page

## Overview

The Characters page (`/characters`) allows users to manage their linked EVE Online characters, view detailed ESI information, and configure permissions. This is the central hub for multi-account management.

## Features

### Character Management
- View all linked characters (main + alts)
- Set any character as the main character
- Add new alt characters via EVE SSO
- Remove alt characters from the account
- Request full ESI access for limited characters

### Character Details

For each character, the page displays:

| Field | Description | Requires Full Access |
|-------|-------------|---------------------|
| Portrait | Character portrait with online indicator | No |
| Name | Character name with main badge if applicable | No |
| Corporation/Alliance | Current corp and alliance membership | No |
| Scope Level | Full Access or Limited Access badge | No |
| Wallet Balance | Current ISK balance (formatted) | Yes |
| Skill Points | Total SP (formatted) | Yes |
| Location | Current solar system | Yes |
| Online Status | Online/Offline indicator | Yes |
| Current Training | Skill being trained + time remaining | Yes |

### Summary Statistics

The page shows aggregate statistics:
- Total number of linked characters
- Count of Full Access characters
- Count of Limited Access characters
- Number of alt characters
- **Total Wallet Balance** (sum across all characters)
- **Total Skill Points** (sum across all characters)

## Permission Levels

### Full Access
- Includes 60+ ESI scopes
- Required for wallet, orders, assets, undercut checking, skills, location, and other advanced features
- Characters are added with full access by default during initial login

### Limited Access
- Minimal 4 scopes for structure market access only
- Alt characters added with limited access by default
- Can be upgraded to full access via the upgrade button

## API Endpoints

### GET /api/characters
Returns basic character list for the authenticated user.

**Response:**
```json
{
  "characters": [
    {
      "id": "uuid",
      "character_id": 12345678,
      "character_name": "Pilot Name",
      "is_main": true,
      "scope_level": "full",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/characters/details
Fetches detailed ESI information for all characters.

**Response:**
```json
{
  "characters": [
    {
      "character_id": 12345678,
      "character_name": "Pilot Name",
      "wallet_balance": 1234567890.50,
      "wallet_balance_formatted": "1.23B",
      "total_sp": 45000000,
      "total_sp_formatted": "45.0M SP",
      "unallocated_sp": 500000,
      "current_training": {
        "skill_name": "Gunnery V",
        "finish_date": "2025-01-15T12:00:00Z",
        "time_remaining": "2d 4h"
      },
      "online": false,
      "last_login": "2025-01-10T18:30:00Z",
      "last_logout": "2025-01-10T22:15:00Z",
      "solar_system_id": 30000142,
      "solar_system_name": "Jita",
      "corporation_id": 98000001,
      "corporation_name": "Example Corp",
      "alliance_id": 99000001,
      "alliance_name": "Example Alliance",
      "requires_full_access": false,
      "errors": []
    }
  ],
  "totals": {
    "wallet_balance": 5000000000,
    "wallet_balance_formatted": "5.00B",
    "total_sp": 150000000,
    "total_sp_formatted": "150.0M SP"
  }
}
```

### POST /api/characters/{id}/main
Sets a character as the user's main character.

### DELETE /api/characters
Removes an alt character from the account.

**Request Body:**
```json
{
  "character_id": 12345678
}
```

## ESI Endpoints Used

The details endpoint fetches data from the following ESI endpoints:

| Data | ESI Endpoint | Auth Required |
|------|-------------|---------------|
| Character Info | `GET /characters/{id}/` | No |
| Corporation | `GET /corporations/{id}/` | No |
| Alliance | `GET /alliances/{id}/` | No |
| Wallet | `GET /characters/{id}/wallet/` | Yes |
| Skills | `GET /characters/{id}/skills/` | Yes |
| Skill Queue | `GET /characters/{id}/skillqueue/` | Yes |
| Online Status | `GET /characters/{id}/online/` | Yes |
| Location | `GET /characters/{id}/location/` | Yes |
| Solar System | `GET /universe/systems/{id}/` | No |
| Type Names | `GET /universe/types/{id}/` | No |

## UI Components

### CharacterCard
The main component for displaying character information. Features:
- Character portrait with online indicator overlay
- Responsive grid layout for details
- Loading skeletons while fetching ESI data
- Graceful degradation for limited access characters
- Action buttons: Set Main, Request Full Access, Delete

### Summary Cards
- Character count statistics (top row)
- Total wallet and SP summaries (below stats, only shown when data loaded)

## Error Handling

- Characters with failed token refresh show "Token refresh failed" error
- Limited access characters show "Upgrade" text for unavailable fields
- ESI errors are collected but don't prevent the page from loading
- Individual character failures don't affect other characters

## Data Flow

```
Page Load
    │
    ├──► GET /api/characters (fast, basic data)
    │         │
    │         ▼
    │    Render basic cards with loading skeletons
    │
    └──► GET /api/characters/details (slower, ESI calls)
              │
              ▼
         Update cards with wallet, SP, location, etc.
```

The two-phase loading approach ensures:
1. Fast initial page render with basic character info
2. Progressive enhancement as ESI data loads
3. No blocking on slow ESI responses

