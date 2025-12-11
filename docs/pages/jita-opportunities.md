# Jita Opportunities Page

The Jita Opportunities page combines the two Jita-focused trading tools into a single place:

- **Sell Opportunities**: Analyze your character's Jita assets to find good sell timing (near ATH).
- **Market Opportunities**: Find undervalued items in Jita using multi-signal analysis.

## Overview

**Path:** `/jita-opportunities`

**Purpose:** A single tabbed workflow for Jita trading decisions: what to sell now vs what to buy now.

## Tabs

### Sell Opportunities Tab

- Uses EVE SSO to load your character assets (Jita 4-4).
- Compares current prices to historical all-time-high data to recommend **Sell / Hold / Wait**.

### Market Opportunities Tab

- Runs a streaming analysis (SSE) over tradeable items.
- Ranks opportunities by multi-signal score and weekly ISK potential.

## Deep Links

The page supports selecting a tab via query string:

- `/jita-opportunities?tab=sell`
- `/jita-opportunities?tab=market`

## Redirects (legacy routes)

These older routes still work but redirect into the appropriate tab:

- `/sell-opportunities` → `/jita-opportunities?tab=sell`
- `/market/opportunities` → `/jita-opportunities?tab=market`


