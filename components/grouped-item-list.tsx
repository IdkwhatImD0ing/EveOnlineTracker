"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Copy, ChevronDown, Check, ChevronRight, ArrowUp, ArrowDown } from "lucide-react"
import type { RawMaterial } from "@/types/database"

// Category order for display
const CATEGORY_ORDER = ["Minerals", "Planetary Industry", "Reactions", "Exploration", "Other"]

type SortField = "name" | "quantity" | "volume" | "total"
type SortDirection = "asc" | "desc"

// Special exploration items that need to be overridden by name
const EXPLORATION_ITEMS = [
  "counter-subversion sensor array",
  "nanoscale filter plate",
  "nano regulation gate",
  "electro-neural signaller",
  "enhanced electro-neural signaller",
]

// Map SDE group names to our categories
function getCategoryFromType(itemType: string | null, itemName?: string): string {
  // Check for specific exploration items by name first
  if (itemName) {
    const name = itemName.toLowerCase()
    if (EXPLORATION_ITEMS.some(expItem => name.includes(expItem))) {
      return "Exploration"
    }
  }
  
  if (!itemType) return "Other"
  
  const type = itemType.toLowerCase()
  
  // Minerals
  if (type === "mineral") return "Minerals"
  
  // Planetary Industry - all commodity tiers
  if (type.includes("commodities")) return "Planetary Industry"
  
  // Exploration - sleeper components, advanced protective technology
  if (
    type.includes("sleeper") ||
    type.includes("ancient salvage") ||
    type.includes("advanced protective technology")
  ) return "Exploration"
  
  // Reactions - moon, fullerene, polymers, molecular, etc.
  if (
    type.includes("composite") ||
    type.includes("hybrid polymers") ||
    type.includes("molecular-forged") ||
    type.includes("intermediate materials") ||
    type.includes("biochemical") ||
    type.includes("moon materials")
  ) return "Reactions"
  
  return "Other"
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

function formatISK(amount: number | null): string {
  if (amount === null || amount === 0) return "—"
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B ISK`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M ISK`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K ISK`
  }
  return `${amount.toFixed(2)} ISK`
}

function formatVolume(volume: number | null): string {
  if (volume === null || volume === 0) return "—"
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B m³`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M m³`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K m³`
  }
  return `${volume.toFixed(2)} m³`
}

function getItemTotal(item: RawMaterial): number {
  if (item.buy_price == null) return 0
  return item.buy_price * item.quantity
}

interface SortHeaderProps {
  label: string
  field: SortField
  currentField: SortField
  direction: SortDirection
  onSort: (field: SortField) => void
  className?: string
}

