# Dashboard Page

The Dashboard is the main landing page showing account overview and quick links to all features.

## Overview

**Path:** `/`

**Purpose:** Central hub providing account info and navigation to all app features.

## Layout

### Sidebar Navigation

The app uses a collapsible sidebar for navigation:

| Link | Path | Description |
|------|------|-------------|
| Dashboard | `/` | This page |
| Market Seeder | `/market-seeder` | Import profit analyzer |
| Jita Opportunities | `/jita-opportunities` | Sell timing + market opportunities |
| Projects | `/projects` | Manufacturing tracker |
| Industry | `/industry` | Blueprint calculator |
| EVE SSO | `/callback` | Login & API tokens |

The sidebar:
- Shows character portrait if logged in
- Remembers collapsed/expanded state
- Highlights active page

### Character Card

When logged in via EVE SSO:
- Character portrait (128px from EVE image server)
- Character name
- Character ID
- Link to manage tokens

When not logged in:
- Prompt to connect EVE account
- Login button

### Quick Stats

Three stat cards showing:
- **Total Projects**: Count of all manufacturing projects
- **This Week**: Projects created in last 7 days
- **Days Market Data**: Market history coverage (365 days)

### Feature Cards

Grid of feature cards with:
- Icon with gradient background
- Title and description
- Click to navigate

Features:
1. **Market Seeder** - Find profitable imports
2. **Projects** - Manufacturing tracker
3. **Industry Calculator** - Blueprint materials
4. **Jita Opportunities** - Sell timing + market opportunity discovery

## Data Sources

- **Character Info**: Parsed from EVE SSO JWT token (stored in localStorage)
- **Project Stats**: Fetched from `/api/projects` endpoint
- **Wallet Balance**: Fetched from `/api/esi/wallet` endpoint
- **Market Orders**: Fetched from `/api/esi/character-orders` endpoint

## Authentication & Token Refresh

The dashboard implements automatic token refresh for ESI API calls:

1. **Token Validation**: Before each ESI API call, the access token is checked for expiration
2. **Automatic Refresh**: If the token expires (or will expire within 60 seconds), it's automatically refreshed using the stored refresh token
3. **Session Continuity**: New tokens are saved to localStorage and component state is updated seamlessly
4. **Graceful Degradation**: If refresh fails, the user is logged out and prompted to re-authenticate

This ensures ESI data (wallet, orders) remains accessible even during long browsing sessions without requiring manual re-login.

## Related

- [Sidebar Component](../components/sidebar.md)
- [Projects Page](./projects.md)
- [Market Seeder Page](./market-seeder.md)

