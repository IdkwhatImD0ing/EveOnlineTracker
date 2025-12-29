"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Copy, Check } from "lucide-react"

interface RestockCopyDropdownProps {
  /** Number of critical (0 stock) items */
  criticalCount: number
  /** Number of warning (<3 days) items */
  warningCount: number
  /** Include critical items in copy */
  includeCritical: boolean
  /** Callback to toggle critical inclusion */
  setIncludeCritical: (include: boolean) => void
  /** Include warning items in copy */
  includeWarning: boolean
  /** Callback to toggle warning inclusion */
  setIncludeWarning: (include: boolean) => void
  /** Days of supply to order */
  restockDays: number
  /** Callback to set days of supply */
  setRestockDays: (days: number) => void
  /** Limit to top N items (null = all) */
  restockTopN: number | null
  /** Callback to set top N limit */
  setRestockTopN: (n: number | null) => void
  /** Total items to restock based on current filters */
  itemsToRestockCount: number
  /** Items that will be copied based on all filters */
  itemsToCopyCount: number
  /** Whether copy was successful (shows checkmark) */
  copySuccess: boolean
  /** Callback when copy button is clicked */
  onCopy: () => void
  /** Button variant (default or outline) */
  variant?: "default" | "outline"
  /** Optional unique ID prefix for checkbox IDs (for multiple dropdowns on same page) */
  idPrefix?: string
}

/**
 * Dropdown menu for configuring and copying restock lists
 * Used by Watchlist, Essentials, and Depletion tabs
 */
export function RestockCopyDropdown({
  criticalCount,
  warningCount,
  includeCritical,
  setIncludeCritical,
  includeWarning,
  setIncludeWarning,
  restockDays,
  setRestockDays,
  restockTopN,
  setRestockTopN,
  itemsToRestockCount,
  itemsToCopyCount,
  copySuccess,
  onCopy,
  variant = "default",
  idPrefix = "restock",
}: RestockCopyDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm">
          <Copy className="size-4" />
          <span className="ml-2">Copy Restock List</span>
          <ChevronDown className="size-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Include filters */}
        <div className="p-2 space-y-2">
          <Label className="text-xs text-muted-foreground">Include urgency levels</Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`${idPrefix}-includeCritical`}
              checked={includeCritical}
              onCheckedChange={(checked) => setIncludeCritical(checked === true)}
            />
            <label
              htmlFor={`${idPrefix}-includeCritical`}
              className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
            >
              <span className="text-destructive">Critical</span>
              <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                {criticalCount}
              </Badge>
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`${idPrefix}-includeWarning`}
              checked={includeWarning}
              onCheckedChange={(checked) => setIncludeWarning(checked === true)}
            />
            <label
              htmlFor={`${idPrefix}-includeWarning`}
              className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
            >
              <span className="text-amber-500">Warning</span>
              <Badge className="px-1.5 py-0 text-xs bg-amber-500/20 text-amber-600">
                {warningCount}
              </Badge>
            </label>
          </div>
        </div>
        <DropdownMenuSeparator />
        {/* Days of supply */}
        <div className="p-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Days of supply</Label>
          <Select
            value={restockDays.toString()}
            onValueChange={(v) => setRestockDays(parseInt(v))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days (1 week)</SelectItem>
              <SelectItem value="14">14 days (2 weeks)</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Top N items */}
        <div className="p-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Limit items</Label>
          <Select
            value={restockTopN?.toString() ?? "all"}
            onValueChange={(v) => setRestockTopN(v === "all" ? null : parseInt(v))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All matched ({itemsToRestockCount})</SelectItem>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DropdownMenuSeparator />
        {/* Copy button with count */}
        <div className="p-2">
          <Button
            onClick={onCopy}
            className="w-full"
            disabled={copySuccess || itemsToCopyCount === 0}
          >
            {copySuccess ? (
              <>
                <Check className="size-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4 mr-2" />
                Copy {itemsToCopyCount} items
              </>
            )}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

