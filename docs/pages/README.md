# Pages Documentation

This section documents all pages in the EVE Online Industry Tracker application.

## Overview

The application uses Next.js App Router with the following page structure:

```
app/
├── (authenticated)/           # Protected routes (require auth + allowed)
│   ├── layout.tsx            # AuthGate + SidebarLayout wrapper
│   ├── page.tsx              # Dashboard (/)
│   ├── api-explorer/
│   │   └── page.tsx          # ESI API testing (/api-explorer)
│   ├── industry/
│   │   └── page.tsx          # Industry calculator (/industry)
│   ├── jita-opportunities/
│   │   └── page.tsx          # Jita opportunities (/jita-opportunities)
│   ├── jita-purchase/
│   │   └── page.tsx          # Jita purchase calculator (/jita-purchase)
│   ├── market-seeder/
│   │   └── page.tsx          # Market seeder (/market-seeder)
│   ├── market/
│   │   └── page.tsx          # Redirects to /jita-opportunities?tab=market
│   ├── sell-opportunities/
│   │   └── page.tsx          # Redirects to /jita-opportunities?tab=sell
│   ├── admin/
│   │   ├── page.tsx          # Admin dashboard (/admin)
│   │   └── fits/
│   │       └── page.tsx      # Alliance fits management (/admin/fits)
│   ├── public-market-seeding/
│   │   └── page.tsx          # Public market seeding (/public-market-seeding)
│   └── projects/
│       ├── page.tsx          # Project list (/projects)
│       ├── new/
│       │   └── page.tsx      # New project form (/projects/new)
│       └── [id]/
│           └── page.tsx      # Project detail (/projects/[id])
└── (public)/                  # Public routes (no auth required)
    ├── layout.tsx            # Minimal layout
    └── callback/
        └── page.tsx          # EVE SSO callback (/callback)
```

## Page Index

| Page | Route | Description |
|------|-------|-------------|
| [Dashboard](./dashboard.md) | `/` | Account overview and quick links |
| [API Explorer](./api-explorer.md) | `/api-explorer` | Interactive ESI endpoint testing |
| [EVE SSO Callback](./callback.md) | `/callback` | OAuth callback handler |
| [Industry Calculator](./industry-calculator.md) | `/industry` | Blueprint material calculations |
| [Jita Opportunities](./jita-opportunities.md) | `/jita-opportunities` | Combined sell timing + market opportunities (tabbed) |
| [Jita Purchase](./jita-purchase.md) | `/jita-purchase` | Calculate Jita buy costs |
| [Market Seeder](./market-seeder.md) | `/market-seeder` | Import profit analyzer (tabbed) |
| [Projects](./projects.md) | `/projects/*` | Project creation and detail views |
| [Admin Dashboard](./admin.md) | `/admin` | User management (admin-only) |
| [Alliance Fits](./alliance-fits.md) | `/admin/fits` | Ship fitting management (admin-only) |

## Navigation Flow

```
┌────────────────────────────────────────────────────────────────────┐
│  Sidebar Navigation                      Main Content Area          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ Dashboard       │───────────────►│ Account overview, stats │   │
│  └─────────────────┘                └─────────────────────────┘   │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ Market Seeder   │───────────────►│ Import profit analysis  │   │
│  └─────────────────┘                └─────────────────────────┘   │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ Jita Opps       │───────────────►│ Sell + market opps      │   │
│  └─────────────────┘                └─────────────────────────┘   │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ Projects        │───────────────►│ Project list → detail   │   │
│  └─────────────────┘                └─────────────────────────┘   │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ Industry        │───────────────►│ Blueprint calculator    │   │
│  └─────────────────┘                └─────────────────────────┘   │
│  ┌─────────────────┐                ┌─────────────────────────┐   │
│  │ API Explorer    │───────────────►│ ESI endpoint testing    │   │
│  └─────────────────┘                └─────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘

EVE SSO Login Flow:
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Login Btn  │─────►│  EVE SSO    │─────►│  /callback  │────► Dashboard
└─────────────┘      └─────────────┘      └─────────────┘
```

