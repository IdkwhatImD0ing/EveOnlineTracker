# Market Opportunities Page

Analyzes Jita market data to identify undervalued items with high ISK profit potential using multi-signal analysis.

## Overview

The Market Opportunities page uses a combined multi-signal analysis system to find items that:
1. Are trading **below their historical average** (undervalued)
2. Show positive signals across cycle, trend, support, and volume indicators
3. Have **significant ISK profit potential** (not just high percentage gains)

The algorithm balances signal quality (50%) with absolute ISK profit potential (50%), ensuring you see opportunities that can actually make meaningful profits.

## Access

Navigate to `/market/opportunities` from the main application.

## Features

### Real-time Streaming Analysis

- **Progress Bar**: Shows real-time progress during analysis with stage breakdowns
- **Recalculate Button**: Fetches fresh ESI market prices and recalculates all opportunity scores
- **Server-Sent Events**: Streams progress updates as processing happens
- **Last Updated Timestamp**: Displays when data was last refreshed
- **Processing Time**: Shows how long the analysis took

### Configurable Filters

Adjust algorithm parameters via the Settings panel:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Min Price | 1,000 ISK | Exclude items below this price |
| Min Daily Volume | 10 units | Minimum average trading volume |
| Max Volatility | 0.5 | Maximum allowed price volatility (std dev / mean) |
| Min Signal Score | 20 | Minimum combined score (20=Marginal, 40=Good, 70=Excellent) |
| **Min Weekly ISK** | **1B/week** | **Minimum profit potential to display** |
| Max Results | 50 | Number of opportunities to display |

### ISK Profit Potential Filter

The most important filter for serious traders. Options:
- No minimum (show all)
- 10M+/week
- 100M+/week
- 500M+/week
- **1B+/week (default)** - Show only billion-ISK opportunities
- 5B+/week
- 10B+/week

### Expandable Results Table

All columns are sortable by clicking the header. Click any row to expand signal details:

| Column | Description |
|--------|-------------|
| Checkbox | Select items for Copy Buy Text feature |
| Item | Item name and type ID |
| Current Price | Lowest sell order price from ESI |
| Avg | Historical average price over 90 days |
| Gain | Expected % profit if price reverts to mean |
| **Weekly ISK** | **Estimated weekly profit potential (color-coded)** |
| Signals | Mini display of all 4 signal scores |
| Volume | Average daily trading volume |
| Trend | Price momentum indicator (rising/falling/stable) |
| Tier | Excellent/Good/Marginal based on combined score |
| Score | Combined opportunity ranking score |

**Weekly ISK Color Coding:**
- 🟢 Green: 1B+/week potential
- 🔵 Blue: 100M+/week potential
- ⚪ Gray: < 100M/week potential

### Search and Filtering

- Search by item name or type ID
- Filter by minimum score
- Filter by minimum potential gain %

### Copy Buy Text Feature

Select items using checkboxes and copy a shopping list for Eve Online's multibuy feature.

**Selection Controls:**
- Each row in the table has a checkbox on the left side
- "Select All" / "Deselect All" button at the top of the table
- Selection persists while browsing results

**Selection Action Bar:**
When items are selected, a sticky action bar appears showing:
- Number of selected items
- Budget input field in millions (default 100M) - set how much ISK to spend per item
- "Clear" button to deselect all
- "Copy Buy Text" button

**Copy Buy Text Button:**
Copies selected items to clipboard in Eve Online multibuy format:
```
Item Name 100
Another Item 50
Third Item 1
```

**Quantity Calculation:**
- Each item gets up to the configured budget worth of units
- Formula: `quantity = floor(budgetM * 1,000,000 / currentPrice)`
- Minimum quantity is always 1 (even if price exceeds budget)
- Default budget is 100M ISK per item (enter "100" for 100M)

## Scoring System

### Balanced Score Formula

The opportunity score combines two factors equally:

```
Opportunity Score = (Signal Score × 0.5) + (ISK Score × 0.5)
```

This ensures items need BOTH good signals AND good profit potential to rank highly.

### ISK Score Calculation

The ISK score uses a logarithmic scale to handle the wide range of item values:

