# Material Efficiency (ME) Calculations

How Material Efficiency bonuses reduce the materials required for manufacturing.

## Overview

Material Efficiency (ME) is a percentage reduction applied to the base material requirements of a blueprint. EVE Online applies ME to the **total** materials needed for all runs, not per-run, making batch production more efficient.

## The Formula

```
adjustedQuantity = max(runs, ceil(round(baseQuantity × runs × (1 - totalME), 2)))
```

### Components

| Term | Description |
|------|-------------|
| `baseQuantity` | Materials required per run (from blueprint) |
| `runs` | Number of manufacturing runs |
| `totalME` | Combined ME bonus as decimal (e.g., 0.10 for 10%) |
| `adjustedQuantity` | Final material quantity needed |

### Total ME Calculation

```
totalME = (blueprintME / 100) + structureME + (rigME × securityMultiplier)
```

| Source | Value | Description |
|--------|-------|-------------|
| Blueprint ME | 0-10% | Researched on the blueprint |
| Structure ME | 0-1% | Bonus from manufacturing structure |
| Rig ME | 0-2.4% | Bonus from structure rig |
| Security Multiplier | 1.0-2.1× | Applied to rig bonus only |

## ME Sources

### Blueprint ME

Blueprints can be researched from ME 0 to ME 10:

| ME Level | Bonus |
|----------|-------|
| ME 0 | 0% |
| ME 1 | 1% |
| ME 2 | 2% |
| ... | ... |
| ME 10 | 10% |

### Structure ME Bonuses

| Structure | ME Bonus |
|-----------|----------|
| NPC Station | 0% |
| Raitaru | 1% |
| Azbel | 1% |
| Sotiyo | 1% |

### Rig ME Bonuses

| Rig Type | Base ME Bonus |
|----------|---------------|
| No Rig | 0% |
| T1 Rig | 2.0% |
| T2 Rig | 2.4% |

### Security Multipliers

Rig bonuses are multiplied by system security:

| Security | Multiplier | T2 Rig Effective ME |
|----------|------------|---------------------|
| Highsec (≥0.5) | 1.0× | 2.4% |
| Lowsec (0-0.5) | 1.9× | 4.56% |
| Nullsec (≤0) | 2.1× | 5.04% |

## Examples

### Example 1: Simple Manufacturing

**Scenario:** Building 1 Rifter with ME 10 blueprint in Sotiyo with T2 rig in nullsec

- Base Tritanium: 22,500 per run
- Runs: 1
- Blueprint ME: 10%
- Structure ME: 1%
- Rig ME: 2.4% × 2.1 = 5.04%
- **Total ME: 16.04%**

```
rawQuantity = 22,500 × 1 × (1 - 0.1604)
            = 22,500 × 0.8396
            = 18,891

rounded = round(18,891, 2) = 18,891.00
adjusted = ceil(18,891.00) = 18,891
final = max(1, 18,891) = 18,891
```

**Result: 18,891 Tritanium** (vs 22,500 base = 16.04% savings)

### Example 2: Batch Production

**Scenario:** Building 10 Rifters with ME 10 blueprint in Sotiyo with T2 rig in nullsec

- Base Tritanium: 22,500 per run
- Runs: 10
- Total ME: 16.04%

```
rawQuantity = 22,500 × 10 × (1 - 0.1604)
            = 225,000 × 0.8396
            = 188,910

rounded = round(188,910, 2) = 188,910.00
adjusted = ceil(188,910.00) = 188,910
final = max(10, 188,910) = 188,910
```

**Result: 188,910 Tritanium** (vs 225,000 base)

Note: Per-unit this is 18,891 Tritanium - same as single run due to rounding.

### Example 3: Minimum Material Rule

**Scenario:** Building 5 items where ME would reduce material below 1 per run

- Base material: 2 per run
- Runs: 5
- Total ME: 80% (hypothetical extreme)

```
rawQuantity = 2 × 5 × (1 - 0.80)
            = 10 × 0.20
            = 2.00

rounded = 2.00
adjusted = ceil(2.00) = 2
final = max(5, 2) = 5  // Minimum kicks in!
```

**Result: 5 units** (at least 1 per run)

### Example 4: Rounding Behavior

**Scenario:** ME calculation with decimal precision

- Base material: 100 per run
- Runs: 3
- Total ME: 10%

```
rawQuantity = 100 × 3 × (1 - 0.10)
            = 300 × 0.90
            = 270.00

rounded = round(270.00, 2) = 270.00
adjusted = ceil(270.00) = 270
final = max(3, 270) = 270
```

**Result: 270 units**

Now with a slight change causing decimals:

- Base material: 101 per run

```
rawQuantity = 101 × 3 × (1 - 0.10)
            = 303 × 0.90
            = 272.70

rounded = round(272.70, 2) = 272.70
adjusted = ceil(272.70) = 273
final = max(3, 273) = 273
```

**Result: 273 units** (rounded up)

## Implementation

```typescript
function calculateMaterialQuantity(
  baseQuantity: number,
  runs: number,
  blueprintMe: number,
  structureMeBonus: number,
  rigMeBonus: number,
  securityMultiplier: number = 1.0
): number {
  // Total ME reduction
  const totalMeReduction = (blueprintMe / 100) + structureMeBonus + (rigMeBonus * securityMultiplier)
  
  // Apply ME formula to total quantity
  const rawQuantity = baseQuantity * runs * (1 - totalMeReduction)
  const rounded = Math.round(rawQuantity * 100) / 100
  const adjusted = Math.ceil(rounded)
  
  // Minimum is the number of runs
  return Math.max(runs, adjusted)
}
```

## Key Points

1. **ME applies to total, not per-run** - This makes batch production efficient
2. **Minimum 1 per run** - You always need at least 1 of each material per run
3. **Round then ceil** - Decimals are rounded to 2 places, then ceiling applied
4. **Rig bonus × security** - Only rig bonuses are affected by security status
5. **Stacking** - All ME sources stack additively
6. **Max effective ME** - There's no hard cap, but practical max is ~16-17%

## Component ME

When building intermediate components, the calculator uses default settings:

| Setting | Value |
|---------|-------|
| Component ME | 10 (configurable in structures.json) |
| Component TE | 20 (configurable in structures.json) |

This assumes you have researched component blueprints to optimal levels.

## Related

- [Time Efficiency](./time-efficiency.md)
- [Job Costs](./job-costs.md)
- [Industry Calculator](../pages/industry-calculator.md)