## Common Components

All pages use shared UI components from shadcn/ui:

| Component | Usage |
|-----------|-------|
| `Card` | Container for content sections |
| `Button` | Actions and navigation |
| `Input` | Text input fields |
| `Textarea` | Multi-line input for item lists |
| `Label` | Form field labels |
| `Alert` | Error and warning messages |
| `Select` | Dropdown selections |
| `Checkbox` | Toggle states |

## State Management

Pages use React's built-in state management:

- `useState` for local component state
- `useEffect` for data fetching on mount
- `useCallback` for memoized functions
- `useMemo` for computed values
- `useParams` for route parameters
- `useRouter` for navigation

## Authentication

The application uses EVE SSO (Single Sign-On) for authentication. The `AuthGate` component wraps the entire application and:

1. Checks for a valid session cookie
2. Shows a login screen if not authenticated
3. Shows a "Pending Approval" screen if role is `public`
4. Renders the app for all approved roles (`slyce`, `user`, `pro`, `admin`)

**Multi-Account Support:** Users can link multiple EVE characters (alts) to their account. Data is automatically aggregated across all linked characters.

**User Roles:**
- `public` - New user, not in Slyce alliance, pending approval (no access)
- `slyce` - Slyce alliance member, auto-approved on registration (full access)
- `user` - Manually approved by admin (full access)
- `pro` - Premium access granted by admin (full access)
- `admin` - Full access including admin dashboard

**Access Control:** New users are automatically assigned `slyce` role if they're in the Slyce alliance, or `public` role otherwise. All approved roles have full access to the application except the Admin Dashboard which requires `admin` role. Administrators can change user roles via the Admin Dashboard (`/admin`).

See [Authentication API](../api/auth.md) and [Admin Dashboard](admin.md) for details.

## Error Handling

All pages follow consistent error handling:

1. Display loading spinner while fetching
2. Show error alert if fetch fails
3. Provide "Back to Home" navigation on errors
4. Log errors to console for debugging

## Responsive Design

The application is fully responsive and optimized for both desktop and mobile (PWA) usage.

### Breakpoints

| Breakpoint | Width | Tailwind Prefix | Behavior |
|------------|-------|-----------------|----------|
| Mobile | < 640px | (default) | Single column, hamburger menu |
| Small | 640px+ | `sm:` | 2 column grids |
| Tablet | 768px+ | `md:` | Sidebar visible, larger typography |
| Desktop | 1024px+ | `lg:` | Full multi-column layouts |

### Mobile Navigation

On mobile devices (< 768px):
- Fixed header bar with hamburger menu icon and app branding
- Sidebar becomes an overlay drawer that slides in from the left
- Backdrop overlay when menu is open (click to close)
- Auto-close sidebar when navigating between pages
- Character avatar shown in header when logged in

### Responsive Patterns

| Pattern | Mobile | Desktop |
|---------|--------|---------|
| Page padding | `p-4` | `p-8` |
| Header text | `text-2xl` | `text-3xl` |
| Card padding | `p-3`-`p-4` | `p-6` |
| Stats grid | 2 columns | 4 columns |
| Feature grid | 1-2 columns | 3 columns |
| Tables | Horizontal scroll, hidden columns | Full columns |
| Tabs | Scrollable, compact text | Full grid layout |

### Component Conventions

- Use `md:` prefix for desktop-specific styles
- Hiding content: `hidden md:block` or `md:hidden`
- Responsive text: `text-sm md:text-base`, `text-2xl md:text-3xl`
- Responsive spacing: `gap-3 md:gap-4`, `p-4 md:p-8`
- Touch targets: Minimum 44x44px on mobile (`py-2.5`, `size-10`)
- Truncation: Apply `truncate` and `min-w-0` for text that may overflow

## Styling

All pages use Tailwind CSS with:

- `bg-background` for page backgrounds
- `text-foreground` for text
- `text-muted-foreground` for secondary text
- Custom gradients for visual interest
- Consistent spacing with Tailwind's spacing scale
- Active states with `active:scale-[0.98]` for touch feedback

