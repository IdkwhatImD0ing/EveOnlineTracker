# Project Pages

Documentation for the project creation and detail pages.

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/projects` | `app/projects/page.tsx` | List all projects |
| `/projects/new` | `app/projects/new/page.tsx` | Create new project |
| `/projects/[id]` | `app/projects/[id]/page.tsx` | Project detail view |

---

## New Project Page

### Route

`/projects/new` — `app/projects/new/page.tsx`

### Purpose

Form for creating a new manufacturing project by pasting item lists from EVE Online.

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  ← New Project                                                     │
│    Create a new industry project by pasting your item lists        │
├────────────────────────────────────────────────────────────────────┤
│  Project Name                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ e.g., Nightmare Build, T2 Modules, etc.                      │ │
│  └──────────────────────────────────────────────────────────────┘ │
├──────────────────────────────┬─────────────────────────────────────┤
│  📦 Raw Materials           │  📦 Components                       │
│  ┌────────────────────────┐ │  ┌────────────────────────────────┐ │
│  │ Tritanium 1000000      │ │  │ Plasma Thruster 50             │ │
│  │ Pyerite 500000         │ │  │ Fernite Carbide... 100         │ │
│  │ Mexallon 250000        │ │  │ Deflection Shield... 75        │ │
│  │ ...                    │ │  │ ...                            │ │
│  │                        │ │  │                                │ │
│  │                        │ │  │                                │ │
│  └────────────────────────┘ │  └────────────────────────────────┘ │
│  One item per line          │  One item per line                   │
├──────────────────────────────┴─────────────────────────────────────┤
│                                              [Cancel] [Create]     │
└────────────────────────────────────────────────────────────────────┘
```

### Features

**Input Fields:**
- Project name (required)
- Raw materials textarea
- Components textarea

**Supported Input Formats:**
```
# Tab-separated (inventory export)
Tritanium    1000000    0.01 m3

# Space-separated
Tritanium 1000000

# Item name only (quantity = 1)
Tritanium
```

### State

```typescript
const [name, setName] = useState("")
const [rawMaterials, setRawMaterials] = useState("")
const [components, setComponents] = useState("")
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState("")
```

### Validation

- Project name is required
- At least one list (raw materials or components) must have content
- Items are parsed by Janice API (failures are returned as warnings)

### API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `POST /api/projects` | Form submission | Create project |

### Flow

```
User Input → Validation → POST /api/projects → Redirect to /projects/[id]
                                     ↓
                         - Parse via Janice API
                         - Fetch prices
                         - Store in database
```

---

## Project Detail Page

### Route

`/projects/[id]` — `app/projects/[id]/page.tsx`

### Purpose

View and manage a manufacturing project:
- Track collected items
- Monitor component progress
- Add additional costs
- View price summaries
- Use Buy Mode for optimized material lists
- Mark projects as complete

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Project Name              [Mark Complete] [Build All] [Delete]│
│    Created Jan 15, 2024                                            │
├────────────────────────────────────────────────────────────────────┤
│  Raw Materials                                         [Copy ▼]    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Group: Mineral                                                 ││
│  │ ┌──────────────────────────────────────────────────────────┐  ││
│  │ │ ☐ Tritanium      145,000,000    797.5M ISK              │  ││
│  │ │ ☐ Pyerite         36,000,000    180.0M ISK              │  ││
│  │ │ ☑ Mexallon        14,500,000     43.5M ISK   ✓ collected│  ││
│  │ └──────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Components                                            [Copy ▼]    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ ☐ Capital Armor Plates   25/100   75   🔨 Build   +200M       ││
│  │ ☐ Capital Propulsion      0/40    40   🛒 Buy     -50M        ││
│  └────────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Jita Prices                                                       │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Buy: 15,500,000,000 ISK                                    📋 ││
│  │ Sell: 14,800,000,000 ISK                                   📋 ││
│  │ Split: 15,150,000,000 ISK                                  📋 ││
│  └────────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Additional Costs                                                  │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Note: [Manufacturing fees  ] Amount: [250000000] [Add]        ││
│  │ • Manufacturing fees: 250,000,000 ISK                     [×] ││
│  │ • Transport costs: 50,000,000 ISK                         [×] ││
│  │ Total Additional: 300,000,000 ISK                             ││
│  └────────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│  Total Project Cost                                                │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ 15.8B ISK (15,800,000,000)                                📋 ││
│  │ = Jita Buy (raw materials) + Additional Costs                 ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### Features

**Item Lists:**
- Checkbox to mark items as collected
- Quantity and value display
- Grouped by item type (for raw materials)
- Copy dropdown: "Copy All" / "Copy Remaining"

**Component Progress:**
- Click quantity to edit (e.g., "25/100")
- Progress bar visualization
- Remaining column shows calculated `quantity - quantity_made`
- Auto-marks collected when complete

**Buy Mode Toggle:**
- Only appears for projects from Industry Calculator
- Shows buy/build recommendation icons
- Adjusts raw materials when active
- Updates price summaries

**Price Summary:**
- Based on raw materials only
- Buy, Sell, Split prices
- Click to copy values

**Additional Costs:**
- Add custom costs (job fees, transport, etc.)
- Delete individual costs
- Running total displayed

