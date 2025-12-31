"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RotateCcw, Filter } from "lucide-react"

export type ProfitStatusFilter = 'all' | 'profitable' | 'loss'

export interface HistoryFilterState {
  selectedCategories: Set<string>
  profitStatus: ProfitStatusFilter
  minMargin: number | null           // Minimum profit margin %
  minQuantitySold: number | null     // Minimum units sold
}

interface HistoryFilterSidebarProps {
  filters: HistoryFilterState
  onFiltersChange: (filters: HistoryFilterState) => void
  totalItems: number
  filteredCount: number
}

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

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
  profitStatus: 'all',
  minMargin: null,
  minQuantitySold: null,
}

export function HistoryFilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
}: HistoryFilterSidebarProps) {
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    const newCategories = new Set(filters.selectedCategories)
    if (checked) {
      newCategories.add(categoryId)
    } else {
      newCategories.delete(categoryId)
    }
    onFiltersChange({ ...filters, selectedCategories: newCategories })
  }

  const handleProfitStatusChange = (value: ProfitStatusFilter) => {
    onFiltersChange({ ...filters, profitStatus: value })
  }

  const handleMinMarginChange = (value: string) => {
    const margin = parseFloat(value)
    onFiltersChange({ ...filters, minMargin: !isNaN(margin) ? margin : null })
  }

  const handleMinQuantityChange = (value: string) => {
    const qty = parseInt(value)
    onFiltersChange({ ...filters, minQuantitySold: qty > 0 ? qty : null })
  }

  const handleReset = () => {
    onFiltersChange({
      selectedCategories: new Set(DEFAULT_HISTORY_FILTERS.selectedCategories),
      profitStatus: DEFAULT_HISTORY_FILTERS.profitStatus,
      minMargin: DEFAULT_HISTORY_FILTERS.minMargin,
      minQuantitySold: DEFAULT_HISTORY_FILTERS.minQuantitySold,
    })
  }

  const hasActiveFilters =
    filters.profitStatus !== DEFAULT_HISTORY_FILTERS.profitStatus ||
    filters.minMargin !== DEFAULT_HISTORY_FILTERS.minMargin ||
    filters.minQuantitySold !== DEFAULT_HISTORY_FILTERS.minQuantitySold ||
    filters.selectedCategories.size !== DEFAULT_HISTORY_FILTERS.selectedCategories.size

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
        {/* Profit Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Profit Status</Label>
          <Select
            value={filters.profitStatus}
            onValueChange={(v) => handleProfitStatusChange(v as ProfitStatusFilter)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="profitable">Profitable Only</SelectItem>
              <SelectItem value="loss">Loss Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Min Margin % */}
        <div className="space-y-2">
          <Label htmlFor="history-minMargin" className="text-sm font-medium">
            Min Margin %
          </Label>
          <Input
            id="history-minMargin"
            type="number"
            step="1"
            placeholder="No limit"
            value={filters.minMargin ?? ""}
            onChange={(e) => handleMinMarginChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Filter by profit margin percentage
          </p>
        </div>

        {/* Min Quantity Sold */}
        <div className="space-y-2">
          <Label htmlFor="history-minQty" className="text-sm font-medium">
            Min Quantity Sold
          </Label>
          <Input
            id="history-minQty"
            type="number"
            min="1"
            placeholder="No limit"
            value={filters.minQuantitySold ?? ""}
            onChange={(e) => handleMinQuantityChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Filter by total units sold
          </p>
        </div>

        {/* Category Checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Categories</Label>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <div key={category.id} className="flex items-center gap-3">
                <Checkbox
                  id={`history-category-${category.id}`}
                  checked={filters.selectedCategories.has(category.id)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`history-category-${category.id}`}
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

