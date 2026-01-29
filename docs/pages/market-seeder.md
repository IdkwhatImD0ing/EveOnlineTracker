# Market Seeder Page

The Market Seeder page helps identify the most profitable items to import from Jita to your alliance market hub.

## Overview

**Path:** `/market-seeder`

**Purpose:** Analyze market data to find items with the best profit margins for import.

## Features

The page has six main tabs: **Dashboard**, **Analysis**, **Watchlist**, **Essentials**, **Depletion**, and **Market**.

The **Dashboard** tab contains two sub-tabs:

- **Capital** - Track capital efficiency and identify dead capital
- **Velocity** - Track daily ISK profit, trends, and set goals

The **Market** tab contains three sub-tabs:

- **Undercut** - Track and respond to competitors undercutting your sell orders
- **Sell** - Generate optimal sell prices for your 3T7 inventory
- **History** - Analyze completed orders to find your most profitable items

---

## Dashboard Tab

The Dashboard tab combines capital efficiency analysis with trading velocity tracking to give you a complete picture of your trading performance.

---

### Capital Sub-Tab

Track your ISK-at-work across all market sell orders. The Capital sub-tab shows where your capital is deployed and calculates ROI metrics.

### Concept

Show where your capital is deployed and how efficiently it's working. Identify "dead capital" - ISK tied up in slow-moving orders that could be better deployed elsewhere.

### Key Metrics

| Metric             | Formula                                  | Description                        |
| ------------------ | ---------------------------------------- | ---------------------------------- |
| Total ISK Deployed | Sum of `price × volumeRemain`            | All capital tied up in sell orders |
| Est. Daily Revenue | Sum of `capitalDeployed / daysToSell`    | Expected daily ISK returned        |
| Avg Days to Sell   | Capital-weighted average                 | How long until orders clear        |
| Effective APY      | `(profit/cost) × (365/daysToSell) × 100` | Annualized return rate             |

### Demand Estimation

Demand is estimated using **regional market history data** with a configurable **hub factor** (the percentage of regional volume your hub sees). The default is 5%, but this can be adjusted in the header dropdown.

```
estimatedDailySales = regionalDailyVolume × hubFactor  // e.g., 5% of regional volume
daysToSell = volumeRemain / estimatedDailySales
```

### Volume Settings

Two dropdowns in the page header control demand estimation:

| Setting           | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| **Volume Region** | Which region's market history to use (Vale, Deklein, or The Forge)      |
| **Hub Factor**    | Percentage of regional volume your hub sees (1%, 2%, 5%, 10%, 15%, 20%) |

These settings persist in localStorage and apply to all tabs (Dashboard, Analysis, Depletion, etc.).

### System Filter

When your sell orders span multiple structures/systems, a **System** dropdown appears in the Capital sub-tab header. This allows you to:

- View metrics for **All Systems** (default) - aggregated view of all orders
- Filter to a **specific structure** - view orders and recalculated metrics for one location only

The dropdown shows:

- Structure name (for known structures like 3T7-M8 Keepstar)
- Structure ID (for unknown structures)
- Order count per location in parentheses

When a specific system is selected, all metrics (Total ISK Deployed, Daily Revenue, APY, efficiency breakdown) are recalculated for only that location's orders.

### Character Breakdown

When you have multiple EVE characters linked to your account, the Capital sub-tab shows a **Capital by Character** section with:

- **Pie Chart** - Visual breakdown of capital distribution across characters, color-coded
- **Character Cards** - Summary for each character showing:
  - Character name
  - Capital deployed (ISK)
  - Percentage of total capital
  - Number of orders
  - Effective APY

A **Character** dropdown filter appears in the header when you have multiple characters, allowing you to:

- View metrics for **All Characters** (default) - aggregated view across all accounts
- Filter to a **specific character** - view orders and recalculated metrics for one character only

Each order in the Orders List shows the owning character name with a color-coded indicator matching the pie chart.

### Efficiency Categories

Orders are categorized by how long they'll take to sell:

| Category | Days to Sell | Visual |
| -------- | ------------ | ------ |
| Fast     | < 14 days    | Green  |
| Moderate | 14-30 days   | Amber  |
| Slow     | 30-90 days   | Orange |
| Dead     | > 90 days    | Red    |

### Dead Capital Alerts

Orders estimated to take more than **90 days to sell** are flagged as "dead capital". These represent inefficient capital deployment - the ISK could potentially earn better returns elsewhere.

The dashboard shows:

- Count of dead capital orders
- Total ISK in dead capital
- Percentage of total capital that's dead

### Summary Cards

| Card               | Description                        |
| ------------------ | ---------------------------------- |
| Total ISK Deployed | Sum of all sell order values       |
| Est. Daily Revenue | Expected daily ISK based on demand |
| Avg Time to Sell   | Capital-weighted average days      |
| Effective APY      | Portfolio-wide annualized return   |

### Capital Allocation Chart

Visual breakdown showing what percentage of capital is in each efficiency category (Fast/Moderate/Slow/Dead).

### Orders List

All sell orders sorted by days-to-sell (slowest first to highlight problematic orders):

- Item name and category
- Volume remaining and price
- Capital deployed
- Days to sell badge (color-coded)
- Effective APY badge

Slow and dead capital orders show expanded details:

- Estimated daily sales
- Days listed
- Jita buy price
- Profit per unit

### Requirements

**ESI Scope:** `esi-markets.read_character_orders.v1`

The Capital sub-tab requires character-level order access, not just structure market access.

### API Endpoint

**GET /api/esi/capital-efficiency**

| Parameter        | Type   | Description                                                     |
| ---------------- | ------ | --------------------------------------------------------------- |
| transport_cost   | number | Optional - ISK/m³ for cost basis (default: 450)                 |
| volume_region_id | number | Optional - Region ID for volume data (default: 10000003 / Vale) |
| hub_factor       | number | Optional - Hub factor percentage (default: 0.05 / 5%)           |

Returns:

- Summary metrics (total deployed, daily revenue, APY, dead capital)
- Per-order breakdown with efficiency classification and character ownership
- Capital allocation by efficiency category
- Capital allocation by character (with per-character APY and daily revenue)

**Per-Order Fields:**

Each order includes `characterId` and `characterName` indicating which linked character owns that sell order.

**Per-Character Summary:**

| Field           | Description                          |
| --------------- | ------------------------------------ |
| characterId     | EVE character ID                     |
| characterName   | Character name                       |
| capitalDeployed | Total ISK deployed by this character |
| orderCount      | Number of active sell orders         |
| percentage      | Percentage of total capital          |
| dailyRevenue    | Estimated daily revenue              |
| effectiveAPY    | Character's portfolio APY            |

**Note:** Demand estimation uses the selected region's market data × configurable hub factor (default: 5%).

### Progress Tracking

The Capital Efficiency analysis uses Server-Sent Events (SSE) to show real-time progress:

| Stage       | Description                                   |
| ----------- | --------------------------------------------- |
| starting    | Initializing analysis                         |
| characters  | Fetching orders for each linked character     |
| metadata    | Loading item names and categories             |
| market_data | Fetching regional volumes and Jita prices     |
| analyzing   | Calculating efficiency metrics for each order |
| summary     | Computing portfolio-wide metrics              |
| complete    | Analysis finished                             |

---

### Velocity Sub-Tab (ISK Velocity Leaderboard)

Track your ISK/day earned from trading, compare item performance, analyze trends, and set profit goals.

#### Concept

Gamify your trading to optimize performance:

- Track ISK/day earned from trading
- Compare items: "Which items made me the most ISK this week?"
- Trend analysis: "Your trading is improving/declining"
- Goal setting: "Reach 1B ISK/day profit"

#### Summary Cards

| Card            | Description                                                |
| --------------- | ---------------------------------------------------------- |
| Avg ISK/Day     | Average daily profit with trend indicator (up/down/stable) |
| Best Day        | Highest single-day profit with date                        |
| Last 7 Days Avg | Recent performance average                                 |
| Goal Progress   | Progress toward your daily ISK target (if set)             |

#### Daily Profit Chart

Visual bar chart showing ISK/day over the selected period (7d/30d/90d):

- Green bars = Positive profit days
- Red bars = Negative profit days
- Goal line overlay when a goal is set
- Hover for exact values
- Fixed 192px height with minimum 4px bars for visibility
- Date labels at start, middle, and end
- Empty state with "No profit data available" message when no completed orders

