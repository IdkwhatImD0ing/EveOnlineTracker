# Market API

Endpoints for market analysis and opportunity detection.

## Overview

The Market API provides analysis tools for identifying profitable trading opportunities in the EVE Online market, currently focused on Jita (The Forge region).

## Endpoints

### GET /api/market/opportunities

Analyzes market history to find undervalued items with high potential for profit using mean reversion analysis.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 50 | Maximum number of results to return |
| min_price | number | 1000 | Minimum current price in ISK |
| min_volume | number | 10 | Minimum average daily trading volume |
| max_volatility | number | 0.5 | Maximum price volatility (std dev / mean) |
| z_threshold | number | -1.5 | Z-score threshold for undervaluation |

**Example Request:**

```http
GET /api/market/opportunities?limit=25&min_price=10000&z_threshold=-2.0
```

**Success Response (200):**

```json
{
  "success": true,
  "opportunities": [
    {
      "typeId": 34,
      "itemName": "Tritanium",
      "currentPrice": 3.50,
      "avgPrice30d": 4.20,
      "zScore": -1.87,
      "potentialGain": 20.0,
      "dailyVolume": 5000000,
      "opportunityScore": 245.67,
      "confidence": "medium",
      "volatility": 0.15,
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
  "filters": {
    "min_price": 1000,
    "min_volume": 10,
    "max_volatility": 0.5,
    "z_threshold": -1.5,
    "lookback_days": 30
  },
  "timing": {
    "total_ms": 15234
  },
  "generated_at": "2025-12-10T12:00:00.000Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| opportunities | array | List of market opportunities, sorted by score |
| summary | object | Statistics about the analysis |
| filters | object | Applied filter parameters |
| timing | object | Performance metrics |
| generated_at | string | ISO timestamp of when analysis was performed |

**Opportunity Object:**

| Field | Type | Description |
|-------|------|-------------|
| typeId | number | EVE type ID |
| itemName | string | Item name |
| currentPrice | number | Current lowest sell price from ESI |
| avgPrice30d | number | 30-day average price |
| zScore | number | Standard deviations below average (negative = undervalued) |
| potentialGain | number | Expected profit % if price reverts to mean |
| dailyVolume | number | Average daily trading volume |
| opportunityScore | number | Combined ranking score |
| confidence | string | "high", "medium", or "low" |
| volatility | number | Price volatility coefficient |
| momentum | number | 7-day price trend |

**Error Response (500):**

```json
{
  "error": "Failed to fetch market history: [error details]",
  "timing": {
    "total_ms": 1234
  }
}
```

## Algorithm Details

### Mean Reversion Strategy

The algorithm identifies items trading significantly below their historical average, based on the principle that prices tend to revert to their mean over time.

### Key Metrics

#### Z-Score

Measures how many standard deviations the current price is from the 30-day average:

```
Z-Score = (current_price - mean_30d) / std_dev_30d
```

Interpretation:
- Z > 0: Trading above average
- Z < -1.0: Slightly below average  
- Z < -1.5: Significantly below average (default threshold)
- Z < -2.5: Extremely below average (high confidence)

#### Opportunity Score

Combined ranking score weighing multiple factors:

```
Score = ((Gain × Volume × Momentum) / Risk) + Z-Score Bonus
```

Components:
- **Gain**: Potential profit percentage
- **Volume**: Liquidity factor (0-10)
- **Momentum**: Trend factor (0.5-1.5)
- **Risk**: Volatility factor (1-3)
- **Z-Score Bonus**: Extra points for deeply undervalued items

### Confidence Levels

| Level | Z-Score | Description |
|-------|---------|-------------|
| high | ≤ -2.5 | Extremely undervalued |
| medium | ≤ -1.5 | Significantly undervalued |
| low | ≤ -1.0 | Slightly undervalued |

## Data Sources

### Historical Data

- **Source**: `market_history` table in Supabase
- **Region**: The Forge (10000002) / Jita
- **Coverage**: Last 30 days
- **Update**: Weekly via `/api/esi/market-history` cron job

### Current Prices

- **Source**: ESI public market orders
- **Endpoint**: `GET /markets/10000002/orders/?type_id={type_id}&order_type=sell`
- **Processing**: Extracts lowest sell price per item
- **Rate Limiting**: 20 concurrent requests with 100ms delays

## Performance

The endpoint performs multiple operations:

1. Query Supabase for 30-day market history
2. Calculate statistics for each item
3. Filter by criteria (volume, volatility, price)
4. Fetch current prices from ESI (batched)
5. Calculate opportunity scores
6. Sort and return top results

Typical response time: 10-30 seconds depending on market data size.

## Caching

No caching is implemented at the API level. Each request performs fresh analysis with current ESI prices.

For better performance, consider:
- Using smaller `limit` values
- Increasing `min_volume` to reduce candidates
- Calling during off-peak hours

## Related

- [Market Opportunities Page](../pages/market-opportunities.md) - UI documentation
- [ESI API Documentation](./esi.md) - Market history endpoint
- [EVE ESI Integration](../integrations/eve-esi.md) - ESI details

## Source Files

- `app/api/market/opportunities/route.ts` - API endpoint
- `lib/market-analysis.ts` - Algorithm implementation

