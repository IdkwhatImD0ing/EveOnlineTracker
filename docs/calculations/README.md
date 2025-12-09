# Industry Calculations

This section documents the formulas and logic used for EVE Online industry calculations.

## Overview

EVE Online's industry system involves complex calculations for:

- Material requirements (affected by ME bonuses)
- Job duration (affected by TE bonuses)
- Job installation costs
- Buy vs build optimization

## Quick Reference

### Material Efficiency Formula

```
adjustedQuantity = max(runs, ceil(round(baseQuantity × runs × (1 - totalME), 2)))
```

Where `totalME = blueprintME + structureME + (rigME × securityMultiplier)`

### Time Efficiency Formula

```
adjustedTime = ceil(baseTime × runs × (1 - totalTE))
```

Where `totalTE = blueprintTE + structureTE + (rigTE × securityMultiplier)`, capped at 90%

### Job Cost Formula

```
jobCost = baseCost × systemCostIndex × runs × (1 - jobCostBonus) × (1 + facilityTax)
```

## Calculation Topics

| Topic | Description |
|-------|-------------|
| [Material Efficiency](./material-efficiency.md) | How ME reduces material requirements |
| [Time Efficiency](./time-efficiency.md) | How TE reduces job duration |
| [Job Costs](./job-costs.md) | Job installation cost calculation |
| [Buy vs Build](./buy-vs-build.md) | Component optimization logic |

## Bonus Sources

### Structure Bonuses

| Structure | ME Bonus | TE Bonus | Job Cost Bonus |
|-----------|----------|----------|----------------|
| NPC Station | 0% | 0% | 0% |
| Raitaru | 1% | 15% | 3% |
| Azbel | 1% | 20% | 4% |
| Sotiyo | 1% | 30% | 5% |

### Reaction Structures

| Structure | TE Bonus |
|-----------|----------|
| Athanor | 0% |
| Tatara | 25% |

### Rig Bonuses

| Rig | ME Bonus | TE Bonus |
|-----|----------|----------|
| None | 0% | 0% |
| T1 | 2% | 20% |
| T2 | 2.4% | 24% |

### Security Multipliers (for Rigs)

| Security | Multiplier | Effective T2 Rig ME |
|----------|------------|---------------------|
| Highsec | 1.0× | 2.4% |
| Lowsec | 1.9× | 4.56% |
| Nullsec | 2.1× | 5.04% |

## Activity Types

| ID | Activity | Use Case |
|----|----------|----------|
| 1 | Manufacturing | Building items from blueprints |
| 3 | TE Research | Researching time efficiency |
| 4 | ME Research | Researching material efficiency |
| 5 | Copying | Creating blueprint copies |
| 7 | Reverse Engineering | Creating T3 blueprints |
| 8 | Invention | Creating T2 blueprints |
| 11 | Reactions | Moon material processing |

## Recursive Calculation

The industry calculator performs recursive material expansion:

1. Start with target blueprint
2. For each material:
   - If buildable: recursively calculate its materials
   - If raw material: add to final list
3. Handle excess materials from batch production
4. Track build steps in order

```
Target Blueprint
├── Component A (buildable)
│   ├── Raw Material 1
│   └── Raw Material 2
├── Component B (buildable)
│   ├── Raw Material 1
│   └── Raw Material 3
└── Raw Material 1 (direct)
```

## Data Sources

| Data | Source | Update Frequency |
|------|--------|------------------|
| Blueprint data | EVE SDE | Each expansion |
| System cost indices | eve-industry.org | Cached 1 hour |
| Job base costs | eve-industry.org | Cached indefinitely |
| Market prices | Janice API | Per request |
| Type information | EVE SDE | Each expansion |

## Implementation

The calculation logic is implemented in:

- `lib/blueprints.ts` - Core calculation functions
- `lib/esi.ts` - Cost index and job cost fetching
- `lib/janice.ts` - Market price fetching

See individual documentation pages for detailed formula explanations.