**Total Cost:**
- Grand total = Jita Buy + Additional Costs
- Formatted and full value display
- Copy button

**Project Completion:**
- "Mark as Complete" button in header (when project is active)
- "Mark as Active" button in header (when project is completed)
- Completed projects appear in a separate collapsible section on the projects list page

### State

```typescript
const [project, setProject] = useState<ProjectWithDetails | null>(null)
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState("")
const [isDeleting, setIsDeleting] = useState(false)
const [isCompleting, setIsCompleting] = useState(false)
const [showBuyRecommendations, setShowBuyRecommendations] = useState(false)
```

### Computed Values

```typescript
// Calculate buy recommendations for components
const componentBuyRecommendations = useMemo(() => {
  // Compare build_cost vs sell_price * quantity
  // Returns Map<componentId, shouldBuy>
}, [project?.components])

// Adjusted raw materials for buy mode
const adjustedRawMaterials = useMemo(() => {
  // Subtract materials for "buy" components
}, [project?.raw_materials, showBuyRecommendations])
```

### API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `GET /api/projects/[id]` | On mount | Load project data |
| `PATCH /api/projects/[id]/complete` | Mark complete/active button click | Toggle completion status |
| `PATCH /api/projects/[id]/items/[itemId]` | Checkbox/progress change | Update item |
| `POST /api/projects/[id]/costs` | Add cost form submit | Add additional cost |
| `DELETE /api/projects/[id]/costs?costId=` | Delete cost click | Remove cost |
| `DELETE /api/projects/[id]` | Delete button click | Delete project |

### Optimistic Updates

Item updates are optimistic:
1. Update local state immediately
2. Send PATCH request in background
3. No rollback on failure (logged to console)

### Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `ItemList` | Custom | Component list with progress |
| `GroupedItemList` | Custom | Grouped raw materials |
| `PriceSummary` | Custom | Jita price totals |
| `AdditionalCosts` | Custom | Cost management |
| `TotalCost` | Custom | Grand total display |
| `Card`, `Button`, etc. | shadcn/ui | UI elements |

### Copy Functionality

Copy dropdown options:
- **Copy All**: Copies all items in EVE format
- **Copy Remaining**: Copies only unchecked items

Format: `Item Name\t123456` (tab-separated, one per line)

---

## Projects List Page

### Route

`/projects` — `app/projects/page.tsx`

### Purpose

Display all projects in a grid layout, with active and completed projects separated into different sections.

### Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Projects                                    [New Project]         │
│    Track your manufacturing projects and materials                  │
├────────────────────────────────────────────────────────────────────┤
│  🔍 [Search projects...]                                          │
├────────────────────────────────────────────────────────────────────┤
│  Active Projects                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Project 1    │ │ Project 2    │ │ Project 3    │            │
│  │ Jan 15, 2024 │ │ Jan 14, 2024 │ │ Jan 13, 2024 │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├────────────────────────────────────────────────────────────────────┤
│  ▼ Completed Projects (2)                                          │
│  ┌──────────────┐ ┌──────────────┐                              │
│  │ ✓ Project 4  │ │ ✓ Project 5  │                              │
│  │ Jan 10, 2024 │ │ Jan 8, 2024   │                              │
│  └──────────────┘ └──────────────┘                              │
├────────────────────────────────────────────────────────────────────┤
│  5 of 5 projects (3 active, 2 completed)                        │
└────────────────────────────────────────────────────────────────────┘
```

### Features

**Project Display:**
- Active projects shown in main grid section
- Completed projects shown in collapsible section below
- Each project card shows name and creation date
- Click any card to navigate to project detail page

**Search:**
- Search bar filters projects by name
- Works across both active and completed sections
- Shows count of matching projects

**Completed Projects Section:**
- Collapsible section (collapsed by default)
- Shows count of completed projects in header
- Completed projects have visual indicator (checkmark icon)
- Slightly muted styling to distinguish from active projects
- Click header to expand/collapse

**Summary:**
- Shows total count of projects
- Displays breakdown of active vs completed projects

### State

```typescript
const [projects, setProjects] = useState<Project[]>([])
const [isLoading, setIsLoading] = useState(true)
const [searchQuery, setSearchQuery] = useState("")
const [isCompletedOpen, setIsCompletedOpen] = useState(false)
```

### API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `GET /api/projects` | On mount | Load all projects |

### Project Separation

Projects are automatically separated into:
- **Active Projects**: `projects.filter(p => !p.completed)`
- **Completed Projects**: `projects.filter(p => p.completed)`

Both arrays are filtered by search query independently, allowing users to search across all projects regardless of completion status.

---

## Related Files

- `app/projects/page.tsx` — Projects list page
- `app/projects/new/page.tsx` — New project form
- `app/projects/[id]/page.tsx` — Project detail view
- `components/item-list.tsx` — Item list component
- `components/grouped-item-list.tsx` — Grouped materials
- `components/price-summary.tsx` — Price totals
- `components/additional-costs.tsx` — Cost management
- `components/total-cost.tsx` — Total display
- `components/ui/collapsible.tsx` — Collapsible component for completed section
- `types/database.ts` — Type definitions

