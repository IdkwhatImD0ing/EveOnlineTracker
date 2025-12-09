# Industry Calculator Page

Comprehensive manufacturing calculator for EVE Online blueprints.

## Route

`/industry` — `app/industry/page.tsx`

## Purpose

The Industry Calculator allows users to:

- Search and select any manufacturing blueprint or reaction
- Configure build parameters (ME, TE, structure, rigs)
- Calculate complete material requirements with prices
- View build steps and job costs
- Analyze buy vs build decisions for components
- Create projects directly from calculations

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Industry Calculator                                              │
│    Calculate manufacturing costs and material requirements          │
├──────────────────────┬──────────────────────────────────────────────┤
│                      │                                              │
│  Blueprint Settings  │  Results Panel                               │
│  ┌────────────────┐ │  ┌──────────────────────────────────────────┐│
│  │ Blueprint      │ │  │ Product Name        [Build All] [Create] ││
│  │ [Search...]    │ │  ├──────────────────────────────────────────┤│
│  │ Qty: [1]       │ │  │ Cost Summary                             ││
│  │ Runs: [1]      │ │  │ Materials: 15.5B   Jobs: 250M            ││
│  │ ME: [10]       │ │  │ Total: 15.75B      Profit: -12.85B       ││
│  │ TE: [20]       │ │  ├──────────────────────────────────────────┤│
│  └────────────────┘ │  │ Output Products                          ││
│  ┌────────────────┐ │  │ Chimera x1  Sell: 2.4B  Duration: 1D 5h ││
│  │ Location       │ │  ├──────────────────────────────────────────┤│
│  │ System: [Jita] │ │  │ Raw Materials (grouped by type)         ││
│  │ Tax: [0%]      │ │  │ ├─ Mineral                              ││
│  └────────────────┘ │  │ │  └─ Tritanium: 145M                   ││
│  ┌────────────────┐ │  │ ├─ Planetary                            ││
│  │ Structure      │ │  │ │  └─ ...                               ││
│  │ Type: [Sotiyo] │ │  ├──────────────────────────────────────────┤│
│  │ Rig: [T2]      │ │  │ Components                              ││
│  └────────────────┘ │  │ Capital Armor Plates x100 🔨 Build      ││
│                      │  │ Capital Thruster x40     🛒 Buy         ││
│  [Calculate Recipe]  │  ├──────────────────────────────────────────┤│
│                      │  │ Build Steps                             ││
│                      │  │ 1. Capital Armor Plates (100 runs)      ││
│                      │  │ 2. Chimera (1 run)                      ││
│                      │  └──────────────────────────────────────────┘│
└──────────────────────┴──────────────────────────────────────────────┘
```

## Features

### Blueprint Search

Autocomplete search for blueprints and reactions:

- Minimum 2 characters to search
- Shows blueprint name and product name
- Distinguishes reactions (purple icon) from manufacturing (blue icon)
- Selects blueprint for calculation

### Build Parameters

**Blueprint Configuration:**
| Field | Range | Default | Description |
|-------|-------|---------|-------------|
| Quantity | 1+ | 1 | Items to produce |
| Runs | 1+ | 1 | Runs per BPC |
| ME | 0-10 | 0 | Material Efficiency |
| TE | 0-20 | 0 | Time Efficiency |

**Location Settings:**
| Field | Description |
|-------|-------------|
| System | Manufacturing system (affects cost index) |
| Facility Tax | Structure tax percentage |

**Structure Settings (Manufacturing):**
| Option | ME Bonus | TE Bonus |
|--------|----------|----------|
| NPC Station | 0% | 0% |
| Raitaru | 1% | 15% |
| Azbel | 1% | 20% |
| Sotiyo | 1% | 30% |

**Structure Settings (Reactions):**
| Option | TE Bonus |
|--------|----------|
| Athanor | 0% |
| Tatara | 25% |

**Rig Options:**
| Option | ME Bonus | TE Bonus |
|--------|----------|----------|
| No Rig | 0% | 0% |
| T1 Rig | 2% | 20% |
| T2 Rig | 2.4% | 24% |

### Buy Mode Toggle

When components have buy recommendations, a toggle appears:

- **Build All** (default): Shows all raw materials for full build
- **Buy Mode**: Adjusts materials for components marked "buy"

In Buy Mode:
- Components show 🛒 (buy) or 🔨 (build) icons
- Raw Materials list is adjusted (subtracts materials for bought components)
- Savings displayed for each component

### Results Sections

**Cost Summary:**
- Materials cost (buy/sell)
- Job installation costs
- Total cost and cost per unit
- Estimated profit

**Output Products:**
- Product name and quantity
- Buy/sell prices
- Total build duration

**Raw Materials:**
- Grouped by item category (Mineral, Planetary, etc.)
- Individual item quantities and prices
- Sortable and expandable groups

**Components:**
- Intermediate items to manufacture
- Build cost vs buy price comparison
- Materials breakdown for each

**Build Steps:**
- Ordered list of manufacturing jobs
- Runs, quantity, and duration per step
- Job cost for each step

### Create Project

"Create Project" button saves calculation as a new project:
- Auto-names based on product and quantity
- Stores all materials and components
- Includes materials breakdown for Buy Mode

## State

```typescript
// Blueprint selection
const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintResult | null>(null)

