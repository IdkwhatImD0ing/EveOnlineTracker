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

Pages are responsive with breakpoints:

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 768px | Single column, stacked layout |
| Tablet | 768px - 1024px | 2 column grids |
| Desktop | > 1024px | Full multi-column layouts |

## Styling

All pages use Tailwind CSS with:

- `bg-background` for page backgrounds
- `text-foreground` for text
- `text-muted-foreground` for secondary text
- Custom gradients for visual interest
- Consistent spacing with Tailwind's spacing scale

