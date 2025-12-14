"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { EveItemIcon } from "@/components/eve-item-icon"
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"

export interface ProfitAnalysis {
  typeId: number
  name: string
  categoryName: string
  groupName: string
  volumePerUnit: number
  jitaSellPrice: number
  jitaSellPriceFormatted: string
  transportCostPerUnit: number
  transportCostFormatted: string
  totalCostPerUnit: number
  totalCostFormatted: string
  hasCompetition: boolean
  competitorLowestPrice: number | null
  competitorLowestPriceFormatted: string | null
  targetSellPrice: number
  targetSellPriceFormatted: string
  profitPerUnit: number
  profitPerUnitFormatted: string
  profitMarginPct: number
  profitMarginPctFormatted: string
  profitPerM3: number
  profitPerM3Formatted: string
  iskPerDay: number
  iskPerDayFormatted: string
  avgDailyVolume: number
  totalVolume30d: number
  trendDirection: "up" | "down" | "stable"
  compositeScore: number
  compositeScoreFormatted: string
}

export type SortColumn =
  | "name"
  | "score"
  | "margin"
  | "profit"
  | "iskPerDay"
  | "competition"
  | "volume"

export type SortDirection = "asc" | "desc"

interface ResultsTableProps {
  items: ProfitAnalysis[]
  selectedItems: Set<number>
  onToggleSelect: (typeId: number) => void
  onSelectAll: (items: ProfitAnalysis[]) => void
  supplyDays: number
}

const ITEMS_PER_PAGE = 50

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up")
    return <TrendingUp className="size-4 text-emerald-500" />
  if (direction === "down") return <TrendingDown className="size-4 text-red-500" />
  return <Minus className="size-4 text-muted-foreground" />
}

interface SortableHeaderProps {
  label: string
  column: SortColumn
  currentColumn: SortColumn
  direction: SortDirection
  onSort: (column: SortColumn) => void
  className?: string
}

function SortableHeader({
  label,
  column,
  currentColumn,
  direction,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = column === currentColumn

  return (
    <button
      onClick={() => onSort(column)}
      className={`flex items-center gap-1 text-left font-medium hover:text-foreground transition-colors ${
        isActive ? "text-primary" : "text-muted-foreground"
      } ${className}`}
    >
      {label}
      {isActive ? (
        direction === "desc" ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronUp className="size-4" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-50" />
      )}
    </button>
  )
}

function ExpandedRowDetails({
  item,
  supplyDays,
}: {
  item: ProfitAnalysis
  supplyDays: number
}) {
  return (
    <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Jita Price</p>
          <p className="font-medium">{item.jitaSellPriceFormatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Transport</p>
          <p className="font-medium">{item.transportCostFormatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Target Price</p>
          <p className="font-medium">{item.targetSellPriceFormatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Profit/m³</p>
          <p className="font-medium">{item.profitPerM3Formatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Volume</p>
          <p className="font-medium">{item.volumePerUnit} m³</p>
        </div>
        <div>
          <p className="text-muted-foreground">Vale Daily Vol</p>
          <p className="font-medium">
            {Math.round(item.avgDailyVolume).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{supplyDays}d Supply (5%)</p>
          <p className="font-medium text-primary">
            {Math.ceil(item.avgDailyVolume * 0.05 * supplyDays).toLocaleString()}{" "}
            units
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Category</p>
          <p className="font-medium">{item.categoryName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Group</p>
          <p className="font-medium truncate">{item.groupName}</p>
        </div>
        {item.competitorLowestPriceFormatted && (
          <div>
            <p className="text-muted-foreground">Competitor Price</p>
            <p className="font-medium">{item.competitorLowestPriceFormatted}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResultsTable({
  items,
  selectedItems,
  onToggleSelect,
  onSelectAll,
  supplyDays,
}: ResultsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("score")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "score":
          comparison = a.compositeScore - b.compositeScore
          break
        case "margin":
          comparison = a.profitMarginPct - b.profitMarginPct
          break
        case "profit":
          comparison = a.profitPerUnit - b.profitPerUnit
          break
        case "iskPerDay":
          comparison = a.iskPerDay - b.iskPerDay
          break
        case "competition":
          comparison = (a.hasCompetition ? 1 : 0) - (b.hasCompetition ? 1 : 0)
          break
        case "volume":
          comparison = a.avgDailyVolume - b.avgDailyVolume
          break
      }

      return sortDirection === "desc" ? -comparison : comparison
    })

    return sorted
  }, [items, sortColumn, sortDirection])

  // Paginate
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedItems.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedItems, currentPage])

  // Reset page when items change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
    setCurrentPage(1)
  }

  const toggleRowExpand = (typeId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) {
        next.delete(typeId)
      } else {
        next.add(typeId)
      }
      return next
    })
  }

  const allSelected = paginatedItems.every((item) =>
    selectedItems.has(item.typeId)
  )

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No items match the current filters
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 px-4 py-3 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center text-sm border-b">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => onSelectAll(paginatedItems)}
            aria-label="Select all"
          />
          <SortableHeader
            label="Name"
            column="name"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
          />
          <SortableHeader
            label="Score"
            column="score"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-20 justify-end"
          />
          <SortableHeader
            label="Margin"
            column="margin"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-20 justify-end"
          />
          <SortableHeader
            label="Profit/Unit"
            column="profit"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-24 justify-end"
          />
          <SortableHeader
            label="ISK/Day"
            column="iskPerDay"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-24 justify-end"
          />
          <SortableHeader
            label="Competition"
            column="competition"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-28 justify-center"
          />
          <SortableHeader
            label="Vol/Day"
            column="volume"
            currentColumn={sortColumn}
            direction={sortDirection}
            onSort={handleSort}
            className="w-20 justify-end"
          />
        </div>

        {/* Rows */}
        <div className="divide-y">
          {paginatedItems.map((item) => {
            const isExpanded = expandedRows.has(item.typeId)
            const isSelected = selectedItems.has(item.typeId)

            return (
              <div
                key={item.typeId}
                className={`${
                  !item.hasCompetition ? "bg-emerald-500/5" : ""
                } ${isSelected ? "bg-primary/5" : ""}`}
              >
                <div
                  className="px-4 py-3 grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center text-sm cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleRowExpand(item.typeId)}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSelect(item.typeId)
                    }}
                  >
                    <Checkbox checked={isSelected} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <EveItemIcon
                      typeId={item.typeId}
                      size={32}
                      className="size-6 shrink-0 rounded"
                    />
                    <span className="truncate font-medium">{item.name}</span>
                    <TrendIcon direction={item.trendDirection} />
                  </div>
                  <div className="w-20 text-right font-bold text-primary">
                    {item.compositeScoreFormatted}
                  </div>
                  <div className="w-20 text-right text-emerald-500 font-medium">
                    +{item.profitMarginPctFormatted}
                  </div>
                  <div className="w-24 text-right">
                    {item.profitPerUnitFormatted}
                  </div>
                  <div className="w-24 text-right">{item.iskPerDayFormatted}</div>
                  <div className="w-28 flex justify-center">
                    <Badge variant={item.hasCompetition ? "secondary" : "default"}>
                      {item.hasCompetition ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="w-20 text-right text-muted-foreground">
                    {(item.avgDailyVolume * 0.05).toFixed(1)}
                  </div>
                </div>
                {isExpanded && (
                  <ExpandedRowDetails item={item} supplyDays={supplyDays} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, sortedItems.length)} of{" "}
            {sortedItems.length} items
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-3 text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

