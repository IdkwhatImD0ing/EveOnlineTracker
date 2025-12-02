"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, ArrowUp, ArrowDown, Package } from "lucide-react"

interface OreItem {
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
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

interface CompressedOresProps {
  ores: OreItem[]
}

export function CompressedOres({ ores }: CompressedOresProps) {
  const [copied, setCopied] = useState(false)
  const [sortField, setSortField] = useState<SortField>("total")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const sortedOres = useMemo(() => {
    return [...ores].sort((a, b) => {
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
  }, [ores, sortField, sortDirection])

  const totals = useMemo(() => {
    return ores.reduce(
      (acc, ore) => ({
        sellTotal: acc.sellTotal + ore.totalSellPrice,
        volumeTotal: acc.volumeTotal + ore.volume,
      }),
      { sellTotal: 0, volumeTotal: 0 }
    )
  }, [ores])

  const handleCopy = async () => {
    const text = ores.map((ore) => `${ore.name} ${ore.quantity}`).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (ores.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-amber-500" />
            <div>
              <CardTitle className="text-amber-500">Compressed Ore Purchase</CardTitle>
              <p className="text-sm text-muted-foreground">
                {ores.length} ore types to buy and reprocess
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Total Cost: <span className="font-mono font-semibold text-amber-500">{formatISK(totals.sellTotal)}</span></div>
              <div className="text-muted-foreground">Volume: <span className="font-mono">{formatVolume(totals.volumeTotal)}</span></div>
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
                  Copy
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
                label="Ore"
                field="name"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
            </div>
            <div className="text-right shrink-0 w-28">
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

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {sortedOres.map((ore) => (
              <div
                key={ore.name}
                className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ore.name}
                  </p>
                </div>
                <div className="text-right shrink-0 w-28">
                  <p className="text-sm font-mono tabular-nums">{formatNumber(ore.quantity)}</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-sm font-mono tabular-nums text-muted-foreground">
                    {formatVolume(ore.volume)}
                  </p>
                </div>
                <div className="text-right shrink-0 w-28">
                  <p className="text-sm font-mono tabular-nums text-amber-500">
                    {formatISK(ore.totalSellPrice)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

