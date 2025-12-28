"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EveItemIcon } from "@/components/eve-item-icon"
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  Check,
  Minus,
  Trash2,
} from "lucide-react"
import { formatIskShort } from "../utils"
import { type UrgencyLevel, type StockItemData } from "./stock-item-card"

export type StockSortColumn = "name" | "stock" | "dailySales" | "daysLeft" | "profit" | "urgency"
export type SortDirection = "asc" | "desc"

interface StockTableProps {
  items: StockItemData[]
  onRemoveItem?: (typeId: number) => void
  showRemoveButton?: boolean
  showPriorityScore?: boolean
  // Selection props
  selectedItems?: Set<number>
  onToggleSelect?: (typeId: number) => void
  onSelectAll?: (items: StockItemData[]) => void
}

const ITEMS_PER_PAGE = 50

interface SortableHeaderProps {
  label: string
  column: StockSortColumn
  currentColumn: StockSortColumn
  direction: SortDirection
  onSort: (column: StockSortColumn) => void
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

function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  switch (urgency) {
    case 'critical':
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <AlertTriangle className="size-3" />
          Critical
        </Badge>
      )
    case 'warning':
      return (
        <Badge className="gap-1 text-xs bg-amber-500/20 text-amber-600 hover:bg-amber-500/30">
          <Clock className="size-3" />
          Low
        </Badge>
      )
    case 'ok':
      return (
        <Badge variant="secondary" className="gap-1 text-xs bg-emerald-500/20 text-emerald-600">
          <Check className="size-3" />
          OK
        </Badge>
      )
    case 'none':
    default:
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Minus className="size-3" />
          N/A
        </Badge>
      )
  }
}

function getUrgencyOrder(urgency: UrgencyLevel): number {
  switch (urgency) {
    case 'critical': return 0
    case 'warning': return 1
    case 'ok': return 2
    case 'none': return 3
    default: return 4
  }
}

function getRowBgClass(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return "bg-destructive/5"
    case 'warning':
      return "bg-amber-500/5"
    case 'ok':
      return "bg-emerald-500/5"
    default:
      return ""
  }
}

function getDaysTextClass(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return 'text-destructive font-bold'
    case 'warning':
      return 'text-amber-500 font-bold'
    case 'ok':
      return 'text-emerald-500'
    default:
      return 'text-muted-foreground'
  }
}

