"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw, Filter } from "lucide-react"

export interface StockFilterState {
  minOrdersPerDay: number | null      // Minimum estimated daily sales
  minProfitPerDay: number | null      // Minimum ISK profit per day
  maxJitaCost: number | null          // Maximum item Jita cost
  selectedUrgency: Set<string>        // 'critical' | 'warning' | 'ok' | 'none'
  selectedCategories: Set<string>
  noCompetitionOnly: boolean          // Show only items with no competition
  hasActiveOrderOnly: boolean         // Show only items where user has active sell orders
}

interface StockFilterSidebarProps {
  filters: StockFilterState
  onFiltersChange: (filters: StockFilterState) => void
  totalItems: number
  filteredCount: number
  hubFactorPercent?: string           // e.g. "5%" - for display in labels
  idPrefix?: string                   // Unique ID prefix for form elements
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

export const DEFAULT_STOCK_FILTERS: StockFilterState = {
  minOrdersPerDay: null,
  minProfitPerDay: null,
  maxJitaCost: null,
  selectedUrgency: new Set(["critical", "warning", "ok", "none"]),
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
  noCompetitionOnly: false,
  hasActiveOrderOnly: false,
}

export function StockFilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
  hubFactorPercent = "5%",
  idPrefix = "stock",
}: StockFilterSidebarProps) {
  const handleMinOrdersChange = (value: string) => {
    const orders = parseFloat(value)
    onFiltersChange({ ...filters, minOrdersPerDay: orders > 0 ? orders : null })
  }

  const handleMinProfitChange = (value: string) => {
    const profit = parseFloat(value)
    onFiltersChange({ ...filters, minProfitPerDay: profit > 0 ? profit : null })
  }

  const handleMaxCostChange = (value: string) => {
    const cost = parseFloat(value)
    onFiltersChange({ ...filters, maxJitaCost: cost > 0 ? cost : null })
  }

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

  const handleNoCompetitionChange = (checked: boolean) => {
    onFiltersChange({ ...filters, noCompetitionOnly: checked })
  }

  const handleHasActiveOrderChange = (checked: boolean) => {
    onFiltersChange({ ...filters, hasActiveOrderOnly: checked })
  }

  const handleReset = () => {
    onFiltersChange({
      minOrdersPerDay: DEFAULT_STOCK_FILTERS.minOrdersPerDay,
      minProfitPerDay: DEFAULT_STOCK_FILTERS.minProfitPerDay,
      maxJitaCost: DEFAULT_STOCK_FILTERS.maxJitaCost,
      selectedUrgency: new Set(DEFAULT_STOCK_FILTERS.selectedUrgency),
      selectedCategories: new Set(DEFAULT_STOCK_FILTERS.selectedCategories),
      noCompetitionOnly: DEFAULT_STOCK_FILTERS.noCompetitionOnly,
      hasActiveOrderOnly: DEFAULT_STOCK_FILTERS.hasActiveOrderOnly,
    })
  }

  const hasActiveFilters =
    filters.minOrdersPerDay !== DEFAULT_STOCK_FILTERS.minOrdersPerDay ||
    filters.minProfitPerDay !== DEFAULT_STOCK_FILTERS.minProfitPerDay ||
    filters.maxJitaCost !== DEFAULT_STOCK_FILTERS.maxJitaCost ||
    filters.selectedUrgency.size !== DEFAULT_STOCK_FILTERS.selectedUrgency.size ||
    filters.selectedCategories.size !== DEFAULT_STOCK_FILTERS.selectedCategories.size ||
    filters.noCompetitionOnly !== DEFAULT_STOCK_FILTERS.noCompetitionOnly ||
    filters.hasActiveOrderOnly !== DEFAULT_STOCK_FILTERS.hasActiveOrderOnly

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
        {/* Min Orders/Day */}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-minOrders`} className="text-sm font-medium">
            Min Orders/Day
          </Label>
          <Input
            id={`${idPrefix}-minOrders`}
            type="number"
            min="0"
            step="0.1"
            placeholder="No limit"
            value={filters.minOrdersPerDay ?? ""}
            onChange={(e) => handleMinOrdersChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Est. daily sales @ {hubFactorPercent} regional
          </p>
        </div>

        {/* Min Profit/Day */}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-minProfit`} className="text-sm font-medium">
            Min Profit/Day (ISK)
          </Label>
          <Input
            id={`${idPrefix}-minProfit`}
            type="number"
            min="0"
            placeholder="No limit"
            value={filters.minProfitPerDay ?? ""}
            onChange={(e) => handleMinProfitChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Daily profit @ {hubFactorPercent} regional
          </p>
        </div>

        {/* Max Jita Cost */}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-maxCost`} className="text-sm font-medium">
            Max Jita Cost (ISK)
          </Label>
          <Input
            id={`${idPrefix}-maxCost`}
            type="number"
            min="0"
            placeholder="No limit"
            value={filters.maxJitaCost ?? ""}
            onChange={(e) => handleMaxCostChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for no limit
          </p>
        </div>

        {/* No Competition Only Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id={`${idPrefix}-no-competition`}
            checked={filters.noCompetitionOnly}
            onCheckedChange={(checked) => handleNoCompetitionChange(checked === true)}
          />
          <Label
            htmlFor={`${idPrefix}-no-competition`}
            className="text-sm cursor-pointer leading-none"
          >
            No competition
          </Label>
        </div>

        {/* Has Active Order Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id={`${idPrefix}-has-active-order`}
            checked={filters.hasActiveOrderOnly}
            onCheckedChange={(checked) => handleHasActiveOrderChange(checked === true)}
          />
          <Label
            htmlFor={`${idPrefix}-has-active-order`}
            className="text-sm cursor-pointer leading-none"
          >
            Has active order
          </Label>
        </div>

        {/* Urgency Level Filters */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Urgency Level</Label>
          <div className="space-y-2">
            {URGENCY_LEVELS.map((urgency) => (
              <div key={urgency.id} className="flex items-center gap-3">
                <Checkbox
                  id={`${idPrefix}-urgency-${urgency.id}`}
                  checked={filters.selectedUrgency.has(urgency.id)}
                  onCheckedChange={(checked) =>
                    handleUrgencyChange(urgency.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`${idPrefix}-urgency-${urgency.id}`}
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
                  id={`${idPrefix}-category-${category.id}`}
                  checked={filters.selectedCategories.has(category.id)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`${idPrefix}-category-${category.id}`}
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
