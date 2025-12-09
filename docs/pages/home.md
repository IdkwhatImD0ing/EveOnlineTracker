# Home Page

The main landing page displaying all projects and navigation to other features.

## Route

`/` — `app/page.tsx`

## Purpose

The home page serves as the application's dashboard, providing:

- Overview of all existing projects
- Quick access to create new projects
- Navigation to Industry Calculator
- Access to EVE SSO login

## Features

### Header Section

```
┌────────────────────────────────────────────────────────────────┐
│  EVE Industry Tracker                                          │
│  Track your manufacturing projects                             │
│                                                                │
│  [Industry Calculator] [EVE SSO] [New Project]                │
└────────────────────────────────────────────────────────────────┘
```

**Navigation Buttons:**
- **Industry Calculator** — Opens `/industry` page
- **EVE SSO** — Redirects to EVE SSO login flow
- **New Project** — Opens `/projects/new` page

### Project Grid

Displays all projects in a responsive grid:

| Screen Size | Columns |
|-------------|---------|
| Mobile | 1 column |
| Medium | 2 columns |
| Large | 3 columns |

**Project Card:**
```
┌─────────────────────────┐
│  Project Name           │
│  📅 Jan 15, 2024       │
└─────────────────────────┘
```

Each card shows:
- Project name (truncated if long)
- Creation date
- Hover effect for interactivity

Clicking a card navigates to `/projects/[id]`.

### Empty State

When no projects exist:

```
┌─────────────────────────────────────────┐
│           📁 No projects yet            │
│                                         │
│  Create your first industry project to  │
│  start tracking materials and costs.    │
│                                         │
│         [Create Project]                │
└─────────────────────────────────────────┘
```

### Loading State

Shows a centered spinner while fetching projects.

## State

```typescript
const [projects, setProjects] = useState<Project[]>([])
const [isLoading, setIsLoading] = useState(true)
```

## API Calls

| Endpoint | When | Purpose |
|----------|------|---------|
| `GET /api/projects` | On mount | Fetch all projects |

## Data Flow

```
┌─────────────┐     useEffect     ┌─────────────────┐
│  Component  │ ──────────────►   │ GET /api/projects│
│   Mount     │                   └────────┬────────┘
└─────────────┘                            │
                                           ▼
┌─────────────┐                   ┌─────────────────┐
│   Render    │ ◄──────────────   │  Set projects   │
│   Cards     │                   │  Set !isLoading │
└─────────────┘                   └─────────────────┘
```

## Components Used

| Component | Source | Purpose |
|-----------|--------|---------|
| `Card` | shadcn/ui | Project card container |
| `Button` | shadcn/ui | Navigation buttons |
| `LogoutButton` | Custom | Clear auth and reload |
| `Loader2` | lucide-react | Loading spinner |
| `Plus` | lucide-react | New project icon |
| `FolderOpen` | lucide-react | Empty state icon |
| `Calendar` | lucide-react | Date icon |
| `Calculator` | lucide-react | Industry calc icon |
| `KeyRound` | lucide-react | EVE SSO icon |

## Styling

- Max width: `max-w-4xl` (centered)
- Padding: `p-8`
- Background: `bg-background`
- Card hover: `hover:bg-muted/50`
- Dashed border for empty state card

## Related Files

- `app/page.tsx` — Page component
- `components/logout-button.tsx` — Logout functionality
- `types/database.ts` — Project type definition