#### Top Performers

Items ranked by total profit over the selected period:

- Item name with icon
- Total profit and profit/day
- Order count and quantity sold
- Expandable rows for detailed metrics (revenue, category, profit/day)
- Shows all items (not limited) with filter sidebar

#### Filter Sidebar

The Velocity sub-tab includes a filter sidebar (visible on desktop, collapsible on mobile) with the following options:

| Filter               | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Profit Status**    | All Items / Profitable Only / Loss Only                                                            |
| **Min Total Profit** | Minimum total profit in millions ISK                                                               |
| **Categories**       | Checkboxes for Modules, Ships, Ammo, Boosters, Drones, Fighters, Implants, Deployables, Subsystems |

A **Reset Filters** button appears when any filters are modified from defaults.

#### Trend Analysis

Compares recent 7-day average against older period average:

| Trend  | Condition              | Threshold |
| ------ | ---------------------- | --------- |
| Up     | Recent avg > Older avg | +10%      |
| Down   | Recent avg < Older avg | -10%      |
| Stable | Within +/-10%          | -         |

Provides actionable feedback:

- "Great work! Your trading performance is improving."
- "Your trading has slowed down. Consider reviewing your strategies."
- "Your trading performance is consistent."

#### Goal Setting

Set a daily ISK target to track progress:

1. Click "Set Goal" in the Goal Progress card
2. Enter target in billions (e.g., "1.0" for 1B ISK/day)
3. Click "Set" to save

Goals are stored in localStorage and persist across sessions.

**Goal Progress Indicator:**

- Progress bar fills based on current avg vs target
- Celebration state when goal is achieved
- "Clear" button to remove goal

**localStorage Key:** `eve-tracker-trading-goal`

```typescript
{
  dailyTarget: number,        // Target ISK per day
  setAt: string,              // ISO date when set
  notificationsEnabled: boolean
}
```

#### Time Periods

| Period  | Description                    |
| ------- | ------------------------------ |
| 7 Days  | Last week of trading           |
| 30 Days | Last month (default)           |
| 90 Days | Last quarter (max ESI history) |

**Note:** ESI only provides order history for the last 90 days.

#### AI Import Recommendations

Click **Analyze with AI** to get personalized recommendations on which items to import next. The AI analyzes your sales history and provides actionable advice.

**Features:**

- Uses OpenAI GPT-5-mini to analyze your top-performing items
- Streaming response - see the analysis appear in real-time
- Session caching - analyses are cached so they won't regenerate if you click again
- Collapsible "AI Reasoning" section shows the model's thought process

**What the AI analyzes:**

- **Top Performers**: Which items made the most ISK and why they're worth restocking
- **Hidden Gems**: Items with good profit margins that might be overlooked
- **Items to Reconsider**: Any items with low/negative profit that might not be worth the effort
- **Trend Insights**: Is your performance improving or declining? What might explain it?
- **Actionable Recommendations**: A prioritized list of what to import next

**Requirements:**

- Set `OPENAI_API_KEY` environment variable with your OpenAI API key
- Must have velocity data loaded (click Refresh first)

**API Endpoint:**

**POST /api/market/analyze-velocity**

| Parameter | Type   | Required | Description                                         |
| --------- | ------ | -------- | --------------------------------------------------- |
| topItems  | array  | Yes      | Array of top performer items from velocity analysis |
| trend     | object | Yes      | Trend analysis data (direction, percentChange, etc) |
| summary   | object | Yes      | Summary statistics (avgProfitPerDay, totalProfit)   |
| period    | string | Yes      | Time period: '7d', '30d', or '90d'                  |

Returns a streaming SSE response with AI-generated import recommendations.

#### API Endpoint

**GET /api/esi/trading-velocity**

| Parameter      | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| period         | string | No       | Time period: '7d', '30d', or '90d' (default: '30d') |
| transport_cost | number | No       | ISK per m3 for cost calculation (default: 450)      |

**Response:**

```json
{
  "success": true,
  "dailyProfit": [
    {
      "date": "2025-12-30",
      "profit": 500000000,
      "revenue": 2000000000,
      "orders": 15
    }
  ],
  "topItems": [
    {
      "typeId": 2048,
      "typeName": "Damage Control II",
      "categoryName": "Module",
      "totalProfit": 150000000,
      "totalRevenue": 500000000,
      "orderCount": 10,
      "quantitySold": 200,
      "profitPerDay": 5000000
    }
  ],
  "trend": {
    "direction": "up",
    "percentChange": 15.5,
    "recentAvg": 550000000,
    "olderAvg": 476000000
  },
  "summary": {
    "avgProfitPerDay": 500000000,
    "bestDay": {"date": "2025-12-28", "profit": 800000000},
    "worstDay": {"date": "2025-12-15", "profit": 50000000},
    "totalProfit": 15000000000,
    "totalRevenue": 60000000000,
    "totalOrders": 450,
    "daysWithData": 30,
    "charactersQueried": 2
  },
  "period": "30d",
  "analyzedAt": "2025-12-31T12:00:00Z",
  "config": {"transportCostPerM3": 450}
}
```

#### Requirements

**ESI Scope:** `esi-markets.read_character_orders.v1`

The Velocity sub-tab reads order history, which requires the market orders scope.

---

## Analysis Tab

### Search Settings

Configure the analysis parameters:

| Setting            | Description                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Structure**      | Dropdown to select your alliance market hub (default: 3T7-M8 Keepstar). Includes "Other (Custom ID)" option. |
| **Transport Cost** | ISK per m³ for Jump Freighter shipping (default: 450)                                                        |

### Sidebar Filters

After running an analysis, filter results using the sidebar on the right:

| Filter                    | Description                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Min Margin %**          | Minimum profit margin percentage (client-side filter)                                                   |
| **Max Jita Cost**         | Maximum Jita price in ISK (leave empty for no limit)                                                    |
| **Min Orders/Day**        | Minimum estimated daily sales at hub (regional volume × hub factor)                                     |
| **Min Profit/Day**        | Minimum estimated daily profit in ISK (profit per unit × orders/day)                                    |
| **No Competition Only**   | Show only items with no existing sell orders                                                            |
| **None in Inventory**     | Hide items you already have in your inventory (across all locations)                                    |
| **No Sell Orders (Mine)** | Hide items you already have active sell orders for (in target structure)                                |
| **Categories**            | Checkboxes for Modules, Ships, Ammo, Boosters, Drones, Fighters, Implants, Deployables, Subsystems      |
| **Meta Types**            | Filter by item quality tier: Tech I, Tech II, Tech III, Faction, Deadspace, Officer, Storyline, Abyssal |
| **Reset Filters**         | Button to restore default filter values                                                                 |

### Results Table

Results are displayed in a sortable, paginated table with 50 items per page:

| Column      | Description                                                       | Sortable      |
| ----------- | ----------------------------------------------------------------- | ------------- |
| Checkbox    | Select item for Copy Buy Text                                     | No            |
| Name        | Item name with trend indicator                                    | Yes           |
| Score       | Composite profitability score                                     | Yes (default) |
| Margin      | Profit margin percentage                                          | Yes           |
| Profit/Unit | ISK profit per unit                                               | Yes           |
| ISK/Day     | Estimated daily revenue (sell price × daily volume at hub factor) | Yes           |
| Competition | Yes/No badge                                                      | Yes           |
| Vol/Day     | Regional daily volume × hub factor (estimated hub sales)          | Yes           |

Click a row to expand and see additional details:

- Jita price, Transport cost, Target price
- Profit/m³, Volume, Regional daily volume
- Supply quantity for selected days (at hub factor % of regional volume)
- Category and group

### Copy Buy Text Feature

Select items using checkboxes and copy a shopping list for Eve Online's multibuy feature.

**Selection Action Bar:**
When items are selected, a sticky action bar appears showing:

- Number of selected items
- **Supply duration selector**: Choose from presets (1 day, 3 days, 1 week, 30 days) or enter custom days
- "Clear" button to deselect all
- "Copy Buy Text" button

**Copy Buy Text Button:**
Copies selected items to clipboard in Eve Online multibuy format:

```
Item Name 100
Another Item 50
Third Item 1
```

**Quantity Calculation:**

- Each item gets the selected days' supply at hub factor % of regional volume
- Formula: `quantity = ceil(avgDailyVolume × hubFactor × days)`

