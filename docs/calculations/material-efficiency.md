# Material Efficiency (ME) Calculations

How Material Efficiency bonuses reduce the materials required for manufacturing.

## Overview

Material Efficiency (ME) is a percentage reduction applied to the base material requirements of a blueprint. EVE Online uses **multiplicative stacking** of ME bonuses and calculates the **total materials per job**, then rounds up. The minimum is 1 material per run (enforced via `max(runs, ...)`).

## The Formula

```
combinedFactor = (1 - blueprintME) × (1 - structureME) × (1 - rigME)
adjustedQuantity = max(runs, ceil(round(baseQuantity × runs × combinedFactor, 2)))
```

Note: EVE uses 2 decimal precision before ceiling to avoid floating-point edge cases.

### Components

| Term | Description |
|------|-------------|
| `baseQuantity` | Materials required per run (from blueprint) |
| `runs` | Number of manufacturing runs |
| `combinedFactor` | Multiplicative combination of all ME bonuses |
| `adjustedQuantity` | Final material quantity needed (minimum = runs) |

### ME Factor Calculation (Multiplicative Stacking)

```
blueprintFactor = 1 - (blueprintME / 100)
structureFactor = 1 - structureME
rigFactor = 1 - (rigME × securityMultiplier)
combinedFactor = blueprintFactor × structureFactor × rigFactor
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
- Blueprint ME: 10% → factor = 0.90
- Structure ME: 1% → factor = 0.99
- Rig ME: 2.4% × 2.1 = 5.04% → factor = 0.9496
- **Combined factor: 0.90 × 0.99 × 0.9496 = 0.8459**

```
totalRaw = 22,500 × 1 × 0.8459 = 19,033.25
total = max(1, ceil(19,033.25)) = 19,034
```

**Result: 19,034 Tritanium** (vs 22,500 base = 15.4% savings)

### Example 2: Batch Production

**Scenario:** Building 10 Rifters with ME 10 blueprint in Sotiyo with T2 rig in nullsec

- Base Tritanium: 22,500 per run
- Runs: 10
- Combined factor: 0.8459

```
totalRaw = 22,500 × 10 × 0.8459 = 190,327.5
total = max(10, ceil(190,327.5)) = 190,328
```

**Result: 190,328 Tritanium** (vs 225,000 base)

Note: Per-job rounding means batch production is slightly more efficient.

### Example 3: R-O Trigger Neurolink Conduit (Real-World)

**Scenario:** Building 70 R-O Trigger Neurolink Conduit with ME 10 blueprint in Sotiyo with T1 rig in nullsec

- Base Axosomatic Neurolink Enhancer: 40 per run
- Runs: 70
- Blueprint ME: 10% → factor = 0.90
- Structure ME: 1% → factor = 0.99
- Rig ME: 2% × 2.1 = 4.2% → factor = 0.958
- **Combined factor: 0.90 × 0.99 × 0.958 = 0.8535**

```
totalRaw = 40 × 70 × 0.8535 = 2389.8
total = max(70, ceil(2389.8)) = 2390
```

**Result: 2,390 Axosomatic Neurolink Enhancer** (matches EVE Online)

### Example 4: Minimum Material Rule

**Scenario:** Building 5 items where ME would reduce material below 1 per run

- Base material: 2 per run
- Runs: 5
- Combined factor: 0.20 (hypothetical extreme ~80% ME)

```
totalRaw = 2 × 5 × 0.20 = 2.0
total = max(5, ceil(2.0)) = max(5, 2) = 5
```

**Result: 5 units** (minimum 1 per run enforced via max(runs, ...))

### Example 5: Per-Job Rounding Benefit

**Scenario:** ME calculation showing per-job rounding advantage

- Base material: 101 per run
- Runs: 3
- Blueprint ME only: 10% → factor = 0.90

```
totalRaw = 101 × 3 × 0.90 = 272.7
total = max(3, ceil(272.7)) = 273
```

**Result: 273 units**

Compare to per-run rounding (old incorrect method):
- Per run: ceil(101 × 0.90) = ceil(90.9) = 91
- Total: 91 × 3 = 273 (same in this case)

But with different numbers, per-job rounding provides savings.

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
  // Multiplicative ME stacking (how EVE Online calculates)
  const blueprintFactor = 1 - (blueprintMe / 100)
  const structureFactor = 1 - structureMeBonus
  const rigFactor = 1 - (rigMeBonus * securityMultiplier)
  const combinedFactor = blueprintFactor * structureFactor * rigFactor
  
  // Per-job rounding with 2 decimal precision (matches EVE behavior)
  const totalRaw = baseQuantity * runs * combinedFactor
  const rounded = Math.round(totalRaw * 100) / 100
  return Math.max(runs, Math.ceil(rounded))
}
```

## Key Points

1. **Multiplicative stacking** - ME bonuses multiply together, not add
2. **Per-job rounding** - Calculate total materials, then round up once
3. **Minimum 1 per run** - Enforced via `max(runs, ...)` 
4. **Rig bonus × security** - Only rig bonuses are affected by security status
5. **Combined factor** - Multiply all (1 - bonus) factors together
6. **Max effective ME** - Practical combined factor is ~0.84-0.85 (15-16% savings)

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

