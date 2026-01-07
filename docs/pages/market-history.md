# Market History Page

The Market History page visualizes price and volume history for items across three regions: Jita (The Forge), Vale of the Silent, and Deklein.

## Overview

**Path:** `/market-history`

**Purpose:** Compare market prices and trading volumes across multiple regions to identify arbitrage opportunities and understand regional market dynamics.

## Features

### Item Search
- Search for any tradeable item using the autocomplete search bar
- Type at least 2 characters to see search results
- Click an item to load its market history chart

### Time Periods

| Period | Description |
|--------|-------------|
| 7D | Last 7 days |
| 30D | Last 30 days (default) |
| 90D | Last 90 days |
| All | Full available history (up to 2 years) |

### Region Comparison

The chart displays overlaid price lines for three regions:

| Region | Color | Description |
|--------|-------|-------------|
| Jita (The Forge) | Cyan (#22d3ee) | Major high-sec trade hub |
| Vale of the Silent | Amber (#f59e0b) | Alliance null-sec territory |
| Deklein | Emerald (#10b981) | Null-sec region |

Click the region toggle buttons to show/hide individual region lines.

### Price Chart

- Line chart showing daily average prices
- Hover over the chart to see exact values for each region
- Y-axis shows price in ISK (automatically scaled with K/M/B suffixes)
- X-axis shows dates

### Volume Chart

- Stacked bar chart showing daily trading volume per region
- Located below the price chart
- Helps identify trading activity patterns

### Summary Stats

Below the chart, summary statistics are displayed for each enabled region:
- Mean price over the selected period
- Average daily volume

## UI Design

The page follows EVE Online's dark market UI aesthetic:
- Dark background (#0f1218, #1a1f2e)
- Cyan accent color for Jita/primary elements
- Subtle borders (#2a3142)
- Clean, minimal design focusing on data visualization

## Data Sources

### Market History Database

Market history data is stored in the `market_history` table and updated daily via cron job. The table stores:
- Daily average price
- Daily high/low prices
- Daily volume
- Order count

### RPC Function

The `get_market_history_arrays` RPC function fetches market history data efficiently, returning arrays of prices, volumes, highs, and lows for charting.

## API Endpoint

**GET /api/market-history/chart**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type_id | number | Yes | EVE item type ID |
| days | string | No | Time period: '7', '30', '90', or 'all' (default: '30') |

**Response:**

```json
{
  "typeId": 2048,
  "typeName": "Damage Control II",
  "days": 30,
  "regions": [
    {
      "regionId": 10000002,
      "regionName": "The Forge",
      "shortName": "Jita",
      "color": "#22d3ee",
      "dates": ["2024-01-01", "2024-01-02", ...],
      "prices": [450000, 452000, ...],
      "volumes": [25000, 23000, ...],
      "highs": [460000, 458000, ...],
      "lows": [445000, 447000, ...],
      "dataPoints": 30,
      "meanPrice": 451000,
      "avgVolume": 24000
    }
  ],
  "summary": {
    "jitaLatestPrice": 452000,
    "jitaAvgVolume": 24000,
    "valeAvgVolume": 500,
    "dekleinAvgVolume": 300
  }
}
```

## Component Architecture

### Files

```
app/(authenticated)/market-history/
└── page.tsx                    # Main page component

components/market-history/
├── index.ts                    # Barrel exports
└── market-history-chart.tsx    # SVG chart component

app/api/market-history/chart/
└── route.ts                    # API endpoint
```

### MarketHistoryChart Component

Props:
- `regions` - Array of region data with prices/volumes
- `typeName` - Display name for the item
- `days` - Selected time period
- `enabledRegions` - Set of region IDs to display
- `onToggleRegion` - Callback to toggle region visibility

Features:
- Custom SVG-based line chart
- Interactive hover tooltips
- Stacked volume bars
- Region toggle buttons
- Responsive design

## Requirements

### Authentication

Requires EVE SSO login (standard authenticated page access).

### Data Availability

Market history data availability depends on:
- Daily cron job updates
- Item must have trading activity in the selected region
- Minimum 30 days of data for RPC function to return results

## Usage Flow

1. Navigate to `/market-history` from the sidebar
2. Use the search bar to find an item
3. Click the item to load its chart
4. Use time period tabs to adjust the date range
5. Toggle regions on/off using the colored buttons
6. Hover over the chart to see exact values

## Related

- [Market Seeder Page](./market-seeder.md) - Find profitable imports
- [Jita Opportunities](./jita-opportunities.md) - Market opportunity discovery