**Note:** Selected items are automatically cleared when running a new analysis.

- Presets: 1 day, 3 days, 7 days (1 week), 30 days, or custom
- Minimum quantity is always 1
- This ensures you stock enough to meet estimated demand at your hub

## Tiered Pricing (No Competition)

When there are no existing sell orders for an item in your structure, a **tiered markup** is applied based on Jita price. Cheaper items can sustain higher markups since absolute profit is lower:

| Jita Price | Multiplier | Effective Margin |
| ---------- | ---------- | ---------------- |
| < 500K ISK | 4.0x       | ~300%            |
| < 2M ISK   | 3.0x       | ~200%            |
| < 10M ISK  | 2.0x       | ~100%            |
| < 50M ISK  | 1.7x       | ~70%             |
| >= 50M ISK | 1.4x       | ~40%             |

**Example target prices:**

- 100K ISK item → 400K ISK (4x markup)
- 1M ISK item → 3M ISK (3x markup)
- 30M ISK item → 51M ISK (1.7x markup)

When competitors have sell orders, the target price matches the competitor's lowest price.

---

## Scoring Algorithm

Items are ranked by a **volume-weighted composite score** that balances profitability with realistic sellability.

### Base Score Factors

| Factor               | Weight | Description                                    |
| -------------------- | ------ | ---------------------------------------------- |
| Profit Margin %      | 25%    | Higher margins = better capital efficiency     |
| Profit per m³        | 30%    | Transport efficiency (ISK per cargo space)     |
| Vale Demand          | 25%    | Higher regional volume = more potential buyers |
| Absolute Profit      | 20%    | Raw ISK profit per unit                        |
| No Competition Bonus | +15    | Bonus for items with no existing orders        |

### Volume Multiplier

The base score is multiplied by `sqrt(avgDailyVolume)` to heavily favor high-volume items:

```
finalScore = baseScore × sqrt(avgDailyVolume)
```

This ensures rare expensive items (like officer modules selling 1/day) don't outrank common items that will actually sell in your market hub.

| Daily Volume    | Multiplier | Example Items      |
| --------------- | ---------- | ------------------ |
| 10 units/day    | 3.2x       | Faction modules    |
| 100 units/day   | 10x        | Popular T2 modules |
| 1,000 units/day | 31.6x      | Common ships, ammo |

### Minimum Filters

Items must meet these thresholds to appear (configurable via Advanced Settings):

| Filter              | Default     | Description                                                        |
| ------------------- | ----------- | ------------------------------------------------------------------ |
| Min Volume/Day      | 10 units    | Minimum average daily trading volume in the selected Volume Region |
| Min Profit Margin   | 10%         | Minimum profit as percentage of cost                               |
| Min Profit per Unit | 100,000 ISK | Minimum ISK profit per unit                                        |
| Min Jita Price      | 10,000 ISK  | Fixed minimum price threshold                                      |

## Requirements

### Authentication

Requires EVE SSO login with scopes:

- `esi-markets.structure_markets.v1` (for Analysis/Watchlist/Depletion tabs)
- `esi-markets.read_character_orders.v1` (for Capital Efficiency tab)

### Data Sources

- **Vale Market History**: 365 days cached in Supabase (via RPC batches, daily updates via cron)
- **Jita Market History**: For Market Opportunities and Sell Opportunities pages only
- **Structure Orders**: Real-time from ESI (authenticated)
- **Jita Prices**: Real-time from ESI regional orders (public API) - used for cost basis

## Progress Tracking

The analysis uses Server-Sent Events (SSE) to show real-time progress:

| Stage            | Description                                               |
| ---------------- | --------------------------------------------------------- |
| Loading          | Loading ~5,800 tradeable items from file                  |
| Market History   | Fetching Vale demand metrics via RPC batches (30 batches) |
| Structure Orders | Fetching orders from your alliance hub                    |
| Jita Prices      | Fetching current Jita sell prices (~290 ESI batches)      |
| Analyzing        | Computing profit metrics per item                         |
| Filtering        | Applying minimum threshold filters                        |
| Scoring          | Calculating composite profitability scores                |
| Ranking          | Generating sorted result lists                            |

## Usage Flow

1. **Login with EVE SSO** if not already authenticated
2. **Select Structure** from the dropdown (3T7-M8 Keepstar is default, or choose "Other" for custom ID)
3. **Configure Volume Settings** in the header (Volume Region and Hub Factor)
4. **Set Transport Cost** (default 450 ISK/m³)
5. **Click "Run Analysis"** to fetch and analyze data
6. **Watch Progress Bar** as each stage completes
7. **Browse Results** using the tabs to find profitable items
8. **Click Items** to see detailed profit breakdown (includes supply quantity at hub factor %)
9. **Select Items** using checkboxes for items you want to buy
10. **Click "Copy Buy Text"** to copy shopping list (quantities based on selected days @ hub factor)
11. **Paste in Eve** using the multibuy feature to purchase items

## Performance

| Scenario                  | Typical Time |
| ------------------------- | ------------ |
| Cold cache                | 1-2 minutes  |
| Warm cache (within 5 min) | 5-10 seconds |

The main bottleneck is fetching ~5,800 Jita prices from ESI (20 concurrent requests with rate limiting).

## Settings Persistence

All settings are saved to localStorage:

- `market-seeder-settings`: JSON object with structureId, transportCost, minMargin, maxJitaCost, minOrdersPerDay, minProfitPerDay, noCompetitionOnly, hideInInventory, hideWithSellOrders, selectedCategories, selectedMetaTypes
- `eve-tracker-volume-region`: Selected volume region ID
- `eve-tracker-hub-factor`: Selected hub factor (e.g., 0.05 for 5%)

---

## Watchlist Tab (Personal)

The Watchlist tab allows you to track specific items that YOU choose and monitor their stock levels and depletion metrics in your alliance structure. This is your personal tracking list - add any items you want to monitor.

The UI matches the Depletion tab but works with your curated list of items instead of all sell orders.

### Features

#### Add Items to Watchlist

- Use the search input to find items from the ~5,800 tradeable items
- Type at least 2 characters to search
- Click an item to add it to your watchlist
- Items already in the watchlist are filtered from search results

#### Monitor Stock Levels

- Click **Refresh Stock** to check current sell order volumes and calculate depletion metrics
- Requires Structure ID to be set (from Analysis tab)
- Requires EVE SSO authentication

#### Copy Restock List

After checking stock levels, a **Copy Restock List** button appears when there are items needing restocking (Critical or Warning status). Click the button to open a dropdown with options.

**Dropdown Options:**

| Option           | Description                                  | Default         |
| ---------------- | -------------------------------------------- | --------------- |
| Include Critical | Checkbox - include items with 0 stock        | Checked         |
| Include Warning  | Checkbox - include items with < 3 days stock | Checked         |
| Days of supply   | 1, 3, 7, 14, 30 days                         | 7 days (1 week) |
| Limit items      | All matched, Top 5, Top 10, Top 20           | All matched     |

Each checkbox shows a badge with the count of items in that urgency level.

**Behavior:**

- Filters items based on selected urgency checkboxes
- Items are ranked by urgency (most critical first)
- Items with existing sell orders from the user are not included in Critical or Warning counts
- Copy button shows exact count of items that will be copied
- Uses Eve Online multibuy format: `Item Name Quantity`
- Quantity = estimatedDailySales × selected days (minimum 1)

**Example output (7 days supply):**

```
Damage Control II 45
Medium Shield Extender II 22
Gyrostabilizer II 18
```

Click **Copy N items** in the dropdown, then paste directly into Eve Online's multibuy feature.

### Table Display

Items are displayed in a sortable table with the following columns:

| Column     | Description                | Sortable |
| ---------- | -------------------------- | -------- |
| Item       | Icon + name                | Yes      |
| Stock      | Current units in structure | Yes      |
| Sales/Day  | Estimated daily sales      | Yes      |
| Days Left  | Days until stockout        | Yes      |
| Profit/Day | Daily profit potential     | Yes      |
| Status     | Urgency badge              | Yes      |

Click any row to expand and see additional details (category, group, etc.). Click the column headers to sort by that column (ascending/descending toggle).

**Pagination:** Items are paginated with 50 items per page.

### Sidebar Filters

The tab includes a filter sidebar (visible on desktop, collapsible on mobile) with the following options:

**Numeric Filters:**
| Filter | Description |
|--------|-------------|
| Min Orders/Day | Minimum estimated daily sales (at hub factor %) |
| Min Profit/Day | Minimum ISK profit per day |
| Max Jita Cost | Maximum item cost in Jita (leave empty for no limit) |

**Toggle Filters:**

- **No active order** - Show only items where you do NOT have active sell orders (useful for finding items to create new orders for)

**Urgency Level Filters:**
| Filter | Description |
|--------|-------------|
| Critical (0 stock) | Show items that are completely out of stock |
| Warning (<3 days) | Show items with less than 3 days of stock |
| OK (≥3 days) | Show items with 3 or more days of stock |
| No Data | Show items without regional volume data |

**Category Filters:**
Filter by Modules, Ships, Ammo, Boosters, Drones, Fighters, Implants, Deployables, and Subsystems.

A **Reset Filters** button appears when any filters are modified from defaults.

### Core Formulas

The same formulas used in the Depletion tab:

```
estimated_daily_sales = regional_avg_daily_volume × hub_factor  // e.g., 5% of regional volume
days_until_stockout = current_stock ÷ estimated_daily_sales
daily_profit = estimated_daily_sales × profit_per_unit
```

### Urgency Levels

Items are color-coded by their urgency status. Items where you have an existing sell order are not flagged as critical or warning:

| Level    | Condition                   | Visual                            |
| -------- | --------------------------- | --------------------------------- |
| Critical | 0 stock AND no sell order   | Red border + "Out of Stock" badge |
| Warning  | < 3 days AND no sell order  | Amber border + "Low Stock" badge  |
| Safe     | >= 3 days OR has sell order | Green border + "OK" badge         |
| No Data  | N/A                         | Gray badge (no Vale volume data)  |

### Summary Cards

When items are in the watchlist, summary cards show:

- **Items Tracked**: Number of items being tracked
- **Critical**: Items with 0 stock (red highlight)
- **Warning**: Items with < 3 days of stock (amber highlight)
- **Daily Profit Potential**: Total ISK/day across all items

### Item Cards

Each watchlist item displays:

- Item name with category icon
- **Current Stock**: Total units across all your sell orders for this item
- **Est. Daily Sales**: Predicted units sold per day (Vale volume × 5%)
- **Days Until Stockout**: When you'll run out (color-coded)
- **Daily Profit**: Potential daily profit from this item
- Urgency badge (Critical/Low Stock/OK/No Data)
- Remove button to delete from watchlist

### Database Storage

Watchlist items are stored in Supabase (`watchlist_items` table) and persist across sessions. The watchlist is shared (not per-user) since the alliance structure is shared.

### Watchlist Usage Flow

1. Select Structure in the Analysis tab (3T7-M8 Keepstar is default)
2. Switch to the Watchlist tab
3. Search and add items you want to track
4. Click **Refresh Stock** to check current levels and depletion metrics
5. Use the **sidebar filters** to filter by urgency level, category, or sell order status
6. Review items sorted by urgency (Critical first, then Warning)
7. Click **Copy Restock List** to copy all Critical/Warning items (respects current filters)
8. Paste in Eve Online multibuy to purchase 1 week's supply

### Data Sources

The watchlist fetches:

1. **Structure Orders** (`/api/watchlist?structure_id=...`) - Stock levels for watchlist items
2. **Vale Market History** (via RPC) - Daily volume data for sales estimates
3. **Jita Prices** (via ESI) - Current Jita prices for profit calculation

---

## Essentials Tab (Nullsec Curated)

The Essentials tab displays a hand-picked list of ~140 essential items for nullsec living in Guristas space (Deklein region). Unlike the personal Watchlist, this list is admin-managed and shared across all users.

### Concept

A focused, hand-curated collection of the most important items:

- **33 ships**: Ratting (Ishtar, Gila, VNI, Dominix), Mining (ALL barges & exhumers: Venture, Covetor, Retriever, Procurer, Hulk, Mackinaw, Skiff, Porpoise, Orca), T3 Cruisers (Tengu, Legion, Proteus, Loki), T2 Haulers (Bustard, Impel, Mastodon, Occator, Torrent, Crane, Prorator, Prowler, Viator, Deluge), Utility (Epithal, Tayra, Astero, Heron), PvP (Sabre, Stiletto)
- **48 T3 subsystems**: All subsystems for Tengu, Legion, Proteus, and Loki
- **12 drones**: Kinetic (Wasp II, Vespa II, Hornet II), Thermal (Ogre II, Hammerhead II, Hobgoblin II), Mining, Salvage
- **~40 modules**: Drone mods, mining equipment (T1 & T2 strip miners, mining laser upgrades, ice harvesters), shield tank, propulsion, tackle, cloaking, deployables
- **Exploration gear**: Probe launchers, scanner probes
- **Kinetic ammunition**: Scourge missiles for Guristas NPCs
- **Essential rigs**: Shield extender rigs, drone rigs

### Key Differences from Watchlist

| Feature      | Watchlist              | Essentials               |
| ------------ | ---------------------- | ------------------------ |
| Purpose      | Personal tracking      | Alliance-wide essentials |
| Add Items    | Users can add any item | Admin only (via script)  |
| Remove Items | Users can remove       | Admin only               |
| Database     | `watchlist_items`      | `essential_items`        |

### Features

- Same stock level checking as Watchlist
- Same depletion metrics (days until stockout, daily profit)
- Same urgency badges (Critical/Warning/OK)
- Same "Copy Restock List" feature with dropdown options
- **No add/search** - items are pre-curated
- **Admin delete button** - only admins can remove items

### Populating the Essentials List

Run the setup script to populate essentials:

```bash
npx tsx scripts/add-deklein-nullsec-items.ts
```

This adds ~140 hand-picked items to the `essential_items` table:

- 33 ships (ratting, ALL mining barges/exhumers, T3 cruisers, T2 haulers, utility, PvP)
- 48 T3 subsystems (all Tengu/Legion/Proteus/Loki subsystems)
- 12 drones (kinetic for Guristas, thermal, mining, salvage)
- ~40 modules (drone mods, T1/T2 mining equipment, shields, propulsion)
- Exploration gear, kinetic ammo, and essential rigs

### Admin Management

Admins can remove items directly from the UI by clicking the trash icon on each item card. To add new items in bulk, update and re-run the script.

### API Endpoints

| Endpoint                   | Method | Access    | Description                        |
| -------------------------- | ------ | --------- | ---------------------------------- |
| `/api/essentials`          | GET    | All users | Fetch essentials with stock levels |
| `/api/essentials`          | POST   | Admin     | Add item to essentials             |
| `/api/essentials/[typeId]` | DELETE | Admin     | Remove item from essentials        |

---

## Depletion Predictor Tab

The Depletion Predictor tab analyzes **all items currently being sold in your structure** to predict when they will sell out and prioritize restocking by profit potential.

### Concept

Combine Vale of the Silent volume data (actual regional demand) with your structure's current sell orders to predict stockouts before they happen. Your edge: know exactly when to restock before you lose sales - regular traders react AFTER stockout.

### Core Formulas

```
estimated_daily_sales = regional_avg_daily_volume × hub_factor  // e.g., 5% of regional volume
days_until_stockout = current_stock ÷ estimated_daily_sales
priority_score = estimated_daily_sales × profit_per_unit
```

### How It Works

1. Click **Analyze Depletion** to fetch all sell orders and market data
2. For each item type you're selling, the system calculates:
   - **Estimated Daily Sales**: Regional Volume × Hub Factor (configurable in header)
   - **Days Until Stockout**: Current stock ÷ estimated daily sales
   - **Daily Profit Potential**: Estimated sales × profit per unit
3. Items are ranked by **Priority Score** (higher = more urgent)

### Urgency Levels

Items are color-coded by their stock status:

| Level    | Condition | Visual                               |
| -------- | --------- | ------------------------------------ |
| Critical | 0 stock   | Red border + "Critical" badge        |
| Warning  | < 3 days  | Amber border + "Low Stock" badge     |
| Safe     | >= 3 days | Green border + "OK" badge            |
| No Data  | N/A       | Gray badge (no regional volume data) |

### Summary Cards

When predictions are available, summary cards show:

- **Items Tracked**: Total unique items being sold
- **Critical**: Items with 0 stock (red highlight)
- **Warning**: Items with < 3 days of stock (amber highlight)
- **Daily Profit Potential**: Total ISK/day across all items

