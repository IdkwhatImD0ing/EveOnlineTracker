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

## Related

- [Sidebar Component](../components/sidebar.md)
- [Projects Page](./projects.md)
- [Market Seeder Page](./market-seeder.md)

