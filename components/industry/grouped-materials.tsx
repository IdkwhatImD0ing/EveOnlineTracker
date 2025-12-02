"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Copy, Check, ChevronRight, ArrowUp, ArrowDown } from "lucide-react"

// Category order for display - same as projects page
const CATEGORY_ORDER = ["Minerals", "Planetary Industry", "Reactions", "Exploration", "Other"]

// Special exploration items that need to be overridden by name - same as projects page
const EXPLORATION_ITEMS = [
  "counter-subversion sensor array",
  "nanoscale filter plate",
  "nano regulation gate",
  "electro-neural signaller",
  "enhanced electro-neural signaller",
]

// Map SDE group names to our categories - same logic as projects page
function getCategoryFromType(itemType: string | null | undefined, itemName?: string): string {
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

interface Material {
  typeId: number
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
  groupName?: string
}

type SortField = "name" | "quantity" | "volume" | "total"
type SortDirection = "asc" | "desc"

function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

function formatISK(amount: number): string {
  if (amount === 0) return "—"
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

function formatVolume(volume: number): string {
  if (volume === 0) return "—"
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M m³`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K m³`
  }
  return `${volume.toFixed(2)} m³`
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

interface CategoryGroupProps {
  category: string
  materials: Material[]
}

function CategoryGroup({ category, materials }: CategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const totalCount = materials.length

  // Calculate totals for this category
  const totals = useMemo(() => {
    let sellTotal = 0
    let volumeTotal = 0

    materials.forEach((m) => {
      sellTotal += m.totalSellPrice
      volumeTotal += m.volume
    })

    return { sellTotal, volumeTotal }
  }, [materials])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleCopy = async () => {
    const text = materials
      .map((m) => `${m.name} ${m.quantity}`)
      .join("\n")

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Sort materials based on current sort field and direction
  const sortedMaterials = useMemo(() => {
    const sorted = [...materials].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "volume":
          comparison = a.volume - b.volume
          break
        case "total":
          comparison = a.totalSellPrice - b.totalSellPrice
          break
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return sorted
  }, [materials, sortField, sortDirection])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
            <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            <span className="font-semibold">{category}</span>
            <span className="text-sm text-muted-foreground">
              ({totalCount} items)
            </span>
          </CollapsibleTrigger>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Category Totals */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-muted-foreground">Vol: </span>
              <span className="font-mono">{formatVolume(totals.volumeTotal)}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Sell: </span>
              <span className="font-mono">{formatISK(totals.sellTotal)}</span>
            </div>
          </div>

          {/* Copy Button */}
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="size-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </Button>
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
            <span className="text-muted-foreground">Sell:</span>
            <span className="font-mono">{formatISK(totals.sellTotal)}</span>
          </div>
        </div>

        {/* Column Headers - Sortable */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-b border-border/50">
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

        {/* Material Rows */}
        <div className="divide-y divide-border/30">
          {sortedMaterials.map((material) => (
            <div
              key={material.typeId}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {material.name}
                </p>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-mono tabular-nums">{formatNumber(material.quantity)}</p>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-mono tabular-nums text-muted-foreground">
                  {formatVolume(material.volume)}
                </p>
              </div>
              <div className="text-right shrink-0 w-28">
                <p className="text-sm font-mono tabular-nums text-muted-foreground">
                  {formatISK(material.totalSellPrice)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface GroupedMaterialsProps {
  title: string
  materials: Material[]
}

export function GroupedMaterials({ title, materials }: GroupedMaterialsProps) {
  // Group materials by category
  const groupedMaterials = useMemo(() => {
    const groups: Record<string, Material[]> = {}
    
    materials.forEach((material) => {
      const category = getCategoryFromType(material.groupName, material.name)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(material)
    })

    // Sort categories by predefined order
    const sortedGroups = CATEGORY_ORDER
      .filter((cat) => groups[cat] && groups[cat].length > 0)
      .map((cat) => ({ category: cat, materials: groups[cat] }))

    return sortedGroups
  }, [materials])

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return materials.reduce(
      (acc, m) => ({
        sellTotal: acc.sellTotal + m.totalSellPrice,
        volumeTotal: acc.volumeTotal + m.volume,
      }),
      { sellTotal: 0, volumeTotal: 0 }
    )
  }, [materials])

  if (materials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No materials required</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {materials.length} items across {groupedMaterials.length} categories
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Total Sell: <span className="font-mono font-semibold text-foreground">{formatISK(grandTotals.sellTotal)}</span></div>
            <div className="text-muted-foreground">Volume: <span className="font-mono">{formatVolume(grandTotals.volumeTotal)}</span></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {groupedMaterials.map(({ category, materials: categoryMaterials }) => (
          <CategoryGroup
            key={category}
            category={category}
            materials={categoryMaterials}
          />
        ))}
      </CardContent>
    </Card>
  )
}

