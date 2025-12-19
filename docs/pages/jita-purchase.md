# Jita Purchase Calculator

Calculate the total cost to purchase items from Jita by walking the sell order book.

## Overview

**Path:** `/jita-purchase`

**Purpose:** Given a list of items with quantities, calculate the exact cost to buy them from Jita by consuming sell orders from lowest to highest price until the required quantity is fulfilled.

**Required Role:** `slyce` or higher (slyce, user, pro, admin)

## Features

### Item Input

Paste a list of items with quantities in any of these formats:

```
# Space-separated (name + quantity)
Charred Micro Circuit 10692
Conductive Polymer 10692

# With 'x' prefix
Tritanium x1000000

# Tab-separated (EVE inventory export)
Tritanium    1000000    0.01 m3    Minerals
```

### Order Book Walking

For each item, the calculator:

1. Fetches all current sell orders from Jita (The Forge region) via ESI
2. Sorts orders by price ascending (cheapest first)
3. "Consumes" orders until the requested quantity is fulfilled
4. Tracks total cost, average price paid, and orders consumed

This gives an accurate estimate of what you'd actually pay if you bought immediately at current prices.

### Results Display

For each item:
- **Quantity Requested/Fulfilled**: Shows if the full quantity is available
- **Average Price**: Weighted average of prices paid across consumed orders
- **Total Cost**: Sum of (quantity × price) for each consumed order
- **Status**: Full, Partial, Unavailable, or Unknown

Summary cards show:
- Grand total cost
- Count of items by availability status

## Algorithm

```typescript
function calculatePurchaseCost(orders: Order[], quantity: number) {
  // Sort by price ascending (cheapest first)
  orders.sort((a, b) => a.price - b.price)
  
  let remaining = quantity
  let totalCost = 0
  
  for (const order of orders) {
    if (remaining <= 0) break
    const take = Math.min(remaining, order.volume_remain)
    totalCost += take * order.price
    remaining -= take
  }
  
  return {
    totalCost,
    fulfilled: quantity - remaining,
    avgPrice: totalCost / (quantity - remaining)
  }
}
```

## Use Cases

1. **Material Cost Estimation**: Calculate exact cost to buy materials for manufacturing
2. **Salvage Valuation**: Price check salvage materials before deciding to sell vs use
3. **Contract Pricing**: Determine fair buy prices for item contracts
4. **Arbitrage Analysis**: Compare buy cost against sell price in other locations

## API Endpoint

### POST /api/jita-purchase

Calculates purchase costs for a list of items.

**Request:**
```http
POST /api/jita-purchase
Content-Type: text/plain

Charred Micro Circuit 10692
Conductive Polymer 10692
Contaminated Lorentz Fluid 10692
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "typeId": 25594,
      "name": "Charred Micro Circuit",
      "quantityRequested": 10692,
      "quantityFulfilled": 10692,
      "quantityUnfulfilled": 0,
      "totalCost": 5346000,
      "avgPrice": 500,
      "lowestPrice": 450,
      "highestPricePaid": 520,
      "ordersConsumed": 3,
      "status": "full"
    }
  ],
  "summary": {
    "totalItems": 3,
    "fullyAvailable": 3,
    "partiallyAvailable": 0,
    "unavailable": 0,
    "unknownItems": 0,
    "grandTotalCost": 16038000,
    "grandTotalCostFormatted": "16.04M ISK"
  },
  "failures": [],
  "timing": {
    "parseMs": 5,
    "fetchMs": 1234,
    "totalMs": 1239
  }
}
```

**Item Status Values:**

| Status | Description |
|--------|-------------|
| `full` | Entire quantity available and priced |
| `partial` | Some quantity available, not all |
| `unavailable` | No sell orders exist for this item |
| `unknown` | Item name could not be resolved to type ID |

## Data Sources

- **Sell Orders**: ESI `/markets/10000002/orders/?type_id={type_id}&order_type=sell`
- **Item Resolution**: Local SDE data (`data/inv-types.json`)

## Limitations

1. **Real-time Prices**: Orders are fetched live; prices may change between calculation and actual purchase
2. **Minimum Volume**: Some orders have minimum volume requirements that aren't considered
3. **Station Location**: All Jita stations/structures are included, not just Jita 4-4

## Related Files

- `app/(authenticated)/jita-purchase/page.tsx` - Page component
- `app/api/jita-purchase/route.ts` - API endpoint
- `lib/permissions.ts` - Access control configuration

## See Also

- [EVE ESI Integration](../integrations/eve-esi.md) - ESI market order endpoints
- [Janice API Integration](../integrations/janice-api.md) - Alternative pricing via Janice