```
Daily ISK Potential = Gain% × Current Price × Daily Volume
ISK Score = log10(Daily ISK / 1,000,000) × 20
```

| Daily ISK Potential | ISK Score |
|---------------------|-----------|
| 10M ISK/day | 20 points |
| 100M ISK/day | 40 points |
| 1B ISK/day | 60 points |
| 10B ISK/day | 80 points |

### Why This Matters

Consider two items:
- **Item A**: 50% gain, 10K ISK price, 100 volume = **500K ISK/day** (tiny profit)
- **Item B**: 5% gain, 10M ISK price, 200 volume = **100M ISK/day** (real money)

Item B is 200x more profitable despite having a lower percentage gain. The ISK score ensures Item B ranks higher.

## Multi-Signal Analysis System

The algorithm uses four independent signals that must agree for high-confidence opportunities.

### Signal 1: Cyclical Analysis (Max: ±30 points)

Detects repeating price patterns using autocorrelation at multiple lag periods (7, 14, 21, 28, 30, 45, 60 days).

**Scoring:**
- Strong cycle (>50% correlation) in "low phase": +30 points
- Strong cycle, rising from low: +21 points  
- Weak cycle in low phase: +18 points
- No clear cycle: 0 points
- High phase (likely to drop): -21 points

### Signal 2: Trend Analysis (Max: ±25 points)

Uses 7-day and 30-day Simple Moving Averages (SMA) to detect trend direction and reversals.

**Scoring:**
- Bullish crossover (SMA7 crosses above SMA30): +25 points
- Uptrend with positive momentum: +20 points
- Sideways with positive momentum: +8 points
- Downtrend: -25 points (avoid catching falling knives)
- Bearish crossover: -25 points

### Signal 3: Support Level Detection (Max: ±25 points)

Finds historical price floors by clustering local minima within 5% of each other.

**Scoring:**
- Near strong support (3+ bounces): +25 points
- Near moderate support (2 bounces): +10 points
- Support exists below current price: +8 points
- Below all historical supports: -15 points (uncharted territory)

### Signal 4: Volume-Price Analysis (Max: ±20 points)

Analyzes accumulation/distribution patterns by comparing volume at low vs high prices.

**Scoring:**
- Accumulation pattern (high volume at lows): +20 points
- Rising OBV with flat price (hidden buying): +10 points
- Distribution pattern (selling): -20 points
- Normal volume: 0 points

### Opportunity Tiers

| Tier | Score Range | Meaning |
|------|-------------|---------|
| Excellent | 70+ | Strong signals AND high ISK potential |
| Good | 40-69 | Moderate confidence, decent profit potential |
| Marginal | 20-39 | Speculative, one or two factors weak |
| Skip | <20 | Not enough confidence or profit potential |

## Automatic Filters

The algorithm automatically rejects items that:

1. **Trade above average price** - Only shows items trading BELOW their historical mean (no negative gains)
2. **Have < 1M ISK/day potential** - Eliminates tiny profit opportunities
3. **Have < 30 days of history** - Requires sufficient data for reliable signals
4. **Fail minimum score threshold** - Filters based on combined score

## Data Sources

### Historical Data

- **Source**: `market_history` table in Supabase
- **Coverage**: Uses 90 days for signal analysis
- **Update Frequency**: Updated via cron job (see ESI docs)
- **Region**: The Forge (Jita) - Region ID 10000002

### Database Functions

For optimal performance, run these migrations:

```sql
-- Run in Supabase SQL Editor
\i migrations/005_market_statistics_function.sql  -- Basic stats
\i migrations/007_market_history_arrays_function.sql  -- Full signal analysis
```

Migration 007 creates a function that returns price/volume arrays for each item, enabling full signal analysis. Without it, the API falls back to migration 005 (basic analysis only).

### Current Prices

- **Source**: ESI public market orders endpoint
- **Endpoint**: `GET /markets/10000002/orders/?type_id={type_id}&order_type=sell`
- **Processing**: Extracts lowest sell order price
- **Rate Limiting**: 50 concurrent requests with 50ms batch delays

## API Endpoint

