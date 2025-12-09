# Projects API

CRUD endpoints for managing manufacturing projects.

## Overview

The projects API handles all project-related operations including creating, reading, updating, and deleting projects, as well as managing project items and additional costs.

---

## Endpoints

### GET /api/projects

List all projects.

**Authentication:** None required

**Example Request:**
```bash
curl "http://localhost:3000/api/projects"
```

**Success Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chimera Build",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T15:45:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "T2 Module Production",
    "created_at": "2024-01-14T08:00:00.000Z",
    "updated_at": "2024-01-14T08:00:00.000Z"
  }
]
```

Projects are ordered by `created_at` descending (newest first).

---

### POST /api/projects

Create a new project with raw materials and components.

**Authentication:** None required

**Request Body:**

```json
{
  "name": "Chimera Build",
  "rawMaterialsInput": "Tritanium 145000000\nPyerite 36000000\nMexallon 14500000",
  "componentsInput": "Capital Armor Plates 100\nCapital Propulsion Engine 40"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Project name |
| rawMaterialsInput | string | No | Raw materials in EVE copy format |
| componentsInput | string | No | Components in EVE copy format |

**Input Formats Supported:**
```
# Tab-separated (inventory export)
Tritanium    1000000    0.01 m3

# Space-separated
Tritanium 1000000

# Item name only (quantity = 1)
Tritanium
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chimera Build",
    "rawMaterialsInput": "Tritanium 145000000\nPyerite 36000000",
    "componentsInput": "Capital Armor Plates 100"
  }'
```

**Success Response (200):**
```json
{
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Chimera Build",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "warnings": {
    "rawMaterialsFailures": null,
    "componentsFailures": "Unknown item: Invalid Item Name"
  }
}
```

**Processing Steps:**
1. Validates project name is provided
2. Parses raw materials through Janice API (gets prices)
3. Parses components through Janice API
4. Looks up group names from EVE SDE
5. Creates project in database
6. Inserts raw materials with prices
7. Inserts components (no prices stored)
8. Returns project with any parsing failures

**Error Responses:**

*Missing name (400):*
```json
{
  "error": "Project name is required"
}
```

*Database error (500):*
```json
{
  "error": "Failed to save project items",
  "details": ["Raw materials: duplicate key violation"]
}
```

---

### GET /api/projects/[id]

Get a project with all related data.

**Authentication:** None required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Project ID |

**Example Request:**
```bash
curl "http://localhost:3000/api/projects/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Chimera Build",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T15:45:00.000Z",
  "raw_materials": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "item_name": "Tritanium",
      "type_id": 34,
      "quantity": 145000000,
      "collected": false,
      "buy_price": 5.50,
      "sell_price": 5.20,
      "split_price": 5.35,
      "volume": 0.01,
      "item_type": "Mineral"
    }
  ],
  "components": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "item_name": "Capital Armor Plates",
      "type_id": 11478,
      "quantity": 100,
      "collected": false,
      "quantity_made": 25,
      "buy_price": 45000000,
      "sell_price": 44000000,
      "split_price": 44500000,
      "volume": 40,
      "item_type": "Capital Construction Components",
      "materials_breakdown": [
        {"typeId": 34, "name": "Tritanium", "quantity": 50000000}
      ],
      "build_cost": 4200000000
    }
  ],
  "additional_costs": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "project_id": "550e8400-e29b-41d4-a716-446655440000",
      "note": "Manufacturing job cost",
      "amount": 250000000,
      "created_at": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

**Error Response (404):**
```json
{
  "error": "Project not found"
}
```

---

### DELETE /api/projects/[id]

Delete a project and all related data.

**Authentication:** None required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Project ID |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/projects/550e8400-e29b-41d4-a716-446655440000"
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Notes:**
- Cascade deletes all raw_materials, components, and additional_costs
- This action cannot be undone

---

### PATCH /api/projects/[id]/items/[itemId]

Update an item's collected status or quantity made.

**Authentication:** None required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Project ID |
| itemId | uuid | Item ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | "raw" or "component" |

**Request Body:**

```json
{
  "collected": true,
  "quantity_made": 50
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| collected | boolean | No | Whether item is fully collected |
| quantity_made | number | No | Units completed (components only) |

**Example Requests:**

*Mark raw material as collected:*
```bash
curl -X PATCH "http://localhost:3000/api/projects/550e8400.../items/660e8400...?type=raw" \
  -H "Content-Type: application/json" \
  -d '{"collected": true}'
```

*Update component progress:*
```bash
curl -X PATCH "http://localhost:3000/api/projects/550e8400.../items/770e8400...?type=component" \
  -H "Content-Type: application/json" \
  -d '{"quantity_made": 50}'
```

**Success Response (200):**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "item_name": "Tritanium",
  "type_id": 34,
  "quantity": 145000000,
  "collected": true,
  "buy_price": 5.50,
  "sell_price": 5.20,
  "split_price": 5.35,
  "volume": 0.01,
  "item_type": "Mineral"
}
```

**Error Responses:**

*Invalid type (400):*
```json
{
  "error": "type query param must be \"raw\" or \"component\""
}
```

*No fields provided (400):*
```json
{
  "error": "Must provide collected or quantity_made"
}
```

*Item not found (404):*
```json
{
  "error": "Item not found"
}
```

---

### POST /api/projects/[id]/costs

Add an additional cost to a project.

**Authentication:** None required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Project ID |

**Request Body:**

```json
{
  "note": "Manufacturing job cost",
  "amount": 250000000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| note | string | Yes | Description of the cost |
| amount | number | Yes | Amount in ISK |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/projects/550e8400.../costs" \
  -H "Content-Type: application/json" \
  -d '{"note": "Manufacturing job cost", "amount": 250000000}'
```

**Success Response (200):**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "note": "Manufacturing job cost",
  "amount": 250000000,
  "created_at": "2024-01-15T11:00:00.000Z"
}
```

**Error Responses:**

*Missing note (400):*
```json
{
  "error": "Note is required"
}
```

*Invalid amount (400):*
```json
{
  "error": "Amount must be a valid number"
}
```

*Project not found (404):*
```json
{
  "error": "Project not found"
}
```

---

### DELETE /api/projects/[id]/costs

Remove an additional cost from a project.

**Authentication:** None required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Project ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| costId | uuid | Yes | ID of the cost to delete |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/projects/550e8400.../costs?costId=880e8400..."
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Response (400):**
```json
{
  "error": "costId query param is required"
}
```

---

### POST /api/projects/from-calculation

Create a project from industry calculator results.

**Authentication:** None required

**Request Body:**

```json
{
  "calculation": {
    "blueprint": {
      "blueprintTypeId": 24690,
      "blueprintName": "Chimera Blueprint",
      "productTypeId": 24688,
      "productName": "Chimera"
    },
    "materials": [...],
    "components": [...],
    "outputs": [...],
    "costs": {...},
    "buildSteps": [...]
  },
  "quantity": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| calculation | CalculateResponse | Yes | Full calculation result from /api/industry/calculate |
| quantity | number | Yes | Quantity being built (for naming) |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/projects/from-calculation" \
  -H "Content-Type: application/json" \
  -d '{"calculation": {...}, "quantity": 2}'
```

**Success Response (200):**
```json
{
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "2x Chimera",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Auto-generated Names:**
- quantity = 1: "Chimera"
- quantity > 1: "2x Chimera"

**Special Features:**
- Stores `materials_breakdown` for each component (enables Buy Mode)
- Stores `build_cost` for each component (enables buy vs build comparison)
- Stores prices from calculation (not re-fetched)

**Error Response (400):**
```json
{
  "error": "Calculation data is required"
}
```

---

## Data Models

### Project
```typescript
interface Project {
  id: string           // UUID
  name: string         // Project name
  created_at: string   // ISO timestamp
  updated_at: string   // ISO timestamp
}
```

### RawMaterial
```typescript
interface RawMaterial {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null  // Group name
}
```

### Component
```typescript
interface Component {
  id: string
  project_id: string
  item_name: string
  type_id: number
  quantity: number
  collected: boolean
  quantity_made: number
  buy_price: number | null
  sell_price: number | null
  split_price: number | null
  volume: number | null
  item_type: string | null
  materials_breakdown: ComponentMaterialBreakdown[] | null
  build_cost: number | null
}
```

### AdditionalCost
```typescript
interface AdditionalCost {
  id: string
  project_id: string
  note: string
  amount: number
  created_at: string
}
```

---

## Related Files

- `app/api/projects/route.ts` - List/create projects
- `app/api/projects/[id]/route.ts` - Get/delete project
- `app/api/projects/[id]/costs/route.ts` - Manage costs
- `app/api/projects/[id]/items/[itemId]/route.ts` - Update items
- `app/api/projects/from-calculation/route.ts` - Create from calculator
- `types/database.ts` - TypeScript interfaces

