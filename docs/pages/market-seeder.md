# Market Seeder Page

The Market Seeder page helps identify the most profitable items to import from Jita to your alliance market hub.

## Overview

**Path:** `/market-seeder`

**Purpose:** Analyze market data to find items with the best profit margins for import.

## Features

The page has four main tabs: **Capital**, **Analysis**, **Watchlist**, and **Depletion**.

---

## Capital Efficiency Dashboard

Track your ISK-at-work across all market sell orders. The Capital tab shows where your capital is deployed and calculates ROI metrics.

### Concept

Show where your capital is deployed and how efficiently it's working. Identify "dead capital" - ISK tied up in slow-moving orders that could be better deployed elsewhere.

### Key Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Total ISK Deployed | Sum of `price × volumeRemain` | All capital tied up in sell orders |
| Est. Daily Revenue | Sum of `capitalDeployed / daysToSell` | Expected daily ISK returned |
| Avg Days to Sell | Capital-weighted average | How long until orders clear |
| Effective APY | `(profit/cost) × (365/daysToSell) × 100` | Annualized return rate |

### Demand Estimation

Demand is estimated using **Vale of the Silent market history data** with a 5% hub factor (your hub sees ~5% of Vale's regional volume).

```
estimatedDailySales = valeDailyVolume × 0.05  // 5% of Vale volume
daysToSell = volumeRemain / estimatedDailySales
```

### Efficiency Categories

Orders are categorized by how long they'll take to sell:

| Category | Days to Sell | Visual |
|----------|--------------|--------|
| Fast | < 14 days | Green |
| Moderate | 14-30 days | Amber |
| Slow | 30-90 days | Orange |
| Dead | > 90 days | Red |

### Dead Capital Alerts

Orders estimated to take more than **90 days to sell** are flagged as "dead capital". These represent inefficient capital deployment - the ISK could potentially earn better returns elsewhere.

The dashboard shows:
- Count of dead capital orders
- Total ISK in dead capital
- Percentage of total capital that's dead

### Summary Cards

| Card | Description |
|------|-------------|
| Total ISK Deployed | Sum of all sell order values |
| Est. Daily Revenue | Expected daily ISK based on demand |
| Avg Time to Sell | Capital-weighted average days |
| Effective APY | Portfolio-wide annualized return |

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

The Capital tab requires character-level order access, not just structure market access.

### API Endpoint

**GET /api/esi/capital-efficiency**

| Parameter | Type | Description |
|-----------|------|-------------|
| character_id | string | Required - Your character ID |
| transport_cost | number | Optional - ISK/m³ for cost basis (default: 450) |

Returns:
- Summary metrics (total deployed, daily revenue, APY, dead capital)
- Per-order breakdown with efficiency classification
- Capital allocation by efficiency category

**Note:** Demand estimation uses Vale of the Silent market data × 5% hub factor.

---

## Analysis Tab

### Search Settings

Configure the analysis parameters:

| Setting | Description |
|---------|-------------|
| **Structure** | Dropdown to select your alliance market hub (default: 3T7-M8 Keepstar). Includes "Other (Custom ID)" option. |
| **Transport Cost** | ISK per m³ for Jump Freighter shipping (default: 450) |
| **Min Profit/Unit** | Minimum profit per unit in ISK (default: 100,000) |
| **Min Vale Vol/Day** | Minimum daily volume in Vale of the Silent (default: 10) |

### Sidebar Filters

After running an analysis, filter results using the sidebar on the right:

| Filter | Description |
|--------|-------------|
| **Min Margin %** | Minimum profit margin percentage (client-side filter) |
| **No Competition Only** | Show only items with no existing sell orders |
| **Categories** | Checkboxes for Modules, Ships, Ammo, Boosters |
| **Reset Filters** | Button to restore default filter values |

### Results Table

Results are displayed in a sortable, paginated table with 50 items per page:

| Column | Description | Sortable |
|--------|-------------|----------|
| Checkbox | Select item for Copy Buy Text | No |
| Name | Item name with trend indicator | Yes |
| Score | Composite profitability score | Yes (default) |
| Margin | Profit margin percentage | Yes |
| Profit/Unit | ISK profit per unit | Yes |
| ISK/m³ | Profit per cubic meter (transport efficiency) | Yes |
| Competition | Yes/No badge | Yes |
| Vol/Day | Vale daily volume × 5% (estimated hub sales) | Yes |

Click a row to expand and see additional details:
- Jita price, Transport cost, Target price
- Profit/m³, Volume, Vale daily volume
- Supply quantity for selected days (at 5% Vale volume)
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
- Each item gets the selected days' supply at 5% of Vale of the Silent regional volume
- Formula: `quantity = ceil(avgDailyVolume × 0.05 × days)`

**Note:** Selected items are automatically cleared when running a new analysis.
- Presets: 1 day, 3 days, 7 days (1 week), 30 days, or custom
- Minimum quantity is always 1
- This ensures you stock enough to meet estimated demand at your hub

## Tiered Pricing (No Competition)

When there are no existing sell orders for an item in your structure, a **tiered markup** is applied based on Jita price. Cheaper items can sustain higher markups since absolute profit is lower:

| Jita Price | Multiplier | Effective Margin |
|------------|------------|------------------|
| < 500K ISK | 4.0x | ~300% |
| < 2M ISK | 3.0x | ~200% |
| < 10M ISK | 2.0x | ~100% |
| < 50M ISK | 1.7x | ~70% |
| >= 50M ISK | 1.4x | ~40% |

**Example target prices:**
- 100K ISK item → 400K ISK (4x markup)
- 1M ISK item → 3M ISK (3x markup)
- 30M ISK item → 51M ISK (1.7x markup)

When competitors have sell orders, the target price matches the competitor's lowest price.

---

## Scoring Algorithm

Items are ranked by a **volume-weighted composite score** that balances profitability with realistic sellability.

### Base Score Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Profit Margin % | 25% | Higher margins = better capital efficiency |
| Profit per m³ | 30% | Transport efficiency (ISK per cargo space) |
| Vale Demand | 25% | Higher regional volume = more potential buyers |
| Absolute Profit | 20% | Raw ISK profit per unit |
| No Competition Bonus | +15 | Bonus for items with no existing orders |

### Volume Multiplier

The base score is multiplied by `sqrt(avgDailyVolume)` to heavily favor high-volume items:

```
finalScore = baseScore × sqrt(avgDailyVolume)
```

This ensures rare expensive items (like officer modules selling 1/day) don't outrank common items that will actually sell in your market hub.

| Daily Volume | Multiplier | Example Items |
|--------------|------------|---------------|
| 10 units/day | 3.2x | Faction modules |
| 100 units/day | 10x | Popular T2 modules |
| 1,000 units/day | 31.6x | Common ships, ammo |

### Minimum Filters

Items must meet these thresholds to appear (configurable via Advanced Settings):

| Filter | Default | Description |
|--------|---------|-------------|
| Min Volume/Day | 10 units | Minimum average daily trading volume in Vale |
| Min Profit Margin | 10% | Minimum profit as percentage of cost |
| Min Profit per Unit | 100,000 ISK | Minimum ISK profit per unit |
| Min Jita Price | 10,000 ISK | Fixed minimum price threshold |

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

| Stage | Description |
|-------|-------------|
| Loading | Loading ~5,800 tradeable items from file |
| Market History | Fetching Vale demand metrics via RPC batches (30 batches) |
| Structure Orders | Fetching orders from your alliance hub |
| Jita Prices | Fetching current Jita sell prices (~290 ESI batches) |
| Analyzing | Computing profit metrics per item |
| Filtering | Applying minimum threshold filters |
| Scoring | Calculating composite profitability scores |
| Ranking | Generating sorted result lists |

## Usage Flow

1. **Login with EVE SSO** if not already authenticated
2. **Select Structure** from the dropdown (3T7-M8 Keepstar is default, or choose "Other" for custom ID)
3. **Set Transport Cost** (default 450 ISK/m³)
4. **Click "Run Analysis"** to fetch and analyze data
5. **Watch Progress Bar** as each stage completes
6. **Browse Results** using the tabs to find profitable items
7. **Click Items** to see detailed profit breakdown (includes weekly quantity at 5% Vale volume)
8. **Select Items** using checkboxes for items you want to buy
9. **Click "Copy Buy Text"** to copy shopping list (quantities based on 1 week @ 5% Vale volume)
10. **Paste in Eve** using the multibuy feature to purchase items

## Performance

| Scenario | Typical Time |
|----------|--------------|
| Cold cache | 1-2 minutes |
| Warm cache (within 5 min) | 5-10 seconds |

The main bottleneck is fetching ~5,800 Jita prices from ESI (20 concurrent requests with rate limiting).

## Settings Persistence

All settings are saved to localStorage:
- `market-seeder-settings`: JSON object with structureId, transportCost, minMargin, minProfit, minVolume, noCompetitionOnly, selectedCategories

---

## Watchlist Tab

The Watchlist tab allows you to track specific items and monitor their stock levels and depletion metrics in your alliance structure. The UI matches the Depletion tab but works with your curated list of items instead of all sell orders.

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

| Option | Description | Default |
|--------|-------------|---------|
| Include Critical | Checkbox - include items with < 3 days stock | Checked |
| Include Warning | Checkbox - include items with 3-7 days stock | Checked |
| Days of supply | 1, 3, 7, 14, 30 days | 7 days (1 week) |
| Limit items | All matched, Top 5, Top 10, Top 20 | All matched |

Each checkbox shows a badge with the count of items in that urgency level.

**Behavior:**
- Filters items based on selected urgency checkboxes
- Items are ranked by urgency (most critical first)
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

### Core Formulas

The same formulas used in the Depletion tab:

```
estimated_daily_sales = vale_avg_daily_volume × 0.05  // 5% of Vale volume
days_until_stockout = current_stock ÷ estimated_daily_sales
daily_profit = estimated_daily_sales × profit_per_unit
```

### Urgency Levels

Items are color-coded by how soon they'll run out:

| Level | Days Remaining | Visual |
|-------|----------------|--------|
| Critical | < 3 days | Red border + "Critical" badge |
| Warning | 3-7 days | Amber border + "Low Stock" badge |
| Safe | > 7 days | Green border + "OK" badge |
| No Data | N/A | Gray badge (no Vale volume data) |

### Summary Cards

When items are in the watchlist, summary cards show:
- **Items Tracked**: Number of items being tracked
- **Critical**: Items with < 3 days of stock (red highlight)
- **Warning**: Items with 3-7 days of stock (amber highlight)
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
5. Review items sorted by urgency (Critical first, then Warning)
6. Click **Copy Restock List** to copy all Critical/Warning items
7. Paste in Eve Online multibuy to purchase 1 week's supply

### Data Sources

The watchlist fetches:
1. **Structure Orders** (`/api/watchlist?structure_id=...`) - Stock levels for watchlist items
2. **Vale Market History** (via RPC) - Daily volume data for sales estimates
3. **Jita Prices** (via ESI) - Current Jita prices for profit calculation

---

## Depletion Predictor Tab

The Depletion Predictor tab analyzes **all items currently being sold in your structure** to predict when they will sell out and prioritize restocking by profit potential.

### Concept

Combine Vale of the Silent volume data (actual regional demand) with your structure's current sell orders to predict stockouts before they happen. Your edge: know exactly when to restock before you lose sales - regular traders react AFTER stockout.

### Core Formulas

```
estimated_daily_sales = vale_avg_daily_volume × 0.05  // 5% of Vale volume
days_until_stockout = current_stock ÷ estimated_daily_sales
priority_score = estimated_daily_sales × profit_per_unit
```

### How It Works

1. Click **Analyze Depletion** to fetch all sell orders and market data
2. For each item type you're selling, the system calculates:
   - **Estimated Daily Sales**: Vale Volume × 5% (hub factor)
   - **Days Until Stockout**: Current stock ÷ estimated daily sales
   - **Daily Profit Potential**: Estimated sales × profit per unit
3. Items are ranked by **Priority Score** (higher = more urgent)

### Urgency Levels

Items are color-coded by how soon they'll run out:

| Level | Days Remaining | Visual |
|-------|----------------|--------|
| Critical | < 3 days | Red border + "Critical" badge |
| Warning | 3-7 days | Amber border + "Low Stock" badge |
| Safe | > 7 days | Green border + "OK" badge |
| No Data | N/A | Gray badge (no Vale volume data) |

### Summary Cards

When predictions are available, summary cards show:
- **Items Tracked**: Total unique items being sold
- **Critical**: Items with < 3 days of stock (red highlight)
- **Warning**: Items with 3-7 days of stock (amber highlight)
- **Daily Profit Potential**: Total ISK/day across all items

### Item Cards

Each prediction card displays:
- Item name with category icon
- **Current Stock**: Total units across all your sell orders for this item
- **Est. Daily Sales**: Predicted units sold per day
- **Days Until Stockout**: When you'll run out (color-coded)
- **Daily Profit**: Potential daily profit from this item
- **Priority**: Ranking score for restock urgency

### Copy Restock List

After analyzing depletion, a **Copy Restock List** button appears when there are items needing restocking (Critical or Warning status). Click the button to open a dropdown with options.

**Dropdown Options:**

| Option | Description | Default |
|--------|-------------|---------|
| Include Critical | Checkbox - include items with < 3 days stock | Checked |
| Include Warning | Checkbox - include items with 3-7 days stock | Checked |
| Days of supply | 1, 3, 7, 14, 30 days | 7 days (1 week) |
| Limit items | All matched, Top 5, Top 10, Top 20 | All matched |

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
4. Review items sorted by priority score
5. Click **Copy Restock List** to copy Critical/Warning items
6. Paste in Eve Online multibuy to purchase restocking quantities
7. Re-analyze periodically to track changes

### Data Sources

The depletion predictor fetches:
1. **Structure Orders** (`/api/esi/structure-orders?all=true`) - All sell orders aggregated by type
2. **Market Data** (`/api/market-seeder/market-data`) - Jita daily volume and prices for each item

### API Endpoint

**GET /api/market-seeder/market-data**

| Parameter | Type | Description |
|-----------|------|-------------|
| type_ids | string | Comma-separated list of type IDs (max 500) |

Returns Jita daily volume, prices, and item info for calculating depletion metrics.

---

## Related

- [Market Seeder API](../api/market-seeder.md) - Backend API documentation
- [Watchlist API](../api/watchlist.md) - Watchlist API documentation
- [ESI API](../api/esi.md) - Structure orders and capital efficiency endpoints

