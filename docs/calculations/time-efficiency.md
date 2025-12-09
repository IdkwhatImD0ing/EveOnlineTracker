# Time Efficiency (TE) Calculations

How Time Efficiency bonuses reduce manufacturing job duration.

## Overview

Time Efficiency (TE) reduces the time required to complete a manufacturing job. Unlike ME, TE has a hard cap of 90% total reduction.

## The Formula

```
adjustedTime = ceil(baseTime × runs × (1 - min(totalTE, 0.90)))
```

### Components

| Term | Description |
|------|-------------|
| `baseTime` | Base job time in seconds (from blueprint) |
| `runs` | Number of manufacturing runs |
| `totalTE` | Combined TE bonus as decimal, capped at 0.90 |
| `adjustedTime` | Final job duration in seconds |

### Total TE Calculation

```
totalTE = (blueprintTE / 100) + structureTE + (rigTE × securityMultiplier)
```

**Note:** Total TE is capped at 90% maximum reduction.

| Source | Value | Description |
|--------|-------|-------------|
| Blueprint TE | 0-20% | Researched on the blueprint |
| Structure TE | 0-30% | Bonus from manufacturing structure |
| Rig TE | 0-24% | Bonus from structure rig |
| Security Multiplier | 1.0-2.1× | Applied to rig bonus only |

## TE Sources

### Blueprint TE

Blueprints can be researched from TE 0 to TE 20:

| TE Level | Bonus |
|----------|-------|
| TE 0 | 0% |
| TE 2 | 2% |
| TE 4 | 4% |
| ... | ... |
| TE 20 | 20% |

TE research is done in increments of 2 (0, 2, 4, ..., 20).

### Structure TE Bonuses

**Manufacturing Structures:**

| Structure | TE Bonus |
|-----------|----------|
| NPC Station | 0% |
| Raitaru | 15% |
| Azbel | 20% |
| Sotiyo | 30% |

**Reaction Structures:**

| Structure | TE Bonus |
|-----------|----------|
| Athanor | 0% |
| Tatara | 25% |

### Rig TE Bonuses

| Rig Type | Base TE Bonus |
|----------|---------------|
| No Rig | 0% |
| T1 Rig | 20% |
| T2 Rig | 24% |

### Security Multipliers

Rig bonuses are multiplied by system security:

| Security | Multiplier | T2 Rig Effective TE |
|----------|------------|---------------------|
| Highsec (≥0.5) | 1.0× | 24% |
| Lowsec (0-0.5) | 1.9× | 45.6% |
| Nullsec (≤0) | 2.1× | 50.4% |

## Examples

### Example 1: Highsec Manufacturing

**Scenario:** Building 1 Rifter in Raitaru with T1 rig in highsec

- Base time: 3,600 seconds (1 hour)
- Runs: 1
- Blueprint TE: 20%
- Structure TE: 15%
- Rig TE: 20% × 1.0 = 20%
- **Total TE: 55%**

```
adjustedTime = ceil(3,600 × 1 × (1 - 0.55))
             = ceil(3,600 × 0.45)
             = ceil(1,620)
             = 1,620 seconds (27 minutes)
```

**Result: 27 minutes** (vs 60 minutes base = 55% faster)

### Example 2: Nullsec Manufacturing

**Scenario:** Building 1 Chimera in Sotiyo with T2 rig in nullsec

- Base time: 86,400 seconds (24 hours)
- Runs: 1
- Blueprint TE: 20%
- Structure TE: 30%
- Rig TE: 24% × 2.1 = 50.4%
- Raw Total TE: 100.4%
- **Capped Total TE: 90%**

```
adjustedTime = ceil(86,400 × 1 × (1 - 0.90))
             = ceil(86,400 × 0.10)
             = ceil(8,640)
             = 8,640 seconds (2 hours 24 minutes)
```

**Result: 2h 24m** (vs 24h base = 90% cap hit)

### Example 3: Batch Production

**Scenario:** Building 10 Rifters

- Base time: 3,600 seconds per run
- Runs: 10
- Total TE: 55%

```
adjustedTime = ceil(3,600 × 10 × (1 - 0.55))
             = ceil(36,000 × 0.45)
             = ceil(16,200)
             = 16,200 seconds (4 hours 30 minutes)
```

**Result: 4h 30m** for 10 runs (27 minutes per run)

### Example 4: Without Bonuses (NPC Station)

**Scenario:** Building 1 Rifter in NPC station

- Base time: 3,600 seconds
- Runs: 1
- Blueprint TE: 20%
- Structure TE: 0%
- Rig TE: 0%
- **Total TE: 20%**

```
adjustedTime = ceil(3,600 × 1 × (1 - 0.20))
             = ceil(3,600 × 0.80)
             = ceil(2,880)
             = 2,880 seconds (48 minutes)
```

**Result: 48 minutes** (vs 60 minutes base)

## Implementation

```typescript
function calculateJobTime(
  baseTime: number,
  runs: number,
  blueprintTe: number,
  structureTeBonus: number,
  rigTeBonus: number,
  securityMultiplier: number = 1.0
): number {
  // Total TE reduction
  const totalTeReduction = (blueprintTe / 100) + structureTeBonus + (rigTeBonus * securityMultiplier)
  
  // Apply TE formula, capped at 90%
  return Math.ceil(baseTime * runs * (1 - Math.min(totalTeReduction, 0.9)))
}
```

## Time Formatting

The application formats duration in EVE style:

```typescript
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (days > 0) {
    return `${days}D ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
```

| Duration | Format |
|----------|--------|
| 2 days, 5 hours, 30 minutes | `2D 05:30` |
| 1 hour, 45 minutes, 30 seconds | `01:45:30` |

## Key Points

1. **90% cap** - Total TE reduction cannot exceed 90%
2. **Rig bonuses scale with security** - Nullsec gets bigger rig bonuses
3. **Time is per-job** - All runs in a job complete together
4. **TE research in steps of 2** - Blueprint TE goes 0, 2, 4, ..., 20
5. **Structure bonuses vary widely** - Sotiyo gives 30% vs Raitaru's 15%

## Practical Considerations

- In nullsec with full bonuses, the 90% cap is often reached
- For quick jobs, NPC stations with TE 20 blueprints may be sufficient
- For capital ships (long build times), maximizing TE is crucial
- Reactions benefit from Tatara's 25% TE bonus

## Related

- [Material Efficiency](./material-efficiency.md)
- [Job Costs](./job-costs.md)
- [Industry Calculator](../pages/industry-calculator.md)