// Build parameters
const [quantity, setQuantity] = useState(1)
const [runs, setRuns] = useState(1)
const [blueprintMe, setBlueprintMe] = useState(0)
const [blueprintTe, setBlueprintTe] = useState(0)

// Location
const [systemName, setSystemName] = useState("3t7-m8")
const [systemSecurity, setSystemSecurity] = useState<number | null>(-0.5)
const [facilityTax, setFacilityTax] = useState(0)

// Structure
const [structureType, setStructureType] = useState("sotiyo")
const [rigType, setRigType] = useState("t1")
const [reactionStructure, setReactionStructure] = useState("tatara")
const [reactionRig, setReactionRig] = useState("t1")

// Results
const [showBuyRecommendations, setShowBuyRecommendations] = useState(false)
const [isCalculating, setIsCalculating] = useState(false)
const [isCreatingProject, setIsCreatingProject] = useState(false)
const [result, setResult] = useState<CalculateResponse | null>(null)
const [error, setError] = useState("")
```

## API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `GET /api/industry/blueprints/search?q=` | User types in search | Blueprint autocomplete |
| `POST /api/industry/calculate` | User clicks Calculate | Run calculation |
| `POST /api/projects/from-calculation` | User clicks Create Project | Save as project |

## Computed Values

```typescript
// Check for buy recommendations
const hasBuyRecommendations = useMemo(() => {
  return result?.components?.some(c => c.shouldBuy) || false
}, [result?.components])

// Adjusted materials (for buy mode)
const adjustedMaterials = useMemo(() => {
  if (!showBuyRecommendations) return result?.materials || []
  
  // Subtract materials for components marked "buy"
  // ... (see source for full implementation)
}, [result?.materials, result?.components, showBuyRecommendations])
```

## Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Card` | shadcn/ui | Section containers |
| `Button` | shadcn/ui | Actions |
| `Input` | shadcn/ui | Number inputs |
| `Label` | shadcn/ui | Form labels |
| `Select` | Custom | Dropdowns |
| `BlueprintSearch` | Custom | Blueprint autocomplete |
| `SystemSearch` | Custom | System autocomplete |
| `GroupedMaterials` | Custom | Grouped material display |
| `ComponentsList` | Custom | Components with buy/build |
| `BuildSteps` | Custom | Build step list |
| `CostSummary` | Custom | Cost breakdown card |
| `Calculator` | lucide-react | Page icon |
| `Factory` | lucide-react | Manufacturing icon |
| `FlaskConical` | lucide-react | Reaction icon |
| `ShoppingCart` | lucide-react | Buy icon |
| `Hammer` | lucide-react | Build icon |
| `FolderPlus` | lucide-react | Create project icon |

## Industry Components

Located in `components/industry/`:

| Component | Purpose |
|-----------|---------|
| `blueprint-search.tsx` | Blueprint autocomplete input |
| `system-search.tsx` | System name autocomplete |
| `grouped-materials.tsx` | Materials grouped by category |
| `components-list.tsx` | Component list with buy/build indicators |
| `build-steps.tsx` | Manufacturing step breakdown |
| `cost-summary.tsx` | Cost totals display |
| `materials-table.tsx` | Flat material list table |
| `compressed-ores.tsx` | Ore compression display |

## Security Detection

System security is auto-detected and affects rig bonuses:

```typescript
function getSecurityType(security: number | null): 'highsec' | 'lowsec' | 'nullsec' {
  if (security === null) return 'highsec'
  if (security >= 0.5) return 'highsec'
  if (security > 0) return 'lowsec'
  return 'nullsec'
}
```

| Security | Color | Rig Multiplier |
|----------|-------|----------------|
| ≥ 0.5 (Highsec) | Green | 1.0x |
| 0 < x < 0.5 (Lowsec) | Amber | 1.9x |
| ≤ 0 (Nullsec) | Red | 2.1x |

## Related Files

- `app/industry/page.tsx` — Page component
- `components/industry/*` — Industry-specific components
- `app/api/industry/calculate/route.ts` — Calculation endpoint
- `lib/blueprints.ts` — Calculation logic

## See Also

- [Material Efficiency Calculations](../calculations/material-efficiency.md)
- [Time Efficiency Calculations](../calculations/time-efficiency.md)
- [Job Cost Calculations](../calculations/job-costs.md)
- [Buy vs Build Logic](../calculations/buy-vs-build.md)

