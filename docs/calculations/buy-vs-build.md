# Buy vs Build Analysis

How the application determines whether to buy or build intermediate components.

## Overview

When manufacturing complex items like capital ships, you need intermediate components. These components can be:

- **Built** from raw materials
- **Bought** from the market

The "Buy Mode" feature analyzes which option is cheaper for each component and adjusts material lists accordingly.

## The Decision

For each component, compare:

```
buildCost = materialCost + jobCost
buyCost = marketSellPrice × quantity

shouldBuy = buyCost < buildCost
```

### Build Cost Components

| Component | Description |
|-----------|-------------|
| `materialCost` | Sum of (material price × quantity) for all raw materials |
| `jobCost` | Manufacturing job installation cost |

### Buy Cost Components

| Component | Description |
|-----------|-------------|
| `marketSellPrice` | Jita sell price per unit (from Janice API) |
| `quantity` | Number of components needed |

## Calculation Flow

### During Industry Calculation

When `/api/industry/calculate` runs:

1. Calculate all materials recursively
2. For each component (intermediate item):
   - Calculate material cost (sum of material prices)
   - Calculate job cost
   - Sum as `buildCost`
3. Fetch market prices for components
4. Compare `buildCost` vs `sellPrice × quantity`
5. Store `shouldBuy`, `savings`, and `materialsBreakdown`

```typescript
// For each component
const shouldBuy = totalSellPrice > 0 && totalSellPrice < data.buildCost
const savings = shouldBuy 
  ? data.buildCost - totalSellPrice  // Savings from buying
  : totalSellPrice - data.buildCost  // Savings from building

return {
  typeId,
  name: data.name,
  quantity: data.quantity,
  buildCost: data.buildCost,
  shouldBuy,
  savings: Math.abs(savings),
  materialsBreakdown: Array.from(data.materialsBreakdown.values())
}
```

### In the UI

When "Buy Mode" is enabled:

1. Components marked `shouldBuy: true` display shopping cart icon
2. Components marked `shouldBuy: false` display hammer icon
3. Raw materials are adjusted by subtracting materials for "buy" components

```typescript
const adjustedMaterials = useMemo(() => {
  if (!showBuyRecommendations) return result?.materials || []

  // Create map of materials to subtract
  const materialsToSubtract = new Map<number, number>()
  
  for (const component of result.components) {
    if (component.shouldBuy && component.materialsBreakdown) {
      for (const mat of component.materialsBreakdown) {
        const current = materialsToSubtract.get(mat.typeId) || 0
        materialsToSubtract.set(mat.typeId, current + mat.quantity)
      }
    }
  }

  // Subtract from raw materials
  return result.materials
    .map(mat => {
      const subtractQty = materialsToSubtract.get(mat.typeId) || 0
      const newQty = Math.max(0, mat.quantity - subtractQty)
      
      if (newQty === 0) return null
      
      return { ...mat, quantity: newQty }
    })
    .filter(mat => mat !== null)
}, [result?.materials, result?.components, showBuyRecommendations])
```

## Example

### Scenario: Building a Chimera

**Component: Capital Armor Plates (100 units)**

Build Cost:
- Tritanium: 50,000,000 × 5.50 ISK = 275,000,000 ISK
- Pyerite: 12,500,000 × 9.00 ISK = 112,500,000 ISK
- ... (other materials)
- Job cost: 15,000,000 ISK
- **Total Build Cost: 420,000,000 ISK**

Buy Cost:
- Market price: 4,400,000 ISK per unit
- Quantity: 100
- **Total Buy Cost: 440,000,000 ISK**

Decision: **Build** (saves 20M ISK)

---

**Component: Capital Propulsion Engine (40 units)**

Build Cost:
- Materials + job cost
- **Total Build Cost: 180,000,000 ISK**

Buy Cost:
- Market price: 4,000,000 ISK per unit
- Quantity: 40
- **Total Buy Cost: 160,000,000 ISK**

Decision: **Buy** (saves 20M ISK)

---

### With Buy Mode Enabled

Original Raw Materials:
- Tritanium: 145,000,000 (for all components)
- Pyerite: 36,000,000

Materials for Capital Propulsion Engine (buying these):
- Tritanium: 20,000,000
- Pyerite: 5,000,000

Adjusted Raw Materials (Buy Mode):
- Tritanium: 145,000,000 - 20,000,000 = 125,000,000
- Pyerite: 36,000,000 - 5,000,000 = 31,000,000

## Materials Breakdown Storage

When creating projects from calculations, `materialsBreakdown` is stored:

```typescript
interface ComponentMaterialBreakdown {
  typeId: number
  name: string
  quantity: number
}

// Stored in components table
{
  materials_breakdown: [
    { typeId: 34, name: "Tritanium", quantity: 20000000 },
    { typeId: 35, name: "Pyerite", quantity: 5000000 }
  ],
  build_cost: 180000000
}
```

This enables Buy Mode in project detail pages.

## UI Indicators

### In Industry Calculator

| Icon | Meaning | Color |
|------|---------|-------|
| 🔨 | Build recommended | Default |
| 🛒 | Buy recommended | Green background |

Savings displayed next to each component:
- "Saves 20M ISK" (positive = savings)

### In Project Detail

Same icons, plus:
- Buy Mode toggle in header
- "Adjusted for Buy Mode" badge on raw materials
- Price summaries update with adjusted quantities

## Edge Cases

### No Price Data

If market price is unavailable (0 or null):
- Default to build
- `shouldBuy = false`

```typescript
const shouldBuy = totalSellPrice > 0 && totalSellPrice < data.buildCost
```

### Build Cost is Zero

If build cost is 0 (no job cost data):
- Compare material cost only
- May be inaccurate

### Prices Change

- Prices are fetched once at calculation time
- May become stale
- Re-run calculation for current prices

## Limitations

1. **Market liquidity not considered** - Buying 100 capital components may not be practical
2. **Transport costs not included** - Moving materials vs finished components
3. **Time value not considered** - Building takes time; buying is instant
4. **Only considers Jita prices** - Local market may differ
5. **Static at calculation time** - Prices don't update

## When to Use Buy Mode

Good for:
- Initial planning and optimization
- Seeing which components are worth building
- Adjusting shopping lists

Consider manually for:
- Components with limited market supply
- When you have materials already
- Time-sensitive builds

## Related

- [Material Efficiency](./material-efficiency.md)
- [Job Costs](./job-costs.md)
- [Industry Calculator](../pages/industry-calculator.md)
- [Project Detail Page](../pages/projects.md#project-detail-page)

