# Pages Documentation

This section documents all pages in the EVE Online Industry Tracker application.

## Overview

The application uses Next.js App Router with the following page structure:

```
app/
├── page.tsx                 # Home page (/)
├── callback/
│   └── page.tsx            # EVE SSO callback (/callback)
├── industry/
│   └── page.tsx            # Industry calculator (/industry)
├── jita-opportunities/
│   └── page.tsx            # Jita opportunities (/jita-opportunities)
├── market-seeder/
│   └── page.tsx            # Market seeder (/market-seeder)
├── market/
│   └── opportunities/
│       └── page.tsx        # Redirects to /jita-opportunities?tab=market
├── sell-opportunities/
│   └── page.tsx            # Redirects to /jita-opportunities?tab=sell
└── projects/
    ├── new/
    │   └── page.tsx        # New project form (/projects/new)
    └── [id]/
        └── page.tsx        # Project detail (/projects/[id])
```

## Page Index

| Page | Route | Description |
|------|-------|-------------|
| [Home](./home.md) | `/` | Project list and navigation hub |
| [EVE SSO Callback](./callback.md) | `/callback` | Token display and ESI API tester |
| [Industry Calculator](./industry-calculator.md) | `/industry` | Blueprint material calculations |
| [Jita Opportunities](./jita-opportunities.md) | `/jita-opportunities` | Combined sell timing + market opportunities (tabbed) |
| [Market Seeder](./market-seeder.md) | `/market-seeder` | Import profit analyzer (tabbed) |
| [Projects](./projects.md) | `/projects/*` | Project creation and detail views |

## Navigation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        Home Page (/)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Industry   │  │   EVE SSO   │  │ New Project │          │
│  │ Calculator  │  │    Login    │  │             │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         │         ┌──────┴──────┐  ┌──────┴──────┐          │
│         │         │  /callback  │  │/projects/new│          │
│         │         │  (tokens)   │  │   (form)    │          │
│         │         └─────────────┘  └──────┬──────┘          │
│         │                                 │                  │
│  ┌──────┴──────┐                  ┌──────┴──────┐          │
│  │  /industry  │                  │/projects/[id]│◄─────────┤
│  │(calculator) │────────────────►│  (detail)   │ Project   │
│  └─────────────┘  Create Project  └─────────────┘ Cards     │
└──────────────────────────────────────────────────────────────┘
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

Most pages don't require authentication. The application uses a simple password gate (`AuthGate` component) that protects the entire site with a single password stored in localStorage.

EVE SSO authentication is only needed for ESI API features (callback page).

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

