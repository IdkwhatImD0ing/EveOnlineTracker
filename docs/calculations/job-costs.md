# Job Cost Calculations

How manufacturing job installation costs are calculated.

## Overview

Job costs in EVE Online are based on:

- The estimated value of the job output (base cost)
- The system's cost index for the activity
- Number of runs
- Structure bonuses
- Facility tax

## The Formula

```
jobCost = baseCost × systemCostIndex × runs × (1 - jobCostBonus) × (1 + facilityTax)
```

### Components

| Term | Description |
|------|-------------|
| `baseCost` | Estimated job output value from eve-industry.org |
| `systemCostIndex` | System activity cost index (0.0001 - ~0.20) |
| `runs` | Number of manufacturing runs |
| `jobCostBonus` | Structure job cost reduction (0 - 0.05) |
| `facilityTax` | Facility tax as decimal (e.g., 0.10 for 10%) |

## Base Cost

The base cost is the "job base cost" as calculated by CCP. We fetch this from eve-industry.org API:

```
GET http://api.eve-industry.org/job-base-cost.xml?ids=24690
```

This returns the estimated cost of running one job of this blueprint.

**Note:** The base cost is calculated from CCP's "adjusted prices" for the blueprint's output, not the material inputs.

## System Cost Index

Each system has cost indices for different activities. We fetch from eve-industry.org:

```
GET http://api.eve-industry.org/system-cost-index.xml?name=Jita
```

**Activity IDs:**
| ID | Activity |
|----|----------|
| 1 | Manufacturing |
| 3 | TE Research |
| 4 | ME Research |
| 5 | Copying |
| 7 | Reverse Engineering |
| 8 | Invention |
| 11 | Reactions |

**Typical Cost Indices:**
| System Type | Manufacturing Index |
|-------------|---------------------|
| Trade hubs (Jita) | 5-8% |
| Low-traffic systems | 0.01-1% |
| Nullsec systems | 0.1-5% (varies) |

## Structure Job Cost Bonuses

| Structure | Job Cost Bonus |
|-----------|----------------|
| NPC Station | 0% |
| Raitaru | 3% |
| Azbel | 4% |
| Sotiyo | 5% |

Note: Engineering Complexes provide the same job cost bonus regardless of rig.

## Examples

### Example 1: Simple Job

**Scenario:** Building 1 Rifter in Jita NPC station

- Base cost: 50,000 ISK
- System cost index: 0.05 (5%)
- Runs: 1
- Job cost bonus: 0%
- Facility tax: 0%

```
jobCost = 50,000 × 0.05 × 1 × (1 - 0) × (1 + 0)
        = 50,000 × 0.05 × 1 × 1 × 1
        = 2,500 ISK
```

**Result: 2,500 ISK**

### Example 2: With Structure Bonus

**Scenario:** Building 1 Rifter in Sotiyo

- Base cost: 50,000 ISK
- System cost index: 0.05 (5%)
- Runs: 1
- Job cost bonus: 5%
- Facility tax: 0%

```
jobCost = 50,000 × 0.05 × 1 × (1 - 0.05) × (1 + 0)
        = 50,000 × 0.05 × 1 × 0.95 × 1
        = 2,375 ISK
```

**Result: 2,375 ISK** (5% savings)

### Example 3: With Facility Tax

**Scenario:** Building 1 Rifter in Sotiyo with 10% tax

- Base cost: 50,000 ISK
- System cost index: 0.05 (5%)
- Runs: 1
- Job cost bonus: 5%
- Facility tax: 10%

```
jobCost = 50,000 × 0.05 × 1 × (1 - 0.05) × (1 + 0.10)
        = 50,000 × 0.05 × 1 × 0.95 × 1.10
        = 2,612.50 ISK
```

**Result: 2,612.50 ISK**

### Example 4: Capital Ship

**Scenario:** Building 1 Chimera in low-index nullsec Sotiyo

- Base cost: 2,000,000,000 ISK (2B)
- System cost index: 0.01 (1%)
- Runs: 1
- Job cost bonus: 5%
- Facility tax: 5%

```
jobCost = 2,000,000,000 × 0.01 × 1 × (1 - 0.05) × (1 + 0.05)
        = 2,000,000,000 × 0.01 × 0.95 × 1.05
        = 19,950,000 ISK (~20M ISK)
```

**Result: ~20M ISK**

### Example 5: Multiple Runs

**Scenario:** Building 10 Rifters

- Base cost: 50,000 ISK
- System cost index: 0.05 (5%)
- Runs: 10
- Job cost bonus: 5%
- Facility tax: 0%

```
jobCost = 50,000 × 0.05 × 10 × (1 - 0.05) × (1 + 0)
        = 50,000 × 0.05 × 10 × 0.95
        = 23,750 ISK
```

**Result: 23,750 ISK** (2,375 ISK per unit)

## Implementation

```typescript
// Calculate job cost for a build step
const jobCost = baseCost * 
                settings.systemCostIndex * 
                step.runs * 
                (1 - settings.structureBonus.jobCostBonus) * 
                (1 + settings.facilityTax)
```

## Fetching Base Costs

The application fetches job base costs from eve-industry.org:

```typescript
async function getJobBaseCosts(blueprintTypeIds: number[]): Promise<Map<number, number>> {
  const idsParam = blueprintTypeIds.join(',')
  const response = await fetch(
    `http://api.eve-industry.org/job-base-cost.xml?ids=${idsParam}`
  )
  // Parse XML response
  // Returns Map of blueprintTypeId -> baseCost
}
```

## Fetching System Cost Index

```typescript
async function getSystemCostIndex(
  systemName: string,
  activityId: number = 1
): Promise<number> {
  const response = await fetch(
    `http://api.eve-industry.org/system-cost-index.xml?name=${systemName}`
  )
  // Parse XML response
  // Returns cost index for the specified activity
}
```

## Total Job Costs

For recursive builds, total job cost is the sum of all build steps:

```typescript
const totalJobCost = buildSteps.reduce((sum, step) => sum + step.jobCost, 0)
```

## Key Points

1. **Base cost is from CCP's data** - Not calculated from materials
2. **System index varies widely** - Manufacturing in Jita is expensive
3. **Structure bonuses are small** - Only 3-5% reduction
4. **Facility tax adds up** - Can significantly increase costs
5. **Multiple runs multiply cost** - Linear scaling with runs
6. **Reactions use activity ID 11** - Different cost index than manufacturing

## Cost Optimization

To minimize job costs:

1. Use Engineering Complexes (Sotiyo gives 5% bonus)
2. Build in low-index systems
3. Negotiate low facility tax
4. Consider job cost vs transport cost trade-off

## Related

- [Material Efficiency](./material-efficiency.md)
- [Time Efficiency](./time-efficiency.md)
- [eve-industry.org Integration](../integrations/eve-industry-org.md)

