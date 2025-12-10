# EVE Online Industry Tracker Documentation

Welcome to the comprehensive documentation for the EVE Online Industry Tracker. This documentation covers all aspects of the application, from API routes to calculation formulas.

## Quick Links

| Section | Description |
|---------|-------------|
| [API Reference](./api/README.md) | Complete API documentation for all endpoints |
| [Pages](./pages/README.md) | Documentation for all application pages |
| [Calculations](./calculations/README.md) | Industry calculation formulas and logic |
| [Integrations](./integrations/README.md) | External service integrations |
| [Database Schema](./database/schema.md) | Database tables and relationships |
| [Caching Strategy](./caching.md) | Data caching with Next.js `"use cache"` |

## Project Overview

The EVE Online Tracker is a Next.js web application designed to help EVE Online players with industry, trading, and market analysis. It provides:

- **Market Seeder**: Analyze profitability for importing items from Jita to alliance hubs
- **Project Management**: Create and track manufacturing projects with raw materials and components
- **Industry Calculator**: Calculate material requirements, job costs, and build times for any blueprint
- **Market Integration**: Real-time Jita prices via ESI, 365 days of historical data in Supabase
- **Buy vs Build Analysis**: Optimize between building and purchasing components
- **Sell Opportunities**: Analyze asset prices to find optimal selling times
- **EVE SSO Integration**: Authenticate with EVE Online for ESI API access

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework with App Router |
| React 19 | UI components |
| TypeScript | Type safety |
| Supabase | PostgreSQL database |
| Tailwind CSS 4 | Styling |
| shadcn/ui | UI component library |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  Sidebar Navigation      │  Pages                                │
│  ├── Dashboard (/)       │  ├── Account overview & quick links   │
│  ├── Market Seeder       │  ├── Import profit analyzer           │
│  ├── Projects            │  ├── Manufacturing project tracker    │
│  ├── Industry            │  ├── Blueprint calculator             │
│  ├── Sell Opportunities  │  ├── Asset price analysis             │
│  └── EVE SSO             │  └── Login & API tokens               │
├─────────────────────────────────────────────────────────────────┤
│                        API Routes                                │
├─────────────────────────────────────────────────────────────────┤
│  /api/auth/eve/*         │  EVE SSO authentication              │
│  /api/esi/*              │  ESI proxy endpoints                 │
│  /api/industry/*         │  Industry calculations               │
│  /api/market-seeder/*    │  Market seeder analysis              │
│  /api/projects/*         │  Project CRUD operations             │
├─────────────────────────────────────────────────────────────────┤
│                     Library Functions                            │
├─────────────────────────────────────────────────────────────────┤
│  lib/cached-data.ts      │  Cached data fetching ("use cache")  │
│  lib/blueprints.ts       │  Blueprint data & calculations       │
│  lib/esi.ts              │  EVE industry API client             │
│  lib/janice.ts           │  Janice market API client            │
│  lib/market-seeder.ts    │  Market seeder algorithm             │
│  lib/eve-sso.ts          │  EVE SSO OAuth helpers               │
│  lib/sde.ts              │  Static data utilities               │
├─────────────────────────────────────────────────────────────────┤
│                    External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  Supabase                │  Database storage (365 days market)  │
│  Janice API              │  Market price data                   │
│  eve-industry.org        │  Cost indices & job costs            │
│  EVE ESI                 │  Game data & character info          │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm package manager
- Supabase account
- Janice API key (optional, for market prices)
- EVE Developer Application (optional, for ESI access)

### Environment Variables

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - Market Prices
JANICE_API_KEY=your-janice-api-key

# Optional - EVE SSO
EVE_CLIENT_ID=your_client_id
EVE_CLIENT_SECRET=your_client_secret
EVE_CALLBACK_URL=http://localhost:3000/callback
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/EveOnlineTracker.git
cd EveOnlineTracker

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run database migrations (in Supabase SQL Editor)
# See docs/database/schema.md for SQL

# Start development server
pnpm dev
```

## Documentation Structure

```
docs/
├── README.md                    # This file
├── caching.md                   # Caching strategy with "use cache"
├── api/
│   ├── README.md               # API conventions and overview
│   ├── auth.md                 # EVE SSO authentication routes
│   ├── esi.md                  # ESI proxy routes
│   ├── industry.md             # Industry calculator routes
│   ├── market-seeder.md        # Market seeder analysis routes
│   └── projects.md             # Project CRUD routes
├── pages/
│   ├── README.md               # Pages overview
│   ├── dashboard.md            # Dashboard home page
│   ├── market-seeder.md        # Market seeder page
│   ├── callback.md             # EVE SSO callback
│   ├── industry-calculator.md  # Industry calculator
│   └── projects.md             # Project pages
├── calculations/
│   ├── README.md               # Calculations overview
│   ├── material-efficiency.md  # ME formulas
│   ├── time-efficiency.md      # TE formulas
│   ├── job-costs.md            # Job cost formulas
│   └── buy-vs-build.md         # Buy mode logic
├── integrations/
│   ├── README.md               # Integrations overview
│   ├── janice-api.md           # Janice API
│   ├── eve-esi.md              # EVE ESI
│   └── eve-industry-org.md     # eve-industry.org
└── database/
    └── schema.md               # Database schema
```

## EVE Online Context

For developers unfamiliar with EVE Online:

| Term | Description |
|------|-------------|
| **Industry** | The manufacturing system in EVE Online |
| **Blueprint** | Recipe for manufacturing items |
| **ME (Material Efficiency)** | Reduces material requirements (0-10%) |
| **TE (Time Efficiency)** | Reduces manufacturing time (0-20%) |
| **Raw Materials** | Base resources (minerals, PI, moon goo) |
| **Components** | Intermediate products built from raw materials |
| **Jita** | Main trade hub in EVE Online |
| **ISK** | In-game currency (InterStellar Kredits) |
| **ESI** | EVE Swagger Interface - official game API |

## Contributing

When adding new features:

1. Update relevant API documentation in `docs/api/`
2. Document any new pages in `docs/pages/`
3. Add calculation explanations to `docs/calculations/` if applicable
4. Update database schema docs if tables change
5. Keep the main README.md project structure current