### Item Cards

Each prediction card displays:

- Item name with category icon
- **Current Stock**: Total units across all your sell orders for this item
- **Est. Daily Sales**: Predicted units sold per day
- **Days Until Stockout**: When you'll run out (color-coded)
- **Daily Profit**: Potential daily profit from this item
- **Priority**: Ranking score for restock urgency

### Sidebar Filters

The Depletion tab includes a filter sidebar (visible on desktop, collapsible on mobile) with the following options:

**Order Status Filter:**

- **No active order** - Show only items where you do NOT have active sell orders (useful for finding items to create new orders for)

**Competition Filter:**
Filter items based on whether you have competition from other sellers:

| Option           | Description                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| All Items        | Show all items regardless of competition                                                               |
| No Competition   | Show only items where you're the sole seller (your sell order volume equals total structure stock)     |
| With Competition | Show only items where other sellers have orders (total structure stock exceeds your sell order volume) |

This helps you identify market opportunities where you can dominate a niche without price competition.

**Urgency Level Filters:**
| Filter | Description |
|--------|-------------|
| Critical (0 stock) | Show items that are completely out of stock |
| Warning (<3 days) | Show items with less than 3 days of stock |
| OK (≥3 days) | Show items with 3 or more days of stock |
| No Data | Show items without regional volume data |

**Category Filters:**
Same as the Analysis tab - filter by Modules, Ships, Ammo, Boosters, Drones, Fighters, Implants, Deployables, and Subsystems.

A **Reset Filters** button appears when any filters are modified from defaults.

### Copy Restock List

After analyzing depletion, a **Copy Restock List** button appears when there are items needing restocking (Critical or Warning status). Click the button to open a dropdown with options.

**Dropdown Options:**

| Option           | Description                                  | Default         |
| ---------------- | -------------------------------------------- | --------------- |
| Include Critical | Checkbox - include items with 0 stock        | Checked         |
| Include Warning  | Checkbox - include items with < 3 days stock | Checked         |
| Days of supply   | 1, 3, 7, 14, 30 days                         | 7 days (1 week) |
| Limit items      | All matched, Top 5, Top 10, Top 20           | All matched     |

Each checkbox shows a badge with the count of items in that urgency level.

**Behavior:**

- Filters items based on selected urgency checkboxes
- Items are ranked by urgency (most critical first)
- Copy button shows exact count of items that will be copied
- Uses Eve Online multibuy format: `Item Name Quantity`
- Quantity = estimatedDailySales × selected days (minimum 1)

Click **Copy N items** in the dropdown, then paste directly into Eve Online's multibuy feature.

### Requirements

- **Structure ID**: Must be set in Analysis tab
- **EVE SSO Login**: Required to fetch structure sell orders

### Usage Flow

1. Select Structure in the Analysis tab (3T7-M8 Keepstar is default)
2. Switch to the Depletion tab
3. Click **Analyze Depletion**
4. Use the **sidebar filters** to filter by urgency level and/or category
5. Review items sorted by priority score
6. Click **Copy Restock List** to copy Critical/Warning items (respects current filters)
7. Paste in Eve Online multibuy to purchase restocking quantities
8. Re-analyze periodically to track changes

### Data Sources

The depletion predictor fetches:

1. **Structure Orders** (`/api/esi/structure-orders?all=true`) - All sell orders aggregated by type
2. **Market Data** (`/api/market-seeder/market-data`) - Jita daily volume and prices for each item

### API Endpoint

**GET /api/market-seeder/market-data**

| Parameter | Type   | Description                                |
| --------- | ------ | ------------------------------------------ |
| type_ids  | string | Comma-separated list of type IDs (max 500) |

Returns Jita daily volume, prices, and item info for calculating depletion metrics.

---

## Market Tab

The Market tab contains two sub-tabs for managing your market orders: **Undercut** and **Sell**.

---

### Undercut Sub-Tab

The Undercut sub-tab monitors your sell orders for competitors who have undercut your prices, and provides copy-pasteable prices to beat them while respecting EVE's tick size rules.

#### Concept

Quickly identify when competitors have undercut your sell orders and get the exact price needed to undercut them by 1 tick. Respects EVE Online's 4 significant figure price precision introduced in March 2020.

#### How It Works

1. Click **Check Undercuts** to analyze your orders
2. The system fetches your character's sell orders from ESI
3. Filters to orders in the selected structure (3T7-M8 Keepstar by default)
4. Compares against all structure sell orders
5. For each item where a competitor has a lower price, calculates the 1-tick undercut price
6. **Profitability check**: Items where undercutting would result in a loss are marked with a "Not Worth It" badge

**Self-Undercut Filtering:** Orders are excluded from the "Being Undercut" list if another of your linked characters already holds the lowest price for that item type. This prevents showing actionable alerts when you're already winning the price war with another account.

#### Profitability Indicator

Items where competitors have priced below your cost basis are shown in the main table with an amber "Not Worth It" badge and a disabled copy button. This prevents you from undercutting into a loss while still showing you the full picture.

**Minimum Profitable Price Formula:**

```
min_profitable_price = jita_sell_price × 1.1 + (volume_m³ × 500 ISK/m³)
```

Where:

- `jita_sell_price` = Current lowest sell price in Jita
- `1.1` = 10% markup to ensure profit
- `500 ISK/m³` = Shipping cost per cubic meter

**Example:**

- Item: Damage Control II (Jita: 450,000 ISK, Volume: 5 m³)
- Min profitable price = 450,000 × 1.1 + (5 × 500) = 497,500 ISK
- If competitors are selling below 497,500 ISK, the item shows a "Not Worth It" badge

Items not worth undercutting show:

- Amber border and background (instead of red)
- "Not Worth It" badge
- Minimum profitable price (your cost floor) instead of days to lowest
- Disabled copy button with tooltip explaining why

#### Tick Size Rules

EVE Online limits prices to 4 significant figures. The tick size depends on price magnitude:

| Price Range           | Tick Size   | Example                       |
| --------------------- | ----------- | ----------------------------- |
| < 1,000 ISK           | 0.01 ISK    | 999.99 → 999.98               |
| 1,000 - 9,999 ISK     | 0.1 ISK     | 5,000.0 → 4,999.9             |
| 10,000 - 99,999 ISK   | 1 ISK       | 50,000 → 49,999               |
| 100,000 - 999,999 ISK | 10 ISK      | 500,000 → 499,990             |
| 1M - 9.99M ISK        | 100 ISK     | 5,000,000 → 4,999,900         |
| 10M - 99.9M ISK       | 1,000 ISK   | 50,000,000 → 49,999,000       |
| 100M - 999M ISK       | 10,000 ISK  | 500,000,000 → 499,990,000     |
| 1B+ ISK               | 100,000 ISK | 5,000,000,000 → 4,999,900,000 |

#### Character Filter

When you have multiple characters with orders in the structure, a **Character** dropdown appears in the header. This allows you to:

- View orders for **All Characters** (default) - see all orders across accounts
- Filter to a **specific character** - focus on one account at a time

The summary cards and item lists update to reflect only the selected character's orders.

#### Summary Cards

| Card          | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| Action Needed | Number of profitable items where competitors have lower prices  |
| Below Cost    | Number of items where competitor price is below your cost basis |
| Lowest Price  | Number of items where you have the lowest price                 |
| Your Orders   | Total sell orders you have in the structure                     |

#### Undercut Items List

All items being undercut are shown in a single list with visual indicators:

**Profitable items** (red highlighting):

- Item icon and name
- **Character name** - Shows which account owns this order
- Your current price
- Competitor's lower price
- Jita sell price (for reference)
- Estimated daily sales
- Days to lowest
- **Copy button** with the undercut price in EVE-pasteable format

**Not worth undercutting** (amber highlighting):

- Same information as above, plus:
- **"Not Worth It" badge** - Indicates undercutting would result in a loss
- Shows minimum profitable price instead of days to lowest
- **Disabled copy button** - Cannot undercut into a loss

Click the copy button (on profitable items) to:

1. Copy the undercut price to your clipboard
2. Automatically open the market details window for that item in the EVE client of the character who owns the order

Then paste directly into EVE's "Modify Order" dialog to update your price.

#### Safe Items List

Items where you have the lowest price are shown with green highlighting:

