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
  minOrdersPerDay: number | null  // null = no limit (uses configurable hub factor)
  minProfitPerDay: number | null  // null = no limit (ISK profit per day at hub)
  noCompetitionOnly: boolean
  hideInInventory: boolean  // Hide items user has in their inventory
  hasActiveOrderOnly: boolean  // Show only items where user has active sell orders
  selectedCategories: Set<string>
  selectedMetaTypes: Set<string>  // Meta type filter (Tech I, Tech II, Faction, etc.)
}

interface FilterSidebarProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  totalItems: number
  filteredCount: number
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
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

const META_TYPES = [
  { id: "Tech I", label: "Tech I" },
  { id: "Tech II", label: "Tech II" },
  { id: "Tech III", label: "Tech III" },
  { id: "Faction", label: "Faction" },
  { id: "Deadspace", label: "Deadspace" },
  { id: "Officer", label: "Officer" },
  { id: "Storyline", label: "Storyline" },
  { id: "Abyssal", label: "Abyssal" },
] as const

const DEFAULT_FILTERS: FilterState = {
  minMargin: 10,
  maxJitaCost: null,  // No limit by default
  minOrdersPerDay: null,  // No limit by default
  minProfitPerDay: null,  // No limit by default
  noCompetitionOnly: false,
  hideInInventory: false,
  hasActiveOrderOnly: false,
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
  selectedMetaTypes: new Set([
    "Tech I", "Tech II", "Tech III", "Faction", 
    "Deadspace", "Officer", "Storyline", "Abyssal"
  ]),
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
  hubFactorPercent = "5%",
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

  const handleMinOrdersPerDayChange = (value: string) => {
    // Parse value - empty string or 0 means no limit
    const orders = parseFloat(value)
    onFiltersChange({ ...filters, minOrdersPerDay: orders > 0 ? orders : null })
  }

  const handleMinProfitPerDayChange = (value: string) => {
    // Parse value - empty string or 0 means no limit
    const profit = parseFloat(value)
    onFiltersChange({ ...filters, minProfitPerDay: profit > 0 ? profit : null })
  }

  const handleNoCompetitionChange = (checked: boolean) => {
    onFiltersChange({ ...filters, noCompetitionOnly: checked })
  }

  const handleHideInInventoryChange = (checked: boolean) => {
    onFiltersChange({ ...filters, hideInInventory: checked })
  }

  const handleHasActiveOrderChange = (checked: boolean) => {
    onFiltersChange({ ...filters, hasActiveOrderOnly: checked })
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

  const handleMetaTypeChange = (metaTypeId: string, checked: boolean) => {
    const newMetaTypes = new Set(filters.selectedMetaTypes)
    if (checked) {
      newMetaTypes.add(metaTypeId)
    } else {
      newMetaTypes.delete(metaTypeId)
    }
    onFiltersChange({ ...filters, selectedMetaTypes: newMetaTypes })
  }

  const handleReset = () => {
    onFiltersChange({
      minMargin: DEFAULT_FILTERS.minMargin,
      maxJitaCost: DEFAULT_FILTERS.maxJitaCost,
      minOrdersPerDay: DEFAULT_FILTERS.minOrdersPerDay,
      minProfitPerDay: DEFAULT_FILTERS.minProfitPerDay,
      noCompetitionOnly: DEFAULT_FILTERS.noCompetitionOnly,
      hideInInventory: DEFAULT_FILTERS.hideInInventory,
      hasActiveOrderOnly: DEFAULT_FILTERS.hasActiveOrderOnly,
      selectedCategories: new Set(DEFAULT_FILTERS.selectedCategories),
      selectedMetaTypes: new Set(DEFAULT_FILTERS.selectedMetaTypes),
    })
  }

  const hasActiveFilters =
    filters.minMargin !== DEFAULT_FILTERS.minMargin ||
    filters.maxJitaCost !== DEFAULT_FILTERS.maxJitaCost ||
    filters.minOrdersPerDay !== DEFAULT_FILTERS.minOrdersPerDay ||
    filters.minProfitPerDay !== DEFAULT_FILTERS.minProfitPerDay ||
    filters.noCompetitionOnly !== DEFAULT_FILTERS.noCompetitionOnly ||
    filters.hideInInventory !== DEFAULT_FILTERS.hideInInventory ||
    filters.hasActiveOrderOnly !== DEFAULT_FILTERS.hasActiveOrderOnly ||
    filters.selectedCategories.size !== DEFAULT_FILTERS.selectedCategories.size ||
    filters.selectedMetaTypes.size !== DEFAULT_FILTERS.selectedMetaTypes.size

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

        {/* Min Orders/Day */}
        <div className="space-y-2">
          <Label htmlFor="minOrdersPerDay" className="text-sm font-medium">
            Min Orders/Day
          </Label>
          <Input
            id="minOrdersPerDay"
            type="number"
            min="0"
            step="0.1"
            placeholder="No limit"
            value={filters.minOrdersPerDay ?? ""}
            onChange={(e) => handleMinOrdersPerDayChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Est. daily sales @ {hubFactorPercent} regional
          </p>
        </div>

        {/* Min Profit/Day */}
        <div className="space-y-2">
          <Label htmlFor="minProfitPerDay" className="text-sm font-medium">
            Min Profit/Day (ISK)
          </Label>
          <Input
            id="minProfitPerDay"
            type="number"
            min="0"
            placeholder="No limit"
            value={filters.minProfitPerDay ?? ""}
            onChange={(e) => handleMinProfitPerDayChange(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Daily profit @ {hubFactorPercent} regional
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
            No competition
          </Label>
        </div>

        {/* Has Active Order Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="hasActiveOrder"
            checked={filters.hasActiveOrderOnly}
            onCheckedChange={(checked) =>
              handleHasActiveOrderChange(checked === true)
            }
          />
          <Label
            htmlFor="hasActiveOrder"
            className="text-sm cursor-pointer leading-none"
          >
            Has active order
          </Label>
        </div>

        {/* Hide In Inventory Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="hideInInventory"
            checked={filters.hideInInventory}
            onCheckedChange={(checked) =>
              handleHideInInventoryChange(checked === true)
            }
          />
          <Label
            htmlFor="hideInInventory"
            className="text-sm cursor-pointer leading-none"
          >
            None in inventory
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

        {/* Meta Type Checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Meta Types</Label>
          <div className="space-y-2">
            {META_TYPES.map((metaType) => (
              <div key={metaType.id} className="flex items-center gap-3">
                <Checkbox
                  id={`meta-${metaType.id}`}
                  checked={filters.selectedMetaTypes.has(metaType.id)}
                  onCheckedChange={(checked) =>
                    handleMetaTypeChange(metaType.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`meta-${metaType.id}`}
                  className="text-sm cursor-pointer leading-none"
                >
                  {metaType.label}
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
