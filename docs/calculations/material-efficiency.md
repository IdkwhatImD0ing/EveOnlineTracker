# Material Efficiency (ME) Calculations

How Material Efficiency bonuses reduce the materials required for manufacturing.

## Overview

Material Efficiency (ME) is a percentage reduction applied to the base material requirements of a blueprint. EVE Online calculates ME **per-run first**, then multiplies by the number of runs. This means each material requires at least 1 unit per run.

## The Formula

```
perRunQuantity = max(1, ceil(baseQuantity × (1 - totalME)))
adjustedQuantity = perRunQuantity × runs
```

### Components

| Term | Description |
|------|-------------|
| `baseQuantity` | Materials required per run (from blueprint) |
| `runs` | Number of manufacturing runs |
| `totalME` | Combined ME bonus as decimal (e.g., 0.10 for 10%) |
| `perRunQuantity` | Materials needed per single run (after ME, minimum 1) |
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
perRunRaw = 22,500 × (1 - 0.1604)
          = 22,500 × 0.8396
          = 18,891

perRunAdjusted = max(1, ceil(18,891)) = 18,891
total = 18,891 × 1 = 18,891
```

**Result: 18,891 Tritanium** (vs 22,500 base = 16.04% savings)

### Example 2: Batch Production

**Scenario:** Building 10 Rifters with ME 10 blueprint in Sotiyo with T2 rig in nullsec

- Base Tritanium: 22,500 per run
- Runs: 10
- Total ME: 16.04%

```
perRunRaw = 22,500 × (1 - 0.1604)
          = 22,500 × 0.8396
          = 18,891

perRunAdjusted = max(1, ceil(18,891)) = 18,891
total = 18,891 × 10 = 188,910
```

**Result: 188,910 Tritanium** (vs 225,000 base)

Note: Per-unit this is 18,891 Tritanium - same as single run.

### Example 3: Revelation Navy Issue (Real-World)

**Scenario:** Building 10 Revelation Navy Issues with ME 0 blueprint in Sotiyo with T1 rig in nullsec

- Base Life Support Backup Units: 200 per run
- Runs: 10
- Blueprint ME: 0%
- Structure ME: 1%
- Rig ME: 2% × 2.1 = 4.2%
- **Total ME: 5.2%**

```
perRunRaw = 200 × (1 - 0.052)
          = 200 × 0.948
          = 189.6

perRunAdjusted = max(1, ceil(189.6)) = 190
total = 190 × 10 = 1,900
```

**Result: 1,900 Life Support Backup Units** (190 per ship)

### Example 4: Minimum Material Rule

**Scenario:** Building 5 items where ME would reduce material below 1 per run

- Base material: 2 per run
- Runs: 5
- Total ME: 80% (hypothetical extreme)

```
perRunRaw = 2 × (1 - 0.80)
          = 2 × 0.20
          = 0.4

perRunAdjusted = max(1, ceil(0.4)) = max(1, 1) = 1
total = 1 × 5 = 5
```

**Result: 5 units** (at least 1 per run)

### Example 5: Rounding Behavior

**Scenario:** ME calculation with decimal precision

- Base material: 100 per run
- Runs: 3
- Total ME: 10%

```
perRunRaw = 100 × (1 - 0.10)
          = 100 × 0.90
          = 90

perRunAdjusted = max(1, ceil(90)) = 90
total = 90 × 3 = 270
```

**Result: 270 units**

Now with a slight change causing decimals:

- Base material: 101 per run

```
perRunRaw = 101 × (1 - 0.10)
          = 101 × 0.90
          = 90.9

perRunAdjusted = max(1, ceil(90.9)) = 91
total = 91 × 3 = 273
```

**Result: 273 units** (rounded up per-run, then multiplied)

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
  // Total ME reduction (blueprint ME + structure + rig × security)
  const totalMeReduction = (blueprintMe / 100) + structureMeBonus + (rigMeBonus * securityMultiplier)
  
  // EVE Online calculates ME per-run first, then multiplies by runs
  // Formula: max(1, ceil(baseQuantity × (1 - totalME))) × runs
  const perRunRaw = baseQuantity * (1 - totalMeReduction)
  const perRunAdjusted = Math.max(1, Math.ceil(perRunRaw))
  
  return perRunAdjusted * runs
}
```

## Key Points

1. **ME applies per-run first** - Calculate per-run quantity, then multiply by runs
2. **Minimum 1 per run** - You always need at least 1 of each material per run
3. **Ceiling applied per-run** - Decimals are rounded up before multiplying by runs
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

