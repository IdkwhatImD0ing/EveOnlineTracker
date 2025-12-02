"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, ArrowUp, ArrowDown, ShoppingCart, Hammer } from "lucide-react"

interface ComponentItem {
  typeId: number
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
  groupName?: string
  buildCost?: number
  shouldBuy?: boolean
  savings?: number
}

type SortField = "name" | "quantity" | "volume" | "total" | "savings"
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

interface ComponentsListProps {
  title: string
  components: ComponentItem[]
  showBuyRecommendations?: boolean
  onToggleBuyRecommendations?: () => void
}

export function ComponentsList({ 
  title, 
  components, 
  showBuyRecommendations = false,
  onToggleBuyRecommendations 
}: ComponentsListProps) {
  const [copied, setCopied] = useState(false)
  const [sortField, setSortField] = useState<SortField>(showBuyRecommendations ? "savings" : "name")
  const [sortDirection, setSortDirection] = useState<SortDirection>(showBuyRecommendations ? "desc" : "asc")

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection(field === "savings" ? "desc" : "asc")
    }
  }

  const sortedComponents = useMemo(() => {
    return [...components].sort((a, b) => {
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
        case "savings":
          comparison = (a.savings || 0) - (b.savings || 0)
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [components, sortField, sortDirection])

  // Calculate totals and buy recommendations
  const stats = useMemo(() => {
    let sellTotal = 0
    let volumeTotal = 0
    let buildTotal = 0
    let buyRecommendations = 0
    let potentialSavings = 0

    components.forEach((c) => {
      sellTotal += c.totalSellPrice
      volumeTotal += c.volume
      buildTotal += c.buildCost || 0
      if (c.shouldBuy) {
        buyRecommendations++
        potentialSavings += c.savings || 0
      }
    })

    return { sellTotal, volumeTotal, buildTotal, buyRecommendations, potentialSavings }
  }, [components])

  const handleCopy = async () => {
    const text = components.map((c) => `${c.name} ${c.quantity}`).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (components.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {components.length} items
              {stats.buyRecommendations > 0 && !showBuyRecommendations && (
                <span className="ml-2 text-amber-500">
                  • {stats.buyRecommendations} cheaper to buy
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats.buyRecommendations > 0 && onToggleBuyRecommendations && (
              <Button
                variant={showBuyRecommendations ? "default" : "outline"}
                size="sm"
                onClick={onToggleBuyRecommendations}
                className="h-8"
              >
                {showBuyRecommendations ? (
                  <>
                    <ShoppingCart className="size-3.5 mr-1.5" />
                    Buy Mode
                  </>
                ) : (
                  <>
                    <Hammer className="size-3.5 mr-1.5" />
                    Build Mode
                  </>
                )}
              </Button>
            )}
            <div className="text-right text-sm">
              {showBuyRecommendations ? (
                <>
                  <div className="text-muted-foreground">
                    Potential Savings: <span className="font-mono font-semibold text-green-500">{formatISK(stats.potentialSavings)}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {stats.buyRecommendations} of {components.length} cheaper to buy
                  </div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground">Total Sell: <span className="font-mono font-semibold text-foreground">{formatISK(stats.sellTotal)}</span></div>
                  <div className="text-muted-foreground">Volume: <span className="font-mono">{formatVolume(stats.volumeTotal)}</span></div>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5 mr-1.5" />
                  Copy All
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-card">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
            <div className="flex-1 min-w-0">
              <SortHeader
                label="Item"
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
            {showBuyRecommendations ? (
              <>
                <div className="text-right shrink-0 w-28">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buy</span>
                </div>
                <div className="text-right shrink-0 w-28">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Build</span>
                </div>
                <div className="text-right shrink-0 w-28">
                  <SortHeader
                    label="Savings"
                    field="savings"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="justify-end"
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {sortedComponents.map((component) => (
              <div
                key={component.typeId}
                className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50 ${
                  showBuyRecommendations && component.shouldBuy ? 'bg-green-500/5' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {showBuyRecommendations && (
                      component.shouldBuy ? (
                        <ShoppingCart className="size-4 text-green-500 shrink-0" />
                      ) : (
                        <Hammer className="size-4 text-blue-500 shrink-0" />
                      )
                    )}
                    <p className="text-sm font-medium truncate">
                      {component.name}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-sm font-mono tabular-nums">{formatNumber(component.quantity)}</p>
                </div>
                {showBuyRecommendations ? (
                  <>
                    <div className="text-right shrink-0 w-28">
                      <p className={`text-sm font-mono tabular-nums ${component.shouldBuy ? 'text-green-500 font-semibold' : 'text-muted-foreground'}`}>
                        {formatISK(component.totalSellPrice)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <p className={`text-sm font-mono tabular-nums ${!component.shouldBuy ? 'text-blue-500 font-semibold' : 'text-muted-foreground'}`}>
                        {formatISK(component.buildCost || 0)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <p className={`text-sm font-mono tabular-nums ${component.shouldBuy ? 'text-green-500' : 'text-blue-500'}`}>
                        {component.savings ? formatISK(component.savings) : '—'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-right shrink-0 w-24">
                      <p className="text-sm font-mono tabular-nums text-muted-foreground">
                        {formatVolume(component.volume)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <p className="text-sm font-mono tabular-nums text-muted-foreground">
                        {formatISK(component.totalSellPrice)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
