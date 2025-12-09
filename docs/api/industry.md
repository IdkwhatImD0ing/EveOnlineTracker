# Industry Calculator API

Endpoints for blueprint searching and manufacturing cost calculations.

## Overview

The industry API provides blueprint lookup and comprehensive manufacturing calculations, including recursive material expansion, ME/TE bonuses, and job costs.

---

## Endpoints

### GET /api/industry/blueprints/search

Search for blueprints by name for autocomplete functionality.

**Authentication:** None required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | Yes | - | Search query (minimum 2 characters) |
| limit | integer | No | 20 | Maximum results (capped at 50) |

**Example Request:**
```bash
curl "http://localhost:3000/api/industry/blueprints/search?q=chimera&limit=10"
```

**Success Response (200):**
```json
[
  {
    "blueprintTypeId": 24690,
    "blueprintName": "Chimera Blueprint",
    "productTypeId": 24688,
    "productName": "Chimera",
    "isReaction": false
  },
  {
    "blueprintTypeId": 45647,
    "blueprintName": "Chimeramorph Cerebrum Blueprint",
    "productTypeId": 45646,
    "productName": "Chimeramorph Cerebrum",
    "isReaction": false
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| blueprintTypeId | number | Type ID of the blueprint |
| blueprintName | string | Name of the blueprint |
| productTypeId | number | Type ID of the produced item |
| productName | string | Name of the produced item |
| isReaction | boolean | True if this is a reaction formula |

**Empty Query Response:**
Returns empty array `[]` if query is less than 2 characters.

---

### POST /api/industry/calculate

Calculate complete material requirements, job costs, and build steps for a blueprint.

**Authentication:** None required

**Request Body:**

```json
{
  "blueprintTypeId": 24690,
  "quantity": 1,
  "runs": 1,
  "blueprintMe": 10,
  "blueprintTe": 20,
  "systemName": "Jita",
  "facilityTax": 0,
  "structureType": "sotiyo",
  "rigType": "t2",
  "securityType": "nullsec"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| blueprintTypeId | number | Yes | - | Type ID of the blueprint |
| quantity | number | No | 1 | Number of items to produce |
| runs | number | No | 1 | Runs per BPC |
| blueprintMe | number | No | 0 | Material Efficiency (0-10) |
| blueprintTe | number | No | 0 | Time Efficiency (0-20) |
| systemName | string | No | "Jita" | Manufacturing system name |
| facilityTax | number | No | 0 | Facility tax percentage |
| structureType | string | No | "raitaru" | Structure type (see below) |
| rigType | string | No | "none" | Rig type (see below) |
| securityType | string | No | "highsec" | Security status (see below) |

**Structure Types:**

| Value | ME Bonus | TE Bonus | Job Cost Bonus |
|-------|----------|----------|----------------|
| npc_station | 0% | 0% | 0% |
| raitaru | 1% | 15% | 3% |
| azbel | 1% | 20% | 4% |
| sotiyo | 1% | 30% | 5% |

**Rig Types:**

| Value | ME Bonus | TE Bonus |
|-------|----------|----------|
| none | 0% | 0% |
| t1 | 2% | 20% |
| t2 | 2.4% | 24% |

**Security Types:**

| Value | Rig Multiplier |
|-------|----------------|
| highsec | 1.0x |
| lowsec | 1.9x |
| nullsec | 2.1x |
| wormhole | 2.1x |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/industry/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "blueprintTypeId": 24690,
    "quantity": 1,
    "blueprintMe": 10,
    "blueprintTe": 20,
    "systemName": "3T7-M8",
    "structureType": "sotiyo",
    "rigType": "t2",
    "securityType": "nullsec"
  }'
