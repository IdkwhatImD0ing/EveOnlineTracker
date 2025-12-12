"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw, Filter } from "lucide-react"

export interface FilterState {
  minMargin: number
  maxJitaCost: number | null  // null = no limit
  noCompetitionOnly: boolean
  selectedCategories: Set<string>
}

interface FilterSidebarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
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

const DEFAULT_FILTERS: FilterState = {
  minMargin: 10,
  maxJitaCost: null,  // No limit by default
  noCompetitionOnly: false,
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
}: FilterSidebarProps) {
  const handleMarginChange = (value: string) => {
    const margin = parseFloat(value) || 0
    onFiltersChange({ ...filters, minMargin: margin })
  }

  const handleMaxCostChange = (value: string) => {
    // Parse value - empty string or 0 means no limit
    const cost = parseFloat(value)
    onFiltersChange({ ...filters, maxJitaCost: cost > 0 ? cost : null })
  }

  const handleNoCompetitionChange = (checked: boolean) => {
    onFiltersChange({ ...filters, noCompetitionOnly: checked })
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

  const handleReset = () => {
    onFiltersChange({
      minMargin: DEFAULT_FILTERS.minMargin,
      maxJitaCost: DEFAULT_FILTERS.maxJitaCost,
      noCompetitionOnly: DEFAULT_FILTERS.noCompetitionOnly,
      selectedCategories: new Set(DEFAULT_FILTERS.selectedCategories),
    })
  }

  const hasActiveFilters =
    filters.minMargin !== DEFAULT_FILTERS.minMargin ||
    filters.maxJitaCost !== DEFAULT_FILTERS.maxJitaCost ||
    filters.noCompetitionOnly !== DEFAULT_FILTERS.noCompetitionOnly ||
    filters.selectedCategories.size !== DEFAULT_FILTERS.selectedCategories.size

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
        {/* Min Margin % */}
        <div className="space-y-2">
          <Label htmlFor="minMargin" className="text-sm font-medium">
            Min Margin %
          </Label>
          <Input
            id="minMargin"
            type="number"
            min="0"
            max="1000"
            value={filters.minMargin}
            onChange={(e) => handleMarginChange(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Max Jita Cost */}
        <div className="space-y-2">
          <Label htmlFor="maxJitaCost" className="text-sm font-medium">
            Max Jita Cost (ISK)
          </Label>
          <Input
            id="maxJitaCost"
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

        {/* No Competition Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="noCompetition"
            checked={filters.noCompetitionOnly}
            onCheckedChange={(checked) =>
              handleNoCompetitionChange(checked === true)
            }
          />
          <Label
            htmlFor="noCompetition"
            className="text-sm cursor-pointer leading-none"
          >
            No competition only
          </Label>
        </div>

        {/* Category Checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Categories</Label>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <div key={category.id} className="flex items-center gap-3">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={filters.selectedCategories.has(category.id)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`category-${category.id}`}
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

export { DEFAULT_FILTERS }

