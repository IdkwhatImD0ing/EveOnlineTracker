<div align="center">

# 🚀 EVE Online Industry Tracker

**A sleek web application for tracking your Eve Online manufacturing projects, materials, and costs.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

[Features](#-features) • [Getting Started](#-getting-started) • [Usage](#-usage) • [Documentation](#-documentation) • [API Reference](#-api-reference) • [Project Structure](#-project-structure)

</div>

---

## ✨ Features

- **📦 Project Management** — Create, view, and delete manufacturing projects
- **✅ Progress Tracking** — Mark items as collected with persistent checkboxes
- **📈 Partial Progress** — Track quantity made for components (e.g., 50/100 built)
- **💰 Real-time Jita Prices** — Automatic market price fetching via Janice API
- **📊 Price Summaries** — View Buy, Sell, and Split price totals at a glance
- **💸 Additional Costs** — Track manufacturing fees, transport costs, and more
- **📋 Clipboard Integration** — Copy item lists back to Eve Online with one click
- **🔒 Password Protection** — Simple authentication to keep your data private
- **🔑 EVE SSO Integration** — Grab OAuth tokens for use in external scripts/cron jobs
- **🧮 Industry Calculator** — Calculate material requirements and costs for any blueprint
- **🛒 Buy Mode** — Automatically adjust materials based on buy vs build recommendations
- **📈 Market Seeder** — Analyze profitability for importing items from Jita to alliance hubs
- **📊 Market Opportunities** — Find undervalued items using mean reversion analysis
- **💹 Sell Opportunities** — Identify optimal sell timing by comparing current prices to all-time highs

---

## 🛠️ Tech Stack

| Technology         | Purpose                              |
| ------------------ | ------------------------------------ |
| **Next.js 16**     | React framework with App Router      |
| **React 19**       | UI components                        |
| **Supabase**       | PostgreSQL database & authentication |
| **Tailwind CSS 4** | Utility-first styling                |
| **shadcn/ui**      | Beautiful, accessible UI components  |
| **Janice API**     | Eve Online market price data         |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **pnpm** package manager ([install](https://pnpm.io/installation))
- **Supabase** account ([sign up free](https://supabase.com/))
- **Janice API Key** _(optional)_ — [Request here](https://janice.e-351.com/) for market prices

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/EveOnlineTracker.git
   cd EveOnlineTracker
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the project root:

   ```env
   # Required - Supabase Connection
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Optional - Janice API for market prices
   # Without this, items will be parsed but prices will show as 0
   JANICE_API_KEY=your-janice-api-key

   # Optional - EVE SSO for token grabbing (used for external scripts)
   # Get these from https://developers.eveonline.com/applications
   EVE_CLIENT_ID=your_client_id
   EVE_CLIENT_SECRET=your_client_secret
   EVE_CALLBACK_URL=http://localhost:3000/callback
   ```

   > 💡 **Tip:** Find your Supabase credentials in your project's Settings → API page

4. **Set up the database**

   Run the SQL migration in your Supabase SQL Editor:

   <details>
   <summary>📄 <strong>Click to expand SQL migration script</strong></summary>

   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Projects table
   CREATE TABLE projects (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text NOT NULL,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );

   -- Raw materials table
   CREATE TABLE raw_materials (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     item_name text NOT NULL,
     type_id bigint NOT NULL,
     quantity bigint NOT NULL DEFAULT 1,
     collected boolean NOT NULL DEFAULT false,
     buy_price numeric,
     sell_price numeric,
     split_price numeric,
     volume numeric
   );

   -- Components table
   CREATE TABLE components (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     item_name text NOT NULL,
     type_id bigint NOT NULL,
     quantity bigint NOT NULL DEFAULT 1,
     collected boolean NOT NULL DEFAULT false,
     quantity_made bigint NOT NULL DEFAULT 0,
     buy_price numeric,
     sell_price numeric,
     split_price numeric,
     volume numeric
   );

   -- Additional costs table
   CREATE TABLE additional_costs (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     note text NOT NULL,
     amount numeric NOT NULL,
     created_at timestamptz DEFAULT now()
   );

   -- Indexes for performance
   CREATE INDEX idx_raw_materials_project_id ON raw_materials(project_id);
   CREATE INDEX idx_components_project_id ON components(project_id);
   CREATE INDEX idx_additional_costs_project_id ON additional_costs(project_id);

   -- Updated_at trigger function
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = now();
     RETURN NEW;
   END;
   $$ language 'plpgsql';

   -- Apply trigger to projects table
   CREATE TRIGGER update_projects_updated_at
     BEFORE UPDATE ON projects
     FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column();
   ```

   </details>

5. **Start the development server**

   ```bash
   pnpm dev
   ```

6. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

   > 🔐 **Default password:** `eve2024` (change this in `components/auth-gate.tsx`)

---

## 📖 Usage

### Creating a Project

1. Click **"New Project"** on the home page
2. Enter a project name (e.g., "Nightmare Build")
3. Paste your item lists from Eve Online:
   - **Raw Materials** — Minerals, planetary resources, moon goo, etc.
   - **Components** — Intermediate products like Plasma Thrusters, Armor Plates

### Supported Input Formats

The app accepts multiple Eve Online copy formats:

```
# Tab-separated (inventory export)
Tritanium    1000000    0.01 m3
Pyerite      500000     0.01 m3

# Space-separated
Tritanium 1000000
Pyerite 500000

# Item name only (quantity defaults to 1)
Tritanium
Pyerite
```

### Tracking Progress

- ✅ Check items as you collect them
- 📊 For components, click the progress (e.g., "0/100") to enter partial quantities
- Auto-completes when quantity made reaches the required amount
- Progress persists automatically to the database
- Use **"Copy Remaining"** to copy only unchecked items

### Buy Mode on Projects

For projects created from the Industry Calculator, a **Buy Mode** toggle is available:

- Located in the project header when buy recommendations exist
- Shows 🛒 (buy) or 🔨 (build) icons next to each component
- **Adjusts Raw Materials** to show only what's needed for components you'll build
- Price summaries update automatically to reflect adjusted costs

### Price Information

- **Jita Buy** — Cost to buy all raw materials at Jita buy orders
- **Jita Sell** — Value if selling all raw materials at Jita sell orders
- **Jita Split** — Average of buy and sell prices
- Note: Prices are based on raw materials only (not components, since you build those)
- Click any price to copy to clipboard

### Additional Costs

Track extra expenses like:

- Manufacturing job fees
- Transport/hauling costs
- Broker fees
- Research costs

### Industry Calculator

Calculate material requirements and costs for any blueprint:

1. Navigate to **Industry Calculator** from the home page
2. Search and select a blueprint
3. Configure build settings:
   - Quantity to manufacture
   - Blueprint ME/TE values
   - Manufacturing system (affects cost index)
   - Structure and rig bonuses
4. Click **Calculate Recipe** to see the full breakdown

#### Buy Mode

When components are present, a **Buy Mode** toggle appears at the top of results:

- **Build All** (default) — Shows materials needed to build everything from scratch
- **Buy Mode** — Optimizes your shopping list:
  - Identifies components cheaper to buy than build
  - **Adjusts Raw Materials** by removing materials for purchased components
  - Shows savings potential for each component
  - Components marked with 🛒 (buy) or 🔨 (build) icons

This helps you optimize between building and buying intermediate components.

### Sell Opportunities

Identify the best time to sell items you're holding:

1. Navigate to **Sell Opportunities** from the home page
2. Login with EVE SSO (grants assets permission)
3. Your character's assets are automatically loaded and analyzed
4. Each item shows:
   - **Current Jita sell price**
   - **All-time high price** (from historical market data)
   - **% of ATH** — How close current price is to the all-time high

#### Color-Coded Recommendations

| Color | % of ATH | Recommendation |
|-------|----------|----------------|
| 🟢 Green | >= 80% | Good time to sell - near all-time high |
| 🟠 Orange | 60-79% | Consider holding - moderate pricing |
| 🔴 Red | < 60% | Wait for better prices |

Use the filter buttons to quickly see only items in each category, and sort by value or % of ATH to prioritize your sales.

---

## 📚 Documentation

Comprehensive documentation is available in the [docs/](./docs/) folder:

| Section | Description |
|---------|-------------|
| [API Reference](./docs/api/README.md) | Complete documentation for all API endpoints |
| [Pages](./docs/pages/README.md) | Documentation for all application pages |
| [Calculations](./docs/calculations/README.md) | Industry calculation formulas (ME, TE, job costs) |
| [Integrations](./docs/integrations/README.md) | External service integrations (Janice, ESI, eve-industry.org) |
| [Database Schema](./docs/database/schema.md) | Database tables, relationships, and migrations |

### Key Calculation Formulas

- **Material Efficiency**: `max(runs, ceil(round(baseQty × runs × (1 - totalME), 2)))`
- **Time Efficiency**: `ceil(baseTime × runs × (1 - min(totalTE, 0.90)))`
- **Job Cost**: `baseCost × systemCostIndex × runs × (1 - structureBonus) × (1 + facilityTax)`

For detailed explanations with examples, see [docs/calculations/](./docs/calculations/).

---

## 🔌 API Reference

> 📚 **Full API documentation available in [docs/api/](./docs/api/README.md)**

### Quick Reference

| Category | Endpoints | Documentation |
| -------- | --------- | ------------- |
| **Projects** | `/api/projects/*` | [docs/api/projects.md](./docs/api/projects.md) |
| **Industry** | `/api/industry/*` | [docs/api/industry.md](./docs/api/industry.md) |
| **Auth** | `/api/auth/eve/*` | [docs/api/auth.md](./docs/api/auth.md) |
| **ESI** | `/api/esi/*` | [docs/api/esi.md](./docs/api/esi.md) |
| **Market Seeder** | `/api/market-seeder/*` | [docs/api/market-seeder.md](./docs/api/market-seeder.md) |

### Key Endpoints

| Method   | Endpoint                              | Description                    |
| -------- | ------------------------------------- | ------------------------------ |
| `GET`    | `/api/projects`                       | List all projects              |
| `POST`   | `/api/projects`                       | Create a new project           |
| `GET`    | `/api/projects/[id]`                  | Get project with all items     |
| `DELETE` | `/api/projects/[id]`                  | Delete a project               |
| `POST`   | `/api/industry/calculate`             | Calculate blueprint materials  |
| `GET`    | `/api/esi/structure-orders`           | Get structure market orders    |
| `GET`    | `/api/esi/character-assets`           | Get character assets (auth required) |
| `GET`    | `/api/esi/market-history`             | Fetch market history (daily cron) |
| `POST`   | `/api/sell-opportunities`             | Analyze assets for sell timing |
| `GET`    | `/api/market/opportunities`           | Find undervalued market items |
| `GET`    | `/api/market-seeder/analyze`          | Analyze profitable import items |

### Create Project Request

```json
{
  "name": "My Project",
  "rawMaterialsInput": "Tritanium 1000000\nPyerite 500000",
  "componentsInput": "Plasma Thruster 50"
}
```

---

## 📁 Project Structure

```
EveOnlineTracker/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/eve/      # EVE SSO authentication
│   │   ├── esi/           # ESI proxy endpoints
│   │   ├── industry/      # Industry calculator API
│   │   ├── market-seeder/ # Market seeder analysis
│   │   └── projects/      # Project CRUD endpoints
│   ├── callback/          # EVE SSO callback page
│   ├── industry/          # Industry calculator page
│   ├── market-seeder/     # Market seeder page
│   ├── sell-opportunities/# Sell opportunity analysis page
│   ├── projects/          # Project pages
│   │   ├── [id]/         # Project detail view
│   │   ├── new/          # Create project form
│   │   └── page.tsx      # Project list
│   ├── layout.tsx        # Root layout with sidebar
│   └── page.tsx          # Dashboard home page
│
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── industry/         # Industry calculator components
│   ├── sidebar.tsx       # Navigation sidebar
│   ├── sidebar-layout.tsx# Layout wrapper with sidebar
│   ├── auth-gate.tsx     # Password protection
│   ├── item-list.tsx     # Item display with checkboxes
│   └── ...
│
├── lib/                   # Utilities
│   ├── blueprints.ts     # Blueprint data & calculations
│   ├── esi.ts            # eve-industry.org API client
│   ├── eve-sso.ts        # EVE SSO OAuth helpers
│   ├── janice.ts         # Janice market API client
│   ├── market-seeder.ts  # Market seeder algorithm
│   ├── sde.ts            # Static data utilities
│   └── utils.ts          # Helper functions
│
├── types/                 # TypeScript definitions
│   ├── database.ts       # Database types
│   └── market-seeder.ts  # Market seeder types
│
├── utils/supabase/       # Supabase client
│   └── server.ts         # Server-side client
│
├── data/                 # Static data files
│   ├── blueprints.json   # Blueprint material requirements
│   ├── inv-types.json    # All item types
│   └── ...
│
└── docs/                  # 📚 Comprehensive documentation
    ├── README.md         # Documentation index
    ├── api/              # API route documentation
    ├── pages/            # Page documentation
    ├── calculations/     # Industry calculation formulas
    ├── integrations/     # External service integrations
    └── database/         # Database schema
```

> 📚 **See [docs/README.md](./docs/README.md) for comprehensive documentation** covering all API routes, pages, calculation formulas, and integrations.

---

## 🎮 Eve Online Context

For developers unfamiliar with Eve Online:

| Term              | Meaning                                     |
| ----------------- | ------------------------------------------- |
| **Industry**      | The manufacturing system in Eve Online      |
| **Raw Materials** | Base resources (minerals, PI, moon goo)     |
| **Components**    | Intermediate products used in manufacturing |
| **Jita**          | The main trade hub — think "Amazon" of Eve  |
| **ISK**           | In-game currency (InterStellar Kredits)     |

Manufacturing in Eve often involves:

1. Gathering raw materials
2. Building intermediate components
3. Combining everything into final products (ships, modules, etc.)

This tracker helps manage complex manufacturing chains by tracking what you have vs. what you still need.

---

## 🔧 Configuration

### Changing the Password

Edit the `SITE_PASSWORD` constant in `components/auth-gate.tsx`:

```typescript
const SITE_PASSWORD = 'your-new-password'
```

### EVE SSO Token Grabber

A utility for obtaining OAuth refresh tokens to use in external scripts or cron jobs.

1. **Register an EVE Developer Application** at [developers.eveonline.com](https://developers.eveonline.com/applications)
   - Set the callback URL to `http://localhost:3000/callback`
   - Note your Client ID and Secret

2. **Configure environment variables** in `.env.local`:
   ```env
   EVE_CLIENT_ID=your_client_id
   EVE_CLIENT_SECRET=your_client_secret
   EVE_CALLBACK_URL=http://localhost:3000/callback
   ```

3. **Get your tokens:**
   - Click "Login with EVE SSO" on the login page
   - Authenticate with your EVE account
   - Copy the refresh token from the callback page
   - Use the refresh token in your external scripts to obtain access tokens

4. **Test ESI Endpoints** (optional):
   - Expand the "ESI API Tester" section on the callback page
   - Use quick test buttons for common endpoints (Wallet, Location, Assets, etc.)
   - Or enter a custom ESI URL to test any endpoint
   - View formatted JSON responses with timing info

### Janice API

The app uses [Janice](https://janice.e-351.com/) for Eve Online market data:

- **Without API key:** Items are parsed but prices show as 0
- **With API key:** Real-time Jita market prices are fetched

Request an API key at [janice.e-351.com](https://janice.e-351.com/)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ for Eve Online industrialists**

_Fly safe o7_

</div>
