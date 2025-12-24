"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RotateCcw, Filter } from "lucide-react"

export interface WatchlistFilterState {
  selectedUrgency: Set<string>  // 'critical' | 'warning' | 'ok' | 'none'
  selectedCategories: Set<string>
  hideSellOrderItems: boolean  // Hide items where user has active sell orders
}

interface WatchlistFilterSidebarProps {
  filters: WatchlistFilterState
  onFiltersChange: (filters: WatchlistFilterState) => void
  totalItems: number
  filteredCount: number
}

const URGENCY_LEVELS = [
  { id: "critical", label: "Critical (0 stock)", color: "text-destructive" },
  { id: "warning", label: "Warning (<3 days)", color: "text-amber-500" },
  { id: "ok", label: "OK (≥3 days)", color: "text-emerald-500" },
  { id: "none", label: "No Data", color: "text-muted-foreground" },
] as const

const CATEGORIES = [
  { id: "Module", label: "Modules" },
  { id: "Ship", label: "Ships" },
  { id: "Charge", label: "Ammo" },
  { id: "Booster", label: "Boosters" },
  { id: "Drone", label: "Drones" },
  { id: "Fighter", label: "Fighters" },
  { id: "Implant", label: "Implants" },
  { id: "Deployable", label: "Deployables" },
  { id: "Subsystem", label: "Subsystems" },
] as const

const DEFAULT_WATCHLIST_FILTERS: WatchlistFilterState = {
  selectedUrgency: new Set(["critical", "warning", "ok", "none"]),
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
  hideSellOrderItems: false,
}

export function WatchlistFilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
}: WatchlistFilterSidebarProps) {
  const handleUrgencyChange = (urgencyId: string, checked: boolean) => {
    const newUrgency = new Set(filters.selectedUrgency)
    if (checked) {
      newUrgency.add(urgencyId)
    } else {
      newUrgency.delete(urgencyId)
    }
    onFiltersChange({ ...filters, selectedUrgency: newUrgency })
  }

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = new Set(filters.selectedCategories)
    if (checked) {
      newCategories.add(categoryId)
    } else {
      newCategories.delete(categoryId)
    }
    onFiltersChange({ ...filters, selectedCategories: newCategories })
  }

  const handleHideSellOrderChange = (checked: boolean) => {
    onFiltersChange({ ...filters, hideSellOrderItems: checked })
  }

  const handleReset = () => {
    onFiltersChange({
      selectedUrgency: new Set(DEFAULT_WATCHLIST_FILTERS.selectedUrgency),
      selectedCategories: new Set(DEFAULT_WATCHLIST_FILTERS.selectedCategories),
      hideSellOrderItems: DEFAULT_WATCHLIST_FILTERS.hideSellOrderItems,
    })
  }

  const hasActiveFilters =
    filters.selectedUrgency.size !== DEFAULT_WATCHLIST_FILTERS.selectedUrgency.size ||
    filters.selectedCategories.size !== DEFAULT_WATCHLIST_FILTERS.selectedCategories.size ||
    filters.hideSellOrderItems !== DEFAULT_WATCHLIST_FILTERS.hideSellOrderItems

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4" />
          Filters
        </CardTitle>
        {totalItems > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalItems} items
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hide Sell Order Items Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="hide-sell-order-items"
            checked={filters.hideSellOrderItems}
            onCheckedChange={(checked) => handleHideSellOrderChange(checked === true)}
          />
          <Label
            htmlFor="hide-sell-order-items"
            className="text-sm cursor-pointer leading-none"
          >
            Hide items with sell orders
          </Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-4">
          Items where you have active sell orders
        </p>

        {/* Urgency Level Filters */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Urgency Level</Label>
          <div className="space-y-2">
            {URGENCY_LEVELS.map((urgency) => (
              <div key={urgency.id} className="flex items-center gap-3">
                <Checkbox
                  id={`watchlist-urgency-${urgency.id}`}
                  checked={filters.selectedUrgency.has(urgency.id)}
                  onCheckedChange={(checked) =>
                    handleUrgencyChange(urgency.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`watchlist-urgency-${urgency.id}`}
                  className={`text-sm cursor-pointer leading-none ${urgency.color}`}
                >
                  {urgency.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Category Checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Categories</Label>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <div key={category.id} className="flex items-center gap-3">
                <Checkbox
                  id={`watchlist-category-${category.id}`}
                  checked={filters.selectedCategories.has(category.id)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`watchlist-category-${category.id}`}
                  className="text-sm cursor-pointer leading-none"
                >
                  {category.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full gap-2"
          >
            <RotateCcw className="size-4" />
            Reset Filters
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export { DEFAULT_WATCHLIST_FILTERS }