- Item icon and name
- **Character name** - Shows which account owns this order
- Your price
- Next competitor price (if any)

#### Requirements

**ESI Scopes:**

- `esi-markets.read_character_orders.v1` - To read your character's orders
- `esi-markets.structure_markets.v1` - To read structure market orders
- `esi-ui.open_window.v1` - To open the market window in the EVE client

#### Usage Flow

1. Select Structure in the Analysis tab (3T7-M8 Keepstar is default)
2. Switch to the Market tab, then the Undercut sub-tab
3. Click **Check Undercuts**
4. Review items being undercut - profitable items have red borders, unprofitable items have amber borders with "Not Worth It" badge
5. For profitable items, click the copy button to copy the undercut price (this also opens the market window in that character's EVE client)
6. In EVE, modify your order and paste the new price
7. Re-check periodically to stay competitive

#### API Endpoint

**GET /api/esi/undercut-check**

| Parameter    | Type   | Required | Description                             |
| ------------ | ------ | -------- | --------------------------------------- |
| character_id | string | Yes      | Your character ID                       |
| structure_id | string | No       | Structure ID (default: 3T7-M8 Keepstar) |

**Response:**

```json
{
  "undercut_items": [
    {
      "type_id": 2048,
      "type_name": "Damage Control II",
      "character_id": 12345678,
      "character_name": "Your Character",
      "your_price": 500000,
      "competitor_price": 495000,
      "undercut_price": 494900,
      "undercut_price_eve": "494,900.00",
      "jita_price": 450000,
      "jita_price_formatted": "450.00K ISK",
      "volume": 5,
      "min_profitable_price": 497500,
      "min_profitable_price_formatted": "497.50K ISK",
      "is_profitable": false
    }
  ],
  "safe_items": [
    {
      "type_id": 2046,
      "type_name": "Co-Processor II",
      "character_id": 12345678,
      "character_name": "Your Character",
      "your_price": 450000
    }
  ],
  "summary": {
    "undercut_count": 5,
    "profitable_undercut_count": 3,
    "unprofitable_undercut_count": 2,
    "safe_count": 12,
    "total_orders_in_structure": 17
  }
}
```

---

### Sell Sub-Tab

The Sell sub-tab generates optimal sell prices for your character's inventory in 3T7. It analyzes your assets, checks for competition, and calculates the best price for each item.

#### Concept

Quickly create sell orders for items in your 3T7 hangar with optimal pricing. Items with no competition use tiered markup pricing (higher margins for cheaper items), while items with competition use 1-tick undercut pricing.

#### How It Works

1. Click **Generate Sell Orders** to analyze your inventory
2. The system fetches your character assets in 3T7
3. Fetches your existing sell orders to identify items you already have orders for
4. Checks structure orders to determine competition status
5. Fetches Jita prices as cost basis
6. Calculates optimal sell price for ALL items (including those with existing orders)
7. Displays results sorted by ISK/day (highest first)

**Note:** Items with existing sell orders are included in the main list with full pricing data. A "Has Order" badge indicates items where you already have an active sell order. This is informational only - you can see what price you should be at even for items you're already selling.

#### Pricing Logic

**No Competition (Tiered Markup):**

| Jita Price | Multiplier | Effective Margin |
| ---------- | ---------- | ---------------- |
| < 500K ISK | 4.0x       | ~300%            |
| < 2M ISK   | 3.0x       | ~200%            |
| < 10M ISK  | 2.0x       | ~100%            |
| < 50M ISK  | 1.7x       | ~70%             |
| >= 50M ISK | 1.4x       | ~40%             |

**With Competition:**

- Uses 1-tick undercut of the lowest competitor price

#### Summary Cards

| Card             | Description                                           |
| ---------------- | ----------------------------------------------------- |
| Total Items      | Number of items in your 3T7 inventory with price data |
| No Competition   | Items where you'll be the only seller                 |
| With Competition | Items where competitors exist                         |
| Est. ISK/Day     | Total estimated daily revenue from all items          |

#### Item Display

Each item shows:

- Item icon and name
- Quantity in inventory
- **Character ownership** - Which character(s) have the item (with portraits for multi-character items)
- **Low margin badge** (orange) - Shown when the margin is less than 20% from Jita sell price, displays the margin percentage
- **Has Order badge** (blue) - Shown when you already have a sell order for this item (informational)
- Competition badge (green = no competition, amber = competition)
- **Sell Price** - The optimal price to list at
- **Jita Price** - Current Jita price for reference
- **Vol/Day** - Estimated daily sales (Regional volume × hub factor)
- **ISK/Day** - Estimated daily revenue (Vol/Day × Sell Price)

Items with low margins (< 20%) are highlighted with an orange border and background to make them easily identifiable.

#### Character Filter

When multiple characters are linked, a dropdown appears in the header allowing you to filter items by character. This shows only items where the selected character has inventory, making it easy to focus on one character's assets at a time. The "Has Existing Orders" section in the Do Not Sell panel also respects this filter, showing only items where the selected character has inventory that already has sell orders from any of your characters.

#### Side-by-Side Layout

The Sell sub-tab uses a two-column layout on large screens:

- **Left column (wider)**: Sell orders with pricing and copy buttons (includes all items, sorted by ISK/day)
- **Right column (sticky)**: Information panels - always visible while scrolling
  - **Has Existing Orders**: Quick reference showing items where you already have sell orders. Displays the optimal sell price and quantity for each item. Shows which character(s) own the order.
  - **Low Margin**: Warning section showing items with less than 20% margin from Jita sell price. Items in this section are also shown in the main list with an orange margin badge, but this sidebar provides a quick reference for items that may not be worth selling due to thin margins.

On smaller screens, the layout stacks vertically with sell orders first.

#### Low Margin Warning

Items where the sell price yields less than 20% profit margin from the Jita price are flagged as "Low Margin":

| Margin | Visual                                      |
| ------ | ------------------------------------------- |
| < 10%  | Red badge, appears in Low Margin sidebar    |
| 10-19% | Orange badge, appears in Low Margin sidebar |
| >= 20% | No margin badge                             |

Low margin items still appear in the main sell orders list with an orange margin percentage badge, allowing you to decide whether to sell them. The sidebar provides a quick way to identify items that may not be profitable after considering other costs like broker fees and taxes.

#### Copy Buttons

Each item has two copy buttons:

- **Name** - Copies the item name
- **Price** - Copies the sell price in EVE-pasteable format (e.g., "494,900.00")

#### Requirements

**ESI Scopes:**

- `esi-assets.read_assets.v1` - To read your character's assets
- `esi-markets.read_character_orders.v1` - To filter out items with existing orders
- `esi-markets.structure_markets.v1` - To read structure market orders

#### Usage Flow

1. Select Structure in the Analysis tab (3T7-M8 Keepstar is default)
2. Switch to the Market tab, then the Sell sub-tab
3. Click **Generate Sell Orders**
4. Review items sorted by ISK/day (highest revenue first)
5. For each item you want to sell:
   - Click **Name** to copy the item name
   - Search for it in EVE's market
   - Click the **Price** button to copy the optimal sell price
   - Paste the price when creating your sell order
6. Re-generate periodically as market conditions change

#### Paste Supplies & Generate Sell Orders

A collapsible utility tool that lets you paste items from your EVE inventory to:

1. Check which items you already have sell orders for
2. **Generate optimal sell prices** for all pasted items (same pricing as "Generate Sell Orders" button)

This is useful when you have items in Jita or in transit and want to know the sell prices before they arrive at your structure.

**How to Use:**

1. Expand the "Paste Supplies & Generate Sell Orders" section
2. Copy items from your EVE inventory (using Ctrl+A, Ctrl+C in the inventory window)
3. Paste into the text area (supports tab-separated EVE format)
4. Click **Generate Sell Orders**

**Results:**

| Category                  | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| I Have Orders             | Items where you (any linked character) already have a sell order in the structure     |
| No Orders Yet             | Items you can create new sell orders for                                              |
| Not Found                 | Item names that couldn't be matched to known items                                    |
| **Generated Sell Orders** | All matched items with optimal sell prices, competition status, and ISK/day estimates |

**Generated Sell Orders Section:**

After clicking "Generate Sell Orders", you'll see a list of all pasted items with:

- **Sell Price** - Optimal price to list at (tiered markup for no competition, 1-tick undercut for competition)
- **Jita Price** - Current Jita price for reference
- **Competition badge** - Whether there are existing sell orders for this item
- **Has Order badge** - Whether you already have a sell order for this item
- **ISK/Day** - Estimated daily profit based on regional volume
- **Copy buttons** - Copy item name or price directly

**Key Behavior:**

- Only checks **your characters' orders**, not other sellers' orders
- Filters by the selected structure ID
- Shows your lowest listed price, total volume, and **which character(s)** have the orders for items you have orders for
- Uses the same pricing logic as the main "Generate Sell Orders" button

**API Endpoints:**

1. `POST /api/esi/check-orders` - Checks existing orders
2. `POST /api/esi/generate-sell-orders-from-names` - Generates sell prices from item names

**Check Orders API:** `POST /api/esi/check-orders`

| Parameter    | Type     | Required | Description                                          |
| ------------ | -------- | -------- | ---------------------------------------------------- |
| structure_id | string   | No       | Structure ID to filter by (default: 3T7-M8 Keepstar) |
| item_names   | string[] | Yes      | Array of item names to check (max 500)               |

**Response:**

```json
{
  "structure_id": "1051567430261",
  "with_orders": [
    {
      "name": "Damage Control II",
      "type_id": 2048,
      "lowest_price": 500000,
      "lowest_price_formatted": "500.00K ISK",
      "total_volume": 150,
      "characters": [
        {"id": 123456789, "name": "Main Character"},
        {"id": 987654321, "name": "Alt Character"}
      ]
    }
  ],
  "without_orders": ["Gyrostabilizer II", "Ballistic Control System II"],
  "not_found": ["Unknown Item Name"],
  "summary": {
    "total_checked": 10,
    "with_orders_count": 1,
    "without_orders_count": 2,
    "not_found_count": 1
  }
}
```

---

#### Generate Sell Orders From Names API

**POST /api/esi/generate-sell-orders-from-names**

Generates optimal sell prices for items specified by name. Uses the same pricing logic as the sell-order-generator but works with item names instead of fetching from character inventory.

| Parameter        | Type     | Required | Description                                          |
| ---------------- | -------- | -------- | ---------------------------------------------------- |
| structure_id     | string   | No       | Structure ID (default: 3T7-M8 Keepstar)              |
| item_names       | string[] | Yes      | Array of item names to generate prices for (max 500) |
| hub_factor       | number   | No       | Hub factor for volume estimation (default: 0.05)     |
| volume_region_id | number   | No       | Region ID for volume data (default: Vale)            |

**Response:**

```json
{
  "items": [
    {
      "type_id": 2048,
      "type_name": "Damage Control II",
      "quantity": 0,
      "characters": [],
      "has_competition": false,
      "has_existing_order": true,
      "order_characters": [{"id": 123456789, "name": "Main Character"}],
      "jita_price": 450000,
      "jita_price_formatted": "450.00K ISK",
      "competitor_price": null,
      "competitor_price_formatted": null,
      "sell_price": 1800000,
      "sell_price_formatted": "1.80M ISK",
      "sell_price_eve": "1,800,000.00",
      "vale_daily_volume": 2500,
      "estimated_daily_sales": 125,
      "isk_per_day": 168750000,
      "isk_per_day_formatted": "168.75M ISK"
    }
  ],
  "not_found": ["Unknown Item Name"],
  "summary": {
    "total_items": 45,
    "total_with_competition": 12,
    "total_no_competition": 33,
    "total_isk_per_day": 500000000,
    "total_isk_per_day_formatted": "500.00M ISK",
    "total_with_existing_orders": 23
  }
}
```

**Key Differences from Sell Order Generator:**

- Takes item names as input (not inventory-based)
- `quantity` is always 0 (not from inventory)
- `characters` is always empty (not from inventory)
- Returns `not_found` array for unrecognized item names

---

#### Sell Order Generator API

**GET /api/esi/sell-order-generator**

| Parameter    | Type   | Required | Description                             |
| ------------ | ------ | -------- | --------------------------------------- |
| structure_id | string | No       | Structure ID (default: 3T7-M8 Keepstar) |

**Response:**

```json
{
  "items": [
    {
      "type_id": 2048,
      "type_name": "Damage Control II",
      "quantity": 50,
      "characters": [{"id": 123456789, "name": "Main Character"}],
      "has_competition": false,
      "has_existing_order": true,
      "order_characters": [{"id": 123456789, "name": "Main Character"}],
      "jita_price": 450000,
      "jita_price_formatted": "450.00K ISK",
      "sell_price": 1800000,
      "sell_price_formatted": "1.80M ISK",
      "sell_price_eve": "1,800,000.00",
      "vale_daily_volume": 2500,
      "estimated_daily_sales": 125,
      "isk_per_day": 225000000,
      "isk_per_day_formatted": "225.00M ISK"
    }
  ],
  "items_with_existing_orders": [],
  "summary": {
    "total_items": 45,
    "total_with_competition": 12,
    "total_no_competition": 33,
    "total_isk_per_day": 500000000,
    "total_isk_per_day_formatted": "500.00M ISK",
    "total_with_existing_orders": 23
  }
}
```

**Character Ownership:**

Each sell order item includes:

- `characters` array - which linked characters have the item in their inventory
- `has_existing_order` boolean - whether the user already has a sell order for this item
- `order_characters` array - which characters have active sell orders for this item

When multiple characters have the same item, all are listed. The UI displays character portraits and allows filtering by character using the dropdown in the header.

**Note:** All items are included in the main `items` array with full pricing, even those with existing orders. The `items_with_existing_orders` array is maintained for backwards compatibility but can be derived from items where `has_existing_order === true`.

---

### History Sub-Tab

The History sub-tab analyzes your completed sell orders to identify which items made the most profit over different time periods.

#### Concept

Review your sales history to understand which items are most profitable. Uses ESI's order history endpoint to fetch fully sold orders and calculates estimated profit using current Jita prices as cost basis.

#### How It Works

1. Click **Refresh** to fetch your completed sell orders
2. The system fetches historical orders for all linked characters
3. Filters to only fully sold orders (`state === 'expired'` AND `volume_remain === 0`)
4. Groups orders by the selected time period (3 days, 7 days, or 30 days)
5. Fetches current Jita prices for each item type
6. Calculates profit: `(sellPrice - jitaPrice - transportCost) × quantitySold`
7. Aggregates by item type and sorts by total profit

#### Time Periods

| Period  | Description                                   |
| ------- | --------------------------------------------- |
| 3 Days  | Orders completed in the last 3 days           |
| 7 Days  | Orders completed in the last 7 days (default) |
| 30 Days | Orders completed in the last 30 days          |

**Note:** ESI only provides order history for the last 90 days. Orders older than 90 days are not available.

#### Summary Cards

| Card              | Description                                     |
| ----------------- | ----------------------------------------------- |
| Orders Completed  | Total number of fully sold orders in the period |
| Total Revenue     | Sum of all sales (price × quantity)             |
| Est. Total Profit | Estimated profit using current Jita prices      |
| Avg Margin        | Revenue-weighted average profit margin          |

#### Profit by Item List

Each item shows:

- Item icon and name
- Number of orders and quantity sold
- Total revenue from this item
- Estimated profit (green = positive, red = negative)
- Profit margin badge (color-coded by margin percentage)

Click an item to expand and see additional details:

- Average sell price
- Current Jita price (used as cost estimate)
- Estimated total cost
- Item category

#### Sorting Options

| Sort             | Description                          |
| ---------------- | ------------------------------------ |
| Sort by Profit   | Highest profit items first (default) |
| Sort by Revenue  | Highest revenue items first          |
| Sort by Quantity | Most units sold first                |
| Sort by Margin   | Highest profit margin first          |

#### Profit Calculation

Profit is estimated using current Jita prices plus transport cost:

```
costPerUnit = jitaPrice + (itemVolume × transportCostPerM³)
profitPerUnit = sellPrice - costPerUnit
totalProfit = profitPerUnit × quantitySold
profitMargin = (totalProfit / totalCost) × 100
```

**Important:** This is an estimate only. Actual profit may differ because:

- Jita prices change over time (current price may differ from purchase price)
- Actual acquisition cost may vary from Jita sell price
- Transport costs may differ from the default 450 ISK/m³

#### Requirements

**ESI Scope:** `esi-markets.read_character_orders.v1`

This endpoint reads your character's order history, which requires the market orders scope.

#### Usage Flow

1. Switch to the Market tab, then the History sub-tab
2. Select a time period (3 days, 7 days, or 30 days)
3. Click **Refresh** to fetch order history
4. Review items sorted by profit (highest first)
5. Use sorting options to analyze by revenue, quantity, or margin
6. Click items to see detailed breakdown

#### API Endpoint

**GET /api/esi/order-history**

| Parameter      | Type   | Required | Description                                       |
| -------------- | ------ | -------- | ------------------------------------------------- |
| period         | string | No       | Time period: '3d', '7d', or '30d' (default: '7d') |
| transport_cost | number | No       | ISK per m³ for cost calculation (default: 450)    |

**Response:**

```json
{
  "success": true,
  "items": [
    {
      "typeId": 2048,
      "typeName": "Damage Control II",
      "categoryName": "Module",
      "quantitySold": 150,
      "orderCount": 5,
      "avgSellPrice": 520000,
      "totalRevenue": 78000000,
      "jitaPrice": 450000,
      "estimatedCost": 67800000,
      "totalProfit": 10200000,
      "profitMargin": 15.04
    }
  ],
  "summary": {
    "totalOrders": 45,
    "totalRevenue": 500000000,
    "totalProfit": 75000000,
    "avgProfitMargin": 15.0,
    "charactersQueried": 2
  },
  "period": "7d",
  "analyzedAt": "2025-12-28T12:00:00Z",
  "config": {
    "transportCostPerM3": 450
  }
}
```

---

## Component Architecture

The Market Seeder page is built using a modular component architecture for better maintainability.

### File Structure

```
components/market-seeder/
├── stock-tracker/              # Shared stock tracking components
│   ├── index.ts                # Barrel exports
│   ├── stock-table.tsx         # Sortable table with 50-item pagination
│   ├── stock-filter-sidebar.tsx # Unified filter sidebar
│   ├── stock-item-card.tsx     # Simple card (pre-load state) + types
│   ├── stock-summary-cards.tsx # Summary stats grid (4 cards)
│   └── restock-copy-dropdown.tsx # Copy restock list dropdown
├── filter-sidebar.tsx          # Analysis tab sidebar filters
├── results-table.tsx           # Analysis results table with sorting/pagination
├── capital-tab.tsx             # Capital Efficiency dashboard
├── analysis-tab.tsx            # Market analysis settings and results
├── watchlist-tab.tsx           # Item watchlist with stock table
├── essentials-tab.tsx          # Nullsec essentials list
├── depletion-tab.tsx           # Stock depletion predictions
├── market-tab.tsx              # Container for Market sub-tabs
├── undercut-subtab.tsx         # Undercut tracker
├── sell-subtab.tsx             # Sell order generator
├── history-subtab.tsx          # Order history profit analysis
├── history-filter-sidebar.tsx  # History tab category/profit filters
├── velocity-subtab.tsx         # ISK Velocity tracking
├── velocity-filter-sidebar.tsx # Velocity tab category/profit filters
├── dashboard-tab.tsx           # Dashboard container (Capital + Velocity)
├── progress-bar.tsx            # SSE progress indicator
└── utils.ts                    # Shared utilities and constants

types/market-seeder.ts          # TypeScript interfaces
```

### State Management

All state is managed in the parent `page.tsx` file and passed down to tab components as props. Each tab component receives:

- Data state (loading, error, data)
- Callbacks for actions (refresh, copy, etc.)
- Filter/selection state where applicable

### Shared Stock Tracker Components

The Watchlist, Essentials, and Depletion tabs share a sortable table UI with unified filters. Shared components in `stock-tracker/` reduce code duplication:

| Component             | Purpose                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `StockTable`          | Sortable table with columns: Item, Stock, Sales/Day, Days Left, Profit/Day, Status. 50-item pagination with expandable rows                     |
| `StockFilterSidebar`  | Unified filter sidebar with min orders/day, min profit/day, max Jita cost, urgency levels, categories, hide sell orders, and competition filter |
| `StockItemCardSimple` | Simplified card for items before stock data is loaded                                                                                           |
| `StockSummaryCards`   | Grid of 4 summary cards (total items, critical, warning, daily profit)                                                                          |
| `RestockCopyDropdown` | Dropdown menu for configuring and copying restock lists                                                                                         |

### Other Shared Components

| Component       | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `ProgressBar`   | Reusable SSE progress indicator with stage icons |
| `FilterSidebar` | Client-side filtering for analysis results       |
| `ResultsTable`  | Sortable, paginated table with row expansion     |

### Utilities

The `utils.ts` file exports shared functions and constants:

- `formatIskShort()` - ISK formatting with K/M/B suffixes
- `generateBuyText()` - Eve multibuy text generator
- `generateRestockText()` - Restock text generator for depletion items
- `generateWatchlistRestockText()` - Restock text generator for watchlist items
- `getMinOrderQuantity()` - Minimum order quantity logic
- `getUrgencyLevel()` - Determine urgency from days until stockout
- `getUrgencyClasses()` - CSS classes for urgency styling
- `KNOWN_STRUCTURES` - Alliance structure list
- `SUPPLY_DAYS_PRESETS` - Supply duration options
- `DEFAULT_STRUCTURE_ID`, `DEFAULT_SUPPLY_DAYS` - Default values

---

---

## Watchlist Scripts

Scripts are available to bulk-populate the essentials and watchlist tables.

### Deklein Nullsec Essentials

The `add-deklein-nullsec-items.ts` script populates the **Essentials tab** with a hand-picked list of ~140 items essential for nullsec living in Guristas space (Deklein region).

**Target Table:** `essential_items` (Essentials tab, admin-managed)

**Usage:**

```bash
npx tsx scripts/add-deklein-nullsec-items.ts
```

**Curated Items:**

| Category   | Count | Items                                                                                                                                                                                                                            |
| ---------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship       | 33    | Ishtar, Gila, VNI, Dominix, ALL barges (Venture, Covetor, Retriever, Procurer), ALL exhumers (Hulk, Mackinaw, Skiff), Porpoise, Orca, T3 cruisers (Tengu, Legion, Proteus, Loki), T2 haulers (DSTs: Bustard, Impel, Mastodon, Occator, Torrent; BRs: Crane, Prorator, Prowler, Viator, Deluge), Epithal, Tayra, Astero, Heron, Sabre, Stiletto |
| Subsystem  | 48    | All Tengu, Legion, Proteus, and Loki subsystems (Core, Defensive, Offensive, Propulsion)                                                                                                                                         |
| Drone      | 12    | Wasp II, Vespa II, Hornet II, Ogre II, Hammerhead II, Hobgoblin II, Mining Drone I/II, Salvage Drone I, Augmented Mining Drone, Warrior II, Acolyte II                                                                           |
| Module     | 38    | Drone mods, Strip Miner I, Modulated Strip Miner II, Mining Laser Upgrade I/II, Ice Harvester I/II, Shield Extenders, Hardeners, MWDs, Tackle, Cloaking, etc.                                                                    |
| Charge     | 7     | Scourge missiles (Heavy, Cruise, Fury variants), Nanite Repair Paste, Scanner Probes                                                                                                                                             |
| Deployable | 2     | Mobile Tractor Unit, Mobile Depot                                                                                                                                                                                                |

**Key Features:**

- **Hand-curated**: ~140 essential items, not a scraped list
- **Complete mining lineup**: All mining barges, exhumers, and T1/T2 equipment
- **T3 cruisers + all subsystems**: Tengu (kinetic bonus for Guristas), Legion, Proteus, Loki
- **Kinetic focus**: Scourge missiles for Guristas NPC damage profile
- **No capitals**: All subcapital focused
- **No officer/faction mods**: Only T1/T2 modules that are commonly used

### T2 Drones (Personal Watchlist)

The `add-t2-drones-to-watchlist.ts` script adds all Tech II drones to the **personal watchlist**.

**Target Table:** `watchlist_items` (Watchlist tab, user-managed)

**Usage:**

```bash
npx tsx scripts/add-t2-drones-to-watchlist.ts
```

---

## Related

- [Market Seeder API](../api/market-seeder.md) - Backend API documentation
- [Watchlist API](../api/watchlist.md) - Watchlist API documentation
- [ESI API](../api/esi.md) - Structure orders, capital efficiency, and undercut check endpoints
