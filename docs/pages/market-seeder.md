# Market Seeder Page

The Market Seeder page helps identify the most profitable items to import from Jita to your alliance market hub.

## Overview

**Path:** `/market-seeder`

**Purpose:** Analyze market data to find items with the best profit margins for import.

## Features

### Configuration Panel

- **Structure ID**: Your alliance market hub structure ID (saved to localStorage)
- **Transport Cost**: ISK per m³ for Jump Freighter shipping (default: 450)
- **Advanced Settings**:
  - Minimum profit margin %
  - Minimum profit per unit ISK

### Analysis Results

The page displays multiple ranked lists:

| Tab | Description |
|-----|-------------|
| Top Items | Best overall items by composite profitability score |
| No Competition | Items with no existing sell orders (40% markup opportunity) |
| Best ISK/m³ | Most profitable items per cargo space |
| Trending Up | Items with increasing Jita demand |
| Modules | Top modules by category |
| Ships | Top ships by category |
| Ammo | Top ammunition by category |
| Boosters | Top boosters by category |

### Item Cards

Each item shows:
- Item name with category icon
- Competition status badge
- Profit margin percentage
- Profit per unit
- Composite score

Clicking an item expands to show:
- Jita buy price
- Transport cost
- Target sell price
- Profit per m³
- Volume
- Jita daily volume
- Category and group

## Scoring Algorithm

Items are ranked by a **volume-weighted composite score** that balances profitability with realistic sellability.

### Base Score Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Profit Margin % | 25% | Higher margins = better capital efficiency |
| Profit per m³ | 30% | Transport efficiency (ISK per cargo space) |
| Jita Demand | 25% | Higher Jita volume = more potential buyers |
| Absolute Profit | 20% | Raw ISK profit per unit |
| No Competition Bonus | +15 | Bonus for items with no existing orders |

### Volume Multiplier

The base score is multiplied by `sqrt(avgDailyVolume)` to heavily favor high-volume items:

```
finalScore = baseScore × sqrt(avgDailyVolume)
```

This ensures rare expensive items (like officer modules selling 1/day) don't outrank common items that will actually sell in your market hub.

| Daily Volume | Multiplier | Example Items |
|--------------|------------|---------------|
| 10 units/day | 3.2x | Faction modules |
| 100 units/day | 10x | Popular T2 modules |
| 1,000 units/day | 31.6x | Common ships, ammo |

### Minimum Filters

Items must meet these thresholds to appear:

| Filter | Value |
|--------|-------|
| Jita Daily Volume | ≥ 10 units/day |
| Profit Margin | ≥ 10% |
| Profit per Unit | ≥ 100,000 ISK |
| Jita Price | ≥ 10,000 ISK |

## Requirements

### Authentication

Requires EVE SSO login with scope:
- `esi-markets.structure_markets.v1`

### Data Sources

- **Jita Market History**: 365 days cached in Supabase (via RPC batches, daily updates)
- **Structure Orders**: Real-time from ESI (authenticated)
- **Jita Prices**: Real-time from ESI regional orders (public API)

## Progress Tracking

The analysis uses Server-Sent Events (SSE) to show real-time progress:

| Stage | Description |
|-------|-------------|
| Loading | Loading ~5,800 tradeable items from file |
| Market History | Fetching demand metrics via RPC batches (30 batches) |
| Structure Orders | Fetching orders from your alliance hub |
| Jita Prices | Fetching current Jita sell prices (~290 ESI batches) |
| Analyzing | Computing profit metrics per item |
| Filtering | Applying minimum threshold filters |
| Scoring | Calculating composite profitability scores |
| Ranking | Generating sorted result lists |

## Usage Flow

1. **Login with EVE SSO** if not already authenticated
2. **Enter Structure ID** of your alliance market hub
3. **Set Transport Cost** (default 450 ISK/m³)
4. **Click "Run Analysis"** to fetch and analyze data
5. **Watch Progress Bar** as each stage completes
6. **Browse Results** using the tabs to find profitable items
7. **Click Items** to see detailed profit breakdown

## Performance

| Scenario | Typical Time |
|----------|--------------|
| Cold cache | 1-2 minutes |
| Warm cache (within 5 min) | 5-10 seconds |

The main bottleneck is fetching ~5,800 Jita prices from ESI (20 concurrent requests with rate limiting).

## Settings Persistence

All settings are saved to localStorage:
- `market-seeder-settings`: JSON object with structure_id, transportCost, minMargin, minProfit

## Related

- [Market Seeder API](../api/market-seeder.md) - Backend API documentation
- [ESI API](../api/esi.md) - Structure orders endpoint

