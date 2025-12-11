# Sell Opportunities Page

Analyze your character's assets to identify optimal sell timing based on historical price data.

## Overview

The Sell Opportunities page helps traders identify when items are near their all-time high prices, making it a good time to sell. It compares current Jita sell prices against historical market data to calculate what percentage of all-time high (ATH) each item is currently at.

## URL

```
/jita-opportunities?tab=sell
```

### Legacy Route Redirect

`/sell-opportunities` still works but redirects to `/jita-opportunities?tab=sell`.

## Prerequisites

- **EVE SSO Login** — Required to access character assets
- **Assets Scope** — The `esi-assets.read_assets.v1` scope is requested during login
- **Market History Data** — Historical data must be populated in the `market_history` table

## Features

### Asset Loading

- Fetches all character assets from EVE ESI
- Aggregates quantities by item type
- Resolves type names from local data files

### Price Analysis

- Gets current Jita sell prices via Janice API
- Queries historical all-time high from `market_history` table
- Calculates percentage of ATH for each item

### Color-Coded Recommendations

| Recommendation | % of ATH | Color | Description |
|----------------|----------|-------|-------------|
| Sell | >= 80% | Green | Good time to sell - near all-time high |
| Hold | 60-79% | Orange | Consider holding - moderate pricing |
| Wait | < 60% | Red | Wait for better prices |

### Summary Cards

The page displays four summary cards:

1. **Sell Now** — Count and total ISK value of items recommended to sell
2. **Hold** — Count of items in the hold category
3. **Wait** — Count of items to wait on
4. **Total Value** — Combined ISK value of all assets

### Filtering

Filter buttons allow viewing specific categories:

- **All** — Show all items
- **Sell** — Show only items recommended to sell
- **Hold** — Show only items to hold
- **Wait** — Show only items to wait on

### Sorting

Clickable column headers allow sorting by:

- **Item Name** — Alphabetical order
- **Quantity** — Number of items owned
- **% of ATH** — Percentage of all-time high (default: descending)
- **Value** — Total ISK value

## User Flow

```
┌─────────────────────────────────────────────────────┐
│                 Sell Opportunities                   │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Check EVE SSO Login  │
              └───────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│   Not Logged In │             │    Logged In    │
│  Show Login CTA │             │                 │
└─────────────────┘             └─────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │   Fetch Assets from   │
                              │   /api/esi/assets     │
                              └───────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  Analyze via          │
                              │  /api/sell-opportunities│
                              └───────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  Display Results      │
                              │  with Color Coding    │
                              └───────────────────────┘
```

## Data Display

### Table Columns

| Column | Description |
|--------|-------------|
| Item | Item name and type ID |
| Qty | Total quantity across all locations |
| Current Price | Current Jita sell price per unit |
| ATH | All-time high price from historical data |
| % of ATH | Current price as percentage of ATH |
| Value | Total ISK value (price × quantity) |
| Action | Recommendation badge (SELL/HOLD/WAIT) |

### Row Styling

Rows are color-coded based on recommendation:

- **Green background** — Sell recommendation
- **Orange background** — Hold recommendation
- **Red background** — Wait recommendation

## API Dependencies

This page relies on two API endpoints:

### GET /api/esi/character-assets

Fetches and aggregates character assets from EVE ESI.

**Request:**
- Requires `Authorization: Bearer <token>` header

**Response:**
```json
{
  "character_id": 123456789,
  "total_unique_types": 245,
  "assets": [
    {
      "type_id": 34,
      "type_name": "Tritanium",
      "total_quantity": 50000000
    }
  ]
}
```

### POST /api/sell-opportunities

Analyzes assets against historical market data.

**Request:**
```json
{
  "assets": [
    { "type_id": 34, "type_name": "Tritanium", "quantity": 50000000 }
  ]
}
```

**Response:**
```json
{
  "opportunities": [
    {
      "type_id": 34,
      "type_name": "Tritanium",
      "quantity": 50000000,
      "current_sell_price": 5.85,
      "all_time_high": 6.50,
      "percent_of_ath": 90,
      "total_value": 292500000,
      "recommendation": "sell",
      "recommendation_text": "Good time to sell - near all-time high"
    }
  ],
  "summary": {
    "total_items": 1,
    "sell_now_count": 1,
    "total_value": 292500000
  }
}
```

## Edge Cases

### No Historical Data

If an item has no historical data in `market_history`:

- ATH shows as "-"
- If current price exists, % of ATH shows as 100%
- Item is categorized as "sell" (assume it's at peak)

### No Current Price

If Janice API doesn't return a price for an item:

- Current price shows as 0
- % of ATH shows as 0%
- Item is categorized as "wait"

### Empty Assets

If the character has no assets:

- Shows "No Assets Found" message
- Suggests clicking refresh to retry

## Related Files

- `app/sell-opportunities/page.tsx` — Page component
- `app/api/esi/character-assets/route.ts` — Assets API endpoint
- `app/api/sell-opportunities/route.ts` — Analysis API endpoint
- `lib/janice.ts` — Janice API client for current prices
- `utils/supabase/server.ts` — Supabase client for market history

## See Also

- [ESI API Documentation](../api/esi.md) — Character assets and sell opportunities endpoints
- [Database Schema](../database/schema.md) — market_history table structure
- [Janice API Integration](../integrations/janice-api.md) — Current price fetching

