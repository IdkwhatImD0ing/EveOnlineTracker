<div align="center">

# 🚀 EVE Online Industry Tracker

**A sleek web application for tracking your Eve Online manufacturing projects, materials, and costs.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

[Features](#-features) • [Getting Started](#-getting-started) • [Usage](#-usage) • [API Reference](#-api-reference) • [Project Structure](#-project-structure)

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
- **🧮 Industry Calculator** — Calculate material requirements and costs for any blueprint
- **🛒 Buy Mode** — Automatically adjust materials based on buy vs build recommendations

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

---

## 🔌 API Reference

| Method   | Endpoint                              | Description                    |
| -------- | ------------------------------------- | ------------------------------ |
| `GET`    | `/api/projects`                       | List all projects              |
| `POST`   | `/api/projects`                       | Create a new project           |
| `GET`    | `/api/projects/[id]`                  | Get project with all items     |
| `DELETE` | `/api/projects/[id]`                  | Delete a project               |
| `PATCH`  | `/api/projects/[id]/items/[itemId]`   | Update item (collected status) |
| `POST`   | `/api/projects/[id]/costs`            | Add additional cost            |
| `DELETE` | `/api/projects/[id]/costs?costId=xxx` | Remove additional cost         |
| `POST`   | `/api/industry/calculate`             | Calculate blueprint materials  |

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
│   │   ├── projects/      # Project CRUD endpoints
│   │   └── industry/      # Industry calculator API
│   ├── industry/          # Industry calculator page
│   ├── projects/          # Project pages
│   │   ├── [id]/         # Project detail view
│   │   └── new/          # Create project form
│   ├── layout.tsx        # Root layout with auth
│   └── page.tsx          # Home page (project list)
│
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── industry/         # Industry calculator components
│   │   ├── blueprint-search.tsx
│   │   ├── components-list.tsx
│   │   ├── grouped-materials.tsx
│   │   └── ...
│   ├── auth-gate.tsx     # Password protection
│   ├── item-list.tsx     # Item display with checkboxes
│   ├── price-summary.tsx # Jita price totals
│   ├── additional-costs.tsx
│   └── total-cost.tsx
│
├── lib/                   # Utilities
│   ├── janice.ts         # Janice API client
│   └── utils.ts          # Helper functions
│
├── types/                 # TypeScript definitions
│   └── database.ts       # Database types
│
├── utils/supabase/       # Supabase client
│   └── server.ts         # Server-side client
│
└── docs/                  # Documentation
    ├── supabase.md       # Database schema
    └── user_flow.md      # App flow documentation
```

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