```

**Success Response (200):**
```json
{
  "blueprint": {
    "blueprintTypeId": 24690,
    "blueprintName": "Chimera Blueprint",
    "productTypeId": 24688,
    "productName": "Chimera"
  },
  "materials": [
    {
      "typeId": 34,
      "name": "Tritanium",
      "quantity": 145000000,
      "volume": 1450000,
      "buyPrice": 5.50,
      "sellPrice": 5.20,
      "totalBuyPrice": 797500000,
      "totalSellPrice": 754000000,
      "groupName": "Mineral"
    }
  ],
  "components": [
    {
      "typeId": 11478,
      "name": "Capital Armor Plates",
      "quantity": 100,
      "volume": 4000,
      "buyPrice": 45000000,
      "sellPrice": 44000000,
      "totalBuyPrice": 4500000000,
      "totalSellPrice": 4400000000,
      "groupName": "Capital Construction Components",
      "buildCost": 4200000000,
      "shouldBuy": false,
      "savings": 200000000,
      "materialsBreakdown": [
        {
          "typeId": 34,
          "name": "Tritanium",
          "quantity": 50000000
        }
      ]
    }
  ],
  "outputs": [
    {
      "typeId": 24688,
      "name": "Chimera",
      "quantity": 1,
      "volume": 0,
      "buyPrice": 2500000000,
      "sellPrice": 2400000000,
      "totalBuyPrice": 2500000000,
      "totalSellPrice": 2400000000,
      "duration": "1D 05:30:00"
    }
  ],
  "excessMaterials": [],
  "costs": {
    "materialsCostBuy": 15000000000,
    "materialsCostSell": 14500000000,
    "jobCosts": 250000000,
    "excessValue": 0,
    "totalCost": 15250000000,
    "costPerUnit": 15250000000,
    "estimatedProfit": -12850000000
  },
  "buildSteps": [
    {
      "blueprintName": "Capital Armor Plates Blueprint",
      "productName": "Capital Armor Plates",
      "runs": 100,
      "quantity": 100,
      "excess": 0,
      "duration": "2D 10:00:00",
      "jobCost": 50000000
    },
    {
      "blueprintName": "Chimera Blueprint",
      "productName": "Chimera",
      "runs": 1,
      "quantity": 1,
      "excess": 0,
      "duration": "1D 05:30:00",
      "jobCost": 200000000
    }
  ],
  "systemCostIndex": 0.0574
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| blueprint | object | Blueprint information |
| materials | array | Raw materials that cannot be built |
| components | array | Intermediate items that are built |
| outputs | array | Final produced items |
| excessMaterials | array | Leftover materials from batch production |
| costs | object | Cost breakdown |
| buildSteps | array | Manufacturing steps in order |
| systemCostIndex | number | System cost index used |

**Material/Component Fields:**

| Field | Type | Description |
|-------|------|-------------|
| typeId | number | EVE type ID |
| name | string | Item name |
| quantity | number | Required quantity |
| volume | number | Total volume (m³) |
| buyPrice | number | Jita buy price per unit |
| sellPrice | number | Jita sell price per unit |
| totalBuyPrice | number | quantity × buyPrice |
| totalSellPrice | number | quantity × sellPrice |
| groupName | string | Item category |
| buildCost | number | (components only) Cost to build |
| shouldBuy | boolean | (components only) True if cheaper to buy |
| savings | number | (components only) ISK saved by optimal choice |
| materialsBreakdown | array | (components only) Raw materials needed |

**Error Responses:**

*Missing blueprint (400):*
```json
{
  "error": "blueprintTypeId is required"
}
```

*Blueprint not found (404):*
```json
{
  "error": "Blueprint not found"
}
```

---

### GET /api/industry/systems

Get list of popular manufacturing systems.

**Authentication:** None required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | No | - | Filter systems by name |

**Example Request:**
```bash
# Get all popular systems
curl "http://localhost:3000/api/industry/systems"

# Search for specific system
curl "http://localhost:3000/api/industry/systems?q=jita"
```

**Success Response (200):**
```json
[
  { "name": "Jita", "region": "The Forge" },
  { "name": "Perimeter", "region": "The Forge" },
  { "name": "Amarr", "region": "Domain" },
  { "name": "Dodixie", "region": "Sinq Laison" },
  { "name": "Rens", "region": "Heimatar" },
  { "name": "Hek", "region": "Metropolis" },
  { "name": "Osmon", "region": "The Forge" }
]
```

---

### POST /api/industry/systems

Get cost index for a specific system.

**Authentication:** None required

**Request Body:**

```json
{
  "systemName": "Jita",
  "activityId": 1
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| systemName | string | Yes | - | Name of the system |
| activityId | number | No | 1 | Activity type (see below) |

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

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/industry/systems" \
  -H "Content-Type: application/json" \
  -d '{"systemName": "Jita", "activityId": 1}'
```

**Success Response (200):**
```json
{
  "systemName": "Jita",
  "activityId": 1,
  "costIndex": 0.0574,
  "costIndexPercent": "5.74%"
}
```

**Error Responses:**

*Missing systemName (400):*
```json
{
  "error": "systemName required"
}
```

---

## Calculation Details

For detailed explanations of the calculation formulas, see:

- [Material Efficiency](../calculations/material-efficiency.md)
- [Time Efficiency](../calculations/time-efficiency.md)
- [Job Costs](../calculations/job-costs.md)
- [Buy vs Build](../calculations/buy-vs-build.md)

---

## Related Files

- `lib/blueprints.ts` - Blueprint data and calculations
- `lib/esi.ts` - Cost index fetching
- `lib/janice.ts` - Price fetching
- `app/api/industry/blueprints/search/route.ts` - Search endpoint
- `app/api/industry/calculate/route.ts` - Calculate endpoint
- `app/api/industry/systems/route.ts` - Systems endpoint