function ExpandedRowDetails({ item }: { item: StockItemData }) {
  return (
    <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Category</p>
          <p className="font-medium">{item.categoryName || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Group</p>
          <p className="font-medium truncate">{item.groupName || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Current Stock</p>
          <p className="font-medium">{item.stock.toLocaleString()} units</p>
        </div>
        <div>
          <p className="text-muted-foreground">Daily Profit</p>
          <p className="font-medium text-primary">{formatIskShort(item.dailyProfit)} ISK</p>
        </div>
        {item.priorityScore !== undefined && (
          <div>
            <p className="text-muted-foreground">Priority Score</p>
            <p className="font-medium">{item.priorityScore.toFixed(0)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function StockTable({
  items,
  onRemoveItem,
  showRemoveButton = false,
  showPriorityScore = false,
  selectedItems,
  onToggleSelect,
  onSelectAll,
}: StockTableProps) {
  const selectionEnabled = selectedItems !== undefined && onToggleSelect !== undefined
  const [sortColumn, setSortColumn] = useState<StockSortColumn>("daysLeft")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
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
        case "stock":
          comparison = a.stock - b.stock
          break
        case "dailySales":
          comparison = a.estimatedDailySales - b.estimatedDailySales
          break
        case "daysLeft":
          // Handle null values - null goes to end
          if (a.daysUntilStockout === null && b.daysUntilStockout === null) comparison = 0
          else if (a.daysUntilStockout === null) comparison = 1
          else if (b.daysUntilStockout === null) comparison = -1
          else comparison = a.daysUntilStockout - b.daysUntilStockout
          break
        case "profit":
          comparison = a.dailyProfit - b.dailyProfit
          break
        case "urgency":
          comparison = getUrgencyOrder(a.urgencyLevel) - getUrgencyOrder(b.urgencyLevel)
          break
      }

      return sortDirection === "desc" ? -comparison : comparison
    })

    return sorted
  }, [items, sortColumn, sortDirection])

  // Paginate - use adjusted page that's always valid
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE)
  const adjustedPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1
  const paginatedItems = useMemo(() => {
    const start = (adjustedPage - 1) * ITEMS_PER_PAGE
    return sortedItems.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedItems, adjustedPage])

  const handleSort = (column: StockSortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSortColumn(column)
      // Default to asc for daysLeft (show urgent first), desc for profit
      setSortDirection(column === "daysLeft" ? "asc" : "desc")
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

  // Check if all visible items on current page are selected
  const allSelected = selectionEnabled && paginatedItems.length > 0 && 
    paginatedItems.every((item) => selectedItems.has(item.typeId))

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No items match the current filters
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table - with horizontal scroll on mobile */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {/* Header */}
          <div className={`bg-muted/50 px-3 md:px-4 py-2.5 md:py-3 grid ${selectionEnabled ? 'grid-cols-[auto_minmax(140px,1fr)_auto_auto_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto]' : 'grid-cols-[minmax(140px,1fr)_auto_auto_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto_auto_auto]'} gap-2 md:gap-4 items-center text-xs md:text-sm border-b min-w-[600px] md:min-w-0`}>
            {/* Select All Checkbox */}
            {selectionEnabled && onSelectAll && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectAll(paginatedItems)
                }}
              >
                <Checkbox checked={allSelected} aria-label="Select all" />
              </div>
            )}
            <SortableHeader
              label="Item"
              column="name"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Stock"
              column="stock"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="w-16 md:w-20 justify-end"
            />
            <SortableHeader
              label="Sales/Day"
              column="dailySales"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="w-16 md:w-20 justify-end"
            />
            <SortableHeader
              label="Days Left"
              column="daysLeft"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="w-16 md:w-24 justify-end"
            />
            <SortableHeader
              label="Profit/Day"
              column="profit"
              currentColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="w-16 md:w-24 justify-end"
            />
            <div className="w-16 md:w-20 flex justify-center">
              <SortableHeader
                label="Status"
                column="urgency"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
            </div>
            {showRemoveButton && <div className="w-8" />}
          </div>

          {/* Rows */}
          <div className="divide-y">
            {paginatedItems.map((item) => {
              const isExpanded = expandedRows.has(item.typeId)
              const isSelected = selectionEnabled && selectedItems.has(item.typeId)

              return (
                <div key={item.typeId} className={getRowBgClass(item.urgencyLevel)}>
                  <div
                    className={`px-3 md:px-4 py-2.5 md:py-3 grid ${selectionEnabled ? 'grid-cols-[auto_minmax(140px,1fr)_auto_auto_auto_auto_auto] md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto]' : 'grid-cols-[minmax(140px,1fr)_auto_auto_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto_auto_auto]'} gap-2 md:gap-4 items-center text-xs md:text-sm cursor-pointer hover:bg-muted/30 transition-colors min-w-[600px] md:min-w-0`}
                    onClick={() => toggleRowExpand(item.typeId)}
                  >
                    {/* Row Checkbox */}
                    {selectionEnabled && onToggleSelect && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleSelect(item.typeId)
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </div>
                    )}
                    {/* Item */}
                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                      <EveItemIcon
                        typeId={item.typeId}
                        size={32}
                        className="size-5 md:size-6 shrink-0 rounded"
                      />
                      <span className="truncate font-medium text-xs md:text-sm">{item.name}</span>
                      {showPriorityScore && item.priorityScore !== undefined && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                          P:{item.priorityScore.toFixed(0)}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Stock */}
                    <div className="w-16 md:w-20 text-right text-xs md:text-sm">
                      {item.stock.toLocaleString()}
                    </div>
                    
                    {/* Daily Sales */}
                    <div className="w-16 md:w-20 text-right text-xs md:text-sm">
                      {item.estimatedDailySales.toFixed(1)}
                    </div>
                    
                    {/* Days Left */}
                    <div className={`w-16 md:w-24 text-right text-xs md:text-sm ${getDaysTextClass(item.urgencyLevel)}`}>
                      {item.daysUntilStockout !== null
                        ? `${item.daysUntilStockout.toFixed(1)}d`
                        : '—'}
                    </div>
                    
                    {/* Profit/Day */}
                    <div className="w-16 md:w-24 text-right text-xs md:text-sm text-primary">
                      {formatIskShort(item.dailyProfit)}
                    </div>
                    
                    {/* Status */}
                    <div className="w-16 md:w-20 flex justify-center">
                      <UrgencyBadge urgency={item.urgencyLevel} />
                    </div>
                    
                    {/* Remove button */}
                    {showRemoveButton && onRemoveItem && (
                      <div className="w-8 flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveItem(item.typeId)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isExpanded && <ExpandedRowDetails item={item} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs md:text-sm text-muted-foreground">
            {(adjustedPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(adjustedPage * ITEMS_PER_PAGE, sortedItems.length)} of{" "}
            {sortedItems.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(1)}
              disabled={adjustedPage === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={adjustedPage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-2 md:px-3 text-xs md:text-sm">
              {adjustedPage}/{totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={adjustedPage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={adjustedPage === totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

