"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RotateCcw, Filter } from "lucide-react"

export type CompetitionFilter = 'all' | 'no_competition' | 'with_competition'

export interface DepletionFilterState {
  selectedUrgency: Set<string>  // 'critical' | 'warning' | 'ok' | 'none'
  selectedCategories: Set<string>
  hideOwnedItems: boolean  // Hide items in user's inventory or with active sell orders
  competitionFilter: CompetitionFilter  // Filter by competition status
}

interface DepletionFilterSidebarProps {
  filters: DepletionFilterState
  onFiltersChange: (filters: DepletionFilterState) => void
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

const DEFAULT_DEPLETION_FILTERS: DepletionFilterState = {
  selectedUrgency: new Set(["critical", "warning", "ok", "none"]),
  selectedCategories: new Set([
    "Module", "Ship", "Charge", "Booster",
    "Drone", "Fighter", "Implant", "Deployable", "Subsystem"
  ]),
  hideOwnedItems: false,
  competitionFilter: 'all',
}

export function DepletionFilterSidebar({
  filters,
  onFiltersChange,
  totalItems,
  filteredCount,
}: DepletionFilterSidebarProps) {
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

  const handleHideOwnedChange = (checked: boolean) => {
    onFiltersChange({ ...filters, hideOwnedItems: checked })
  }

  const handleCompetitionChange = (value: CompetitionFilter) => {
    onFiltersChange({ ...filters, competitionFilter: value })
  }

  const handleReset = () => {
    onFiltersChange({
      selectedUrgency: new Set(DEFAULT_DEPLETION_FILTERS.selectedUrgency),
      selectedCategories: new Set(DEFAULT_DEPLETION_FILTERS.selectedCategories),
      hideOwnedItems: DEFAULT_DEPLETION_FILTERS.hideOwnedItems,
      competitionFilter: DEFAULT_DEPLETION_FILTERS.competitionFilter,
    })
  }

  const hasActiveFilters =
    filters.selectedUrgency.size !== DEFAULT_DEPLETION_FILTERS.selectedUrgency.size ||
    filters.selectedCategories.size !== DEFAULT_DEPLETION_FILTERS.selectedCategories.size ||
    filters.hideOwnedItems !== DEFAULT_DEPLETION_FILTERS.hideOwnedItems ||
    filters.competitionFilter !== DEFAULT_DEPLETION_FILTERS.competitionFilter

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
        {/* Hide Owned Items Toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="hide-owned-items"
            checked={filters.hideOwnedItems}
            onCheckedChange={(checked) => handleHideOwnedChange(checked === true)}
          />
          <Label
            htmlFor="hide-owned-items"
            className="text-sm cursor-pointer leading-none"
          >
            Hide owned items
          </Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-4">
          Items in your 3T7 inventory or with active sell orders
        </p>

        {/* Competition Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Competition</Label>
          <Select
            value={filters.competitionFilter}
            onValueChange={(v) => handleCompetitionChange(v as CompetitionFilter)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="no_competition">No Competition</SelectItem>
              <SelectItem value="with_competition">With Competition</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            No competition = you&apos;re the only seller
          </p>
        </div>

        {/* Urgency Level Filters */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Urgency Level</Label>
          <div className="space-y-2">
            {URGENCY_LEVELS.map((urgency) => (
              <div key={urgency.id} className="flex items-center gap-3">
                <Checkbox
                  id={`urgency-${urgency.id}`}
                  checked={filters.selectedUrgency.has(urgency.id)}
                  onCheckedChange={(checked) =>
                    handleUrgencyChange(urgency.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`urgency-${urgency.id}`}
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
                  id={`depletion-category-${category.id}`}
                  checked={filters.selectedCategories.has(category.id)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`depletion-category-${category.id}`}
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

export { DEFAULT_DEPLETION_FILTERS }