function SortHeader({ label, field, currentField, direction, onSort, className = "" }: SortHeaderProps) {
  const isActive = currentField === field
  
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors hover:text-foreground ${
        isActive ? "text-foreground" : "text-muted-foreground"
      } ${className}`}
    >
      {label}
      {isActive && (
        direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
      )}
    </button>
  )
}

interface GroupedItemListProps {
  title: string
  items: RawMaterial[]
  projectId: string
  onItemUpdate: (itemId: string, collected: boolean) => void
}

interface CategoryGroupProps {
  category: string
  items: RawMaterial[]
  projectId: string
  onItemUpdate: (itemId: string, collected: boolean) => void
}

function CategoryGroup({ category, items, projectId, onItemUpdate }: CategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const collectedCount = items.filter((item) => item.collected).length
  const totalCount = items.length

  // Calculate totals for this category
  const totals = useMemo(() => {
    let buyTotal = 0
    let sellTotal = 0
    let volumeTotal = 0

    items.forEach((item) => {
      if (item.buy_price != null) buyTotal += item.buy_price * item.quantity
      if (item.sell_price != null) sellTotal += item.sell_price * item.quantity
      if (item.volume != null) volumeTotal += item.volume * item.quantity
    })

    return { buyTotal, sellTotal, volumeTotal }
  }, [items])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleCopy = async (mode: "all" | "remaining") => {
    const itemsToCopy = mode === "all"
      ? items
      : items.filter((item) => !item.collected)

    const text = itemsToCopy
      .map((item) => `${item.item_name} ${item.quantity}`)
      .join("\n")

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = async (item: RawMaterial) => {
    const newCollected = !item.collected

    try {
      const response = await fetch(
        `/api/projects/${projectId}/items/${item.id}?type=raw`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collected: newCollected }),
        }
      )

      if (response.ok) {
        onItemUpdate(item.id, newCollected)
      }
    } catch (err) {
      console.error("Failed to update item:", err)
    }
  }

  // Sort items based on current sort field and direction
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case "name":
          comparison = a.item_name.localeCompare(b.item_name)
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "volume":
          const volA = (a.volume ?? 0) * a.quantity
          const volB = (b.volume ?? 0) * b.quantity
          comparison = volA - volB
          break
        case "total":
          comparison = getItemTotal(a) - getItemTotal(b)
          break
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return sorted
  }, [items, sortField, sortDirection])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
          <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          <span className="font-semibold">{category}</span>
          <span className="text-sm text-muted-foreground">
            ({collectedCount}/{totalCount})
          </span>
        </CollapsibleTrigger>
        
        <div className="flex items-center gap-4">
          {/* Category Totals */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-muted-foreground">Vol: </span>
              <span className="font-mono">{formatVolume(totals.volumeTotal)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Buy: </span>
              <span className="font-mono">{formatISK(totals.buyTotal)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Sell: </span>
              <span className="font-mono">{formatISK(totals.sellTotal)}</span>
            </div>
          </div>

          {/* Copy Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {copied ? (
                  <>
                    <Check className="size-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy
                    <ChevronDown className="size-3" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCopy("all")}>
                Copy All ({totalCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopy("remaining")}>
                Copy Remaining ({totalCount - collectedCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CollapsibleContent>
        {/* Mobile Totals */}
        <div className="sm:hidden px-4 py-2 bg-muted/20 border-t text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Volume:</span>
            <span className="font-mono">{formatVolume(totals.volumeTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buy:</span>
            <span className="font-mono">{formatISK(totals.buyTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sell:</span>
            <span className="font-mono">{formatISK(totals.sellTotal)}</span>
          </div>
        </div>

        {/* Column Headers - Sortable */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-b border-border/50">
          <div className="w-4" />
          <div className="flex-1 min-w-0">
            <SortHeader
              label="Name"
              field="name"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
          <div className="text-right shrink-0 w-24">
            <SortHeader
              label="Qty"
              field="quantity"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              className="justify-end"
            />
          </div>
          <div className="text-right shrink-0 w-24">
            <SortHeader
              label="Vol"
              field="volume"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              className="justify-end"
            />
          </div>
          <div className="text-right shrink-0 w-28">
            <SortHeader
              label="Total"
              field="total"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              className="justify-end"
            />
          </div>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-border/30">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50 ${
                item.collected ? "opacity-60" : ""
              }`}
            >
              <Checkbox
                checked={item.collected}
                onCheckedChange={() => handleToggle(item)}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${item.collected ? "line-through" : ""}`}>
                  {item.item_name}
                </p>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-mono tabular-nums">{formatNumber(item.quantity)}</p>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-mono tabular-nums text-muted-foreground">
                  {item.volume != null
                    ? formatVolume(item.volume * item.quantity)
                    : "—"}
                </p>
              </div>
              <div className="text-right shrink-0 w-28">
                <p className="text-sm font-mono tabular-nums text-muted-foreground">
                  {item.buy_price != null && item.buy_price > 0
                    ? formatISK(item.buy_price * item.quantity)
                    : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function GroupedItemList({ title, items, projectId, onItemUpdate }: GroupedItemListProps) {
  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, RawMaterial[]> = {}
    
    items.forEach((item) => {
      const category = getCategoryFromType(item.item_type, item.item_name)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    })

    // Sort categories by predefined order
    const sortedGroups = CATEGORY_ORDER
      .filter((cat) => groups[cat] && groups[cat].length > 0)
      .map((cat) => ({ category: cat, items: groups[cat] }))

    return sortedGroups
  }, [items])

  const collectedCount = items.filter((item) => item.collected).length
  const totalCount = items.length

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No items in this list</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {collectedCount} / {totalCount} collected
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groupedItems.map(({ category, items: categoryItems }) => (
          <CategoryGroup
            key={category}
            category={category}
            items={categoryItems}
            projectId={projectId}
            onItemUpdate={onItemUpdate}
          />
        ))}
      </CardContent>
    </Card>
  )
}
