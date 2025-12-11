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

Demand is estimated using **Vale of the Silent market history data** with a 20% hub factor (your hub sees ~20% of Vale's regional volume).

```
estimatedDailySales = valeDailyVolume × 0.2  // 20% of Vale volume
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

**Note:** Demand estimation uses Vale of the Silent market data × 20% hub factor.

---

## Analysis Tab

### Configuration Panel

- **Structure ID**: Your alliance market hub structure ID (saved to localStorage)
- **Transport Cost**: ISK per m³ for Jump Freighter shipping (default: 450)
- **Advanced Settings**:
  - Minimum profit margin %
  - Minimum profit per unit ISK
  - Minimum volume per day
  - No competition only toggle (filter for tiered markup opportunities)
  - Category filter checkboxes (Modules, Ships, Ammo, Boosters) - filter results by item type

### Analysis Results

The page displays multiple ranked lists:

| Tab | Description |
|-----|-------------|
| Top Items | Best overall items by composite profitability score |
| No Competition | Items with no existing sell orders (tiered markup opportunity) |
| Best ISK/m³ | Most profitable items per cargo space |
| Trending Up | Items with increasing Jita demand |
| Modules | Top modules by category |
| Ships | Top ships by category |
| Ammo | Top ammunition by category |
| Boosters | Top boosters by category |

### Item Cards

Each item shows:
- **Checkbox** for item selection (for Copy Buy Text)
- Item name with category icon
- Competition status badge
- Profit margin percentage
- Profit per unit
- Composite score

Clicking an item expands to show:
- Jita buy price
- Transport cost
- Target sell price
- Profit per m³
- Volume
- Jita daily volume
- Category and group

### Copy Buy Text Feature

Select items using checkboxes and copy a shopping list for Eve Online's multibuy feature.

**Selection Controls:**
- Each item has a checkbox on the left side
- "Select All" / "Deselect All" button at the top of each list
- Selection persists when switching between tabs

**Selection Action Bar:**
When items are selected, a sticky action bar appears showing:
- Number of selected items
- Budget input field in millions (default 100M) - set how much ISK to spend per item
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
- Each item gets up to the configured budget worth of units
- Formula: `quantity = floor(budgetM * 1,000,000 / jitaSellPrice)`
- Minimum quantity is always 1 (even if price exceeds budget)
- Default budget is 100M ISK per item (enter "100" for 100M, configurable in the action bar)

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
2. **Enter Structure ID** of your alliance market hub
3. **Set Transport Cost** (default 450 ISK/m³)
4. **Click "Run Analysis"** to fetch and analyze data
5. **Watch Progress Bar** as each stage completes
6. **Browse Results** using the tabs to find profitable items
7. **Click Items** to see detailed profit breakdown
8. **Select Items** using checkboxes for items you want to buy
9. **Click "Copy Buy Text"** to copy shopping list to clipboard
10. **Paste in Eve** using the multibuy feature to purchase items

## Performance

| Scenario | Typical Time |
|----------|--------------|
| Cold cache | 1-2 minutes |
| Warm cache (within 5 min) | 5-10 seconds |

The main bottleneck is fetching ~5,800 Jita prices from ESI (20 concurrent requests with rate limiting).

## Settings Persistence

All settings are saved to localStorage:
- `market-seeder-settings`: JSON object with structure_id, transportCost, minMargin, minProfit, minVolume, noCompetitionOnly, buyBudget, selectedCategories

---

## Watchlist Tab

The Watchlist tab allows you to track specific items and monitor their stock levels in your alliance structure.

### Features

#### Add Items to Watchlist

- Use the search input to find items from the ~5,800 tradeable items
- Type at least 2 characters to search
- Click an item to add it to your watchlist
- Items already in the watchlist are filtered from search results

#### Monitor Stock Levels

- Click **Refresh Stock** to check current sell order volumes in your structure
- Requires Structure ID to be set (from Analysis tab)
- Requires EVE SSO authentication

#### Stock Status Indicators

| Status | Visual | Description |
|--------|--------|-------------|
| Out of Stock | Red badge + red border | No sell orders for this item in structure |
| In Stock | Green border + unit count | Item has active sell orders |

#### Item Display

Each watchlist item shows:
- Category icon
- Item name
- Category and group
- Stock quantity (when checked)
- Lowest sell price (when checked)
- Remove button

### Summary Cards

When items are in the watchlist, summary cards show:
- **Total Items**: Number of items being tracked
- **Need Restock**: Items with 0 stock (highlighted in tab badge)
- **In Stock**: Items with active sell orders

### Database Storage

Watchlist items are stored in Supabase (`watchlist_items` table) and persist across sessions. The watchlist is shared (not per-user) since the alliance structure is shared.

### Watchlist Usage Flow

1. Set Structure ID in the Analysis tab
2. Switch to the Watchlist tab
3. Search and add items you want to track
4. Click **Refresh Stock** to check current levels
5. Items with 0 stock are highlighted for restocking

---

## Depletion Predictor Tab

The Depletion Predictor tab analyzes **all items currently being sold in your structure** to predict when they will sell out and prioritize restocking by profit potential.

### Concept

Combine Vale of the Silent volume data (actual regional demand) with your structure's current sell orders to predict stockouts before they happen. Your edge: know exactly when to restock before you lose sales - regular traders react AFTER stockout.

### Core Formulas

```
estimated_daily_sales = vale_avg_daily_volume × 0.2  // 20% of Vale volume
days_until_stockout = current_stock ÷ estimated_daily_sales
priority_score = estimated_daily_sales × profit_per_unit
```

### How It Works

1. Click **Analyze Depletion** to fetch all sell orders and market data
2. For each item type you're selling, the system calculates:
   - **Estimated Daily Sales**: Vale Volume × 20% (hub factor)
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

### Requirements

- **Structure ID**: Must be set in Analysis tab
- **EVE SSO Login**: Required to fetch structure sell orders

### Usage Flow

1. Set Structure ID in the Analysis tab
2. Switch to the Depletion tab
3. Click **Analyze Depletion**
4. Review items sorted by priority score
5. Focus restocking on Critical and Warning items
6. Re-analyze periodically to track changes

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

