# AI Context: Eve Online Industry Tracker

## Project Overview

This is a personal Eve Online industry tracker built with Next.js and Supabase. The application helps track manufacturing progress across multiple industry projects in the game.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Supabase
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Market Data:** Janice API v2

## User Flow

### 1. Home Page (`/`)

- Displays a grid of existing projects
- "New Project" button to create a new project
- Click any project card to view details

### 2. Create Project (`/projects/new`)

- **Project Name:** Text input for naming the project
- **Raw Materials:** Large textarea to paste Eve Online item list (e.g., from inventory copy)
- **Components:** Second textarea for intermediate products/components
- On submit:
  - Both lists are sent to Janice API for parsing and price lookup
  - Parsed items are stored in Supabase with current Jita prices
  - Redirects to project detail page

### 3. Industry Calculator (`/industry`)

The industry calculator helps you plan manufacturing by calculating material requirements and costs for any blueprint.

#### Blueprint Configuration
- Search and select any manufacturing blueprint or reaction formula
- Configure quantity to build
- Set blueprint ME (Material Efficiency) and TE (Time Efficiency)
- Choose manufacturing location (system) for cost index calculations
- Select structure type and rig for bonuses

#### Results Display
- **Output Products**: Shows the final product with quantity, prices, and build duration
- **Cost Summary**: Displays total material costs, job costs, and estimated profit
- **Raw Materials**: Lists all base materials needed that cannot be built
- **Components**: Intermediate items that need to be manufactured
- **Build Steps**: Detailed breakdown of each manufacturing step

#### Buy Mode Toggle
Located at the top of results when components are available:

- **Build All Mode** (default): Shows all raw materials needed to build everything from scratch
- **Buy Mode**: When enabled, the calculator identifies components that are cheaper to buy than build and:
  - Highlights components with shopping cart icons (buy) vs hammer icons (build)
  - **Adjusts the Raw Materials list** by subtracting materials needed for components you'll buy
  - Shows potential savings from buying vs building each component
  - Raw Materials section shows a "Buy Mode" badge indicating adjusted quantities

This allows you to see exactly what materials to purchase for components you'll build, while buying other components directly from the market.

### 4. Project Detail (`/projects/[id]`)

#### Buy Mode Toggle
For projects created from the Industry Calculator, a Buy Mode toggle appears in the header when components have buy recommendations:

- **Build All Mode** (default): Shows all raw materials needed to build everything
- **Buy Mode**: When enabled:
  - Shows which components are cheaper to buy (shopping cart icon) vs build (hammer icon)
  - **Adjusts the Raw Materials list** by subtracting materials needed for purchased components
  - Updates price summaries to reflect adjusted material costs
  - Components marked for buying are highlighted with a green background

This feature is only available for projects created from the Industry Calculator, as it requires material breakdown data that's calculated during the manufacturing analysis.

#### Item Lists

- Two lists displayed side-by-side: Raw Materials and Components
- Each item shows:
  - Checkbox to mark as collected/obtained
  - Item name
  - Quantity required
  - Jita Buy value (quantity × unit price)
- **Copy Dropdown** per list:
  - "Copy All" - copies all items in Eve format
  - "Copy Remaining" - copies only unchecked items
- Collected status persists to database

#### Jita Prices Summary

- Based on **raw materials only** (not components, since you build those)
- Jita Buy total (what you'd pay to buy all raw materials)
- Jita Sell total (what you'd get selling all raw materials)
- Jita Split total (average of buy/sell)
- Click any value to copy to clipboard

#### Additional Costs Section

- Input for note + amount to add extra costs
- Examples: manufacturing fees, transport costs, broker fees
- List of added costs with delete option
- Running total of additional costs

#### Total Project Cost

- Grand total = Jita Buy (raw materials) + Additional Costs
- Displays both abbreviated (e.g., "1.5B ISK") and full value
- Copy button for the total

## Data Model

See [docs/supabase.md](./supabase.md) for full schema.

```
Project
├── id, name, created_at, updated_at
│
├── Raw Materials[]
│   ├── item_name, type_id, quantity
│   ├── collected (checkbox state)
│   └── buy_price, sell_price, split_price
│
├── Components[]
│   ├── item_name, type_id, quantity
│   ├── collected (checkbox state)
│   └── buy_price, sell_price, split_price
│
└── Additional Costs[]
    ├── note (description)
    └── amount (ISK value)
```

## API Integration

### Janice API

- **Documentation:** https://janice.e-351.com/api/rest/docs/index.html
- **Swagger:** https://janice.e-351.com/api/rest/v2/swagger.json
- **Auth:** API key via `X-ApiKey` header
- **Endpoint:** `POST /api/rest/v2/appraisal`
- **Input:** Plain text item list (Eve Online copy format)
- **Output:** Parsed items with Jita buy/sell/split prices

### Environment Variables

```env
# Required - Supabase connection
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional - Janice API for market prices
# If not set, items will be parsed without price data
JANICE_API_KEY=your_janice_api_key
```

## Eve Online Context

For AI assistants unfamiliar with Eve Online:

- **Industry** refers to the manufacturing system in the game
- Players gather raw materials (minerals, planetary resources, moon goo, etc.)
- These materials are used to build components
- Components are combined to build final products (ships, modules, structures)
- Manufacturing chains can be complex with multiple tiers of intermediate products
- **Jita** is the main trade hub where most market transactions occur
- **ISK** is the in-game currency

## Development Notes

- This is a personal project, so the UI should be functional and clean
- Progress tracking and at-a-glance status are the primary UX goals
- The app makes it easy to copy item lists back to the game clipboard
- All prices are fetched once on project creation (not live-updated)