### GET /api/market/opportunities

Returns ranked market opportunities with signal breakdowns and ISK potential.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Max results to return |
| min_price | number | 1000 | Minimum current price |
| min_volume | number | 10 | Minimum daily volume |
| max_volatility | number | 0.5 | Maximum volatility |
| min_score | number | 20 | Minimum combined score |
| **min_weekly_isk** | number | 0 | **Minimum weekly ISK potential (e.g., 1000000000 for 1B)** |
| stream | boolean | false | Enable SSE streaming mode |

**Response (stream=false):**

```json
{
  "success": true,
  "opportunities": [
    {
      "typeId": 34,
      "itemName": "Tritanium",
      "currentPrice": 3.50,
      "avgPrice": 4.20,
      "dailyVolume": 5000000,
      "volatility": 0.15,
      "dailyIskPotential": 1000000000,
      "weeklyIskPotential": 7000000000,
      "iskScore": 60,
      "signals": {
        "cycle": { "score": 25, "reason": "In low phase of 14-day cycle", "confidence": 0.62 },
        "trend": { "score": 15, "reason": "Uptrend with positive momentum", "confidence": 0.71 },
        "support": { "score": 20, "reason": "Near support at 3.40 (4 bounces)", "confidence": 0.85 },
        "volume": { "score": 10, "reason": "Accumulation pattern detected", "confidence": 0.55 },
        "totalScore": 65,
        "tier": "good"
      },
      "zScore": -1.87,
      "potentialGain": 20.0,
      "opportunityScore": 65,
      "confidence": "medium",
      "momentum": 0.02
    }
  ],
  "summary": {
    "total_items_analyzed": 5842,
    "items_after_filters": 1234,
    "items_with_current_price": 500,
    "opportunities_found": 47,
    "results_returned": 47
  },
  "scoring": {
    "tiers": { "EXCELLENT": 70, "GOOD": 40, "MARGINAL": 20 },
    "weights": { "CYCLE": 30, "TREND": 25, "SUPPORT": 25, "VOLUME": 20 }
  },
  "timing": { "total_ms": 15234 },
  "generated_at": "2025-12-10T12:00:00.000Z"
}
```

**Streaming Mode (stream=true):**

Returns Server-Sent Events:

```
event: progress
data: {"stage":"stats","message":"Fetching market history... 5/30","percent":25}

event: progress  
data: {"stage":"prices","message":"Fetching prices... 250/500","percent":80}

event: complete
data: {"success":true,"opportunities":[...],...}
```

## Risk Considerations

⚠️ **Important Disclaimers:**

1. **Past patterns don't guarantee future results** - Historical cycles may not repeat
2. **Game patches can permanently change values** - Items nerfed/buffed won't revert
3. **Market manipulation risk** - Low-volume items can be manipulated
4. **External factors** - Events, meta changes, or speculation affects prices
5. **Liquidity risk** - Items may be hard to sell if market conditions change
6. **Can't capture 100% of volume** - Weekly ISK is theoretical max, actual capture is lower

### Built-in Safeguards

The algorithm includes several risk mitigation features:

- **Price below average only**: Rejects items trading above their historical mean
- **Multi-signal agreement**: Requires multiple independent indicators to agree
- **ISK potential threshold**: Filters out tiny profit opportunities
- **Minimum volume filter**: Excludes illiquid items
- **Volatility cap**: Avoids highly unstable items  
- **Data quality checks**: Requires minimum 30 days of historical data
- **Tier classification**: Clearly indicates signal strength
- **Trend filter**: Penalizes items in downtrends (avoid falling knives)

## Related Files

- `lib/market-analysis.ts` - Core algorithm implementation (signal functions, ISK scoring)
- `app/api/market/opportunities/route.ts` - API endpoint with SSE support
- `app/market/opportunities/page.tsx` - UI page with ISK filters
- `components/market/opportunity-table.tsx` - Results table with signal breakdown and Weekly ISK column

## See Also

- [ESI API Documentation](../api/esi.md)
- [EVE ESI Integration](../integrations/eve-esi.md)
- [Database Schema](../database/schema.md) - `market_history` table
