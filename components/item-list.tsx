"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Copy, ChevronDown, Check, ArrowUp, ArrowDown, AlertCircle, X } from "lucide-react"
import type { RawMaterial, Component } from "@/types/database"

type Item = RawMaterial | Component
type SortField = "name" | "type" | "quantity" | "total"
type SortDirection = "asc" | "desc"

interface ItemListProps {
  title: string
  items: Item[]
  type: "raw" | "component"
  projectId: string
  onItemUpdate: (itemId: string, collected: boolean) => void
  onBulkUpdate?: (updates: Array<{ itemId: string; collected: boolean }>) => void
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

function formatISK(amount: number | null): string {
  if (amount === null || amount === 0) return "—"
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`
  }
  return amount.toFixed(2)
}

function getItemTotal(item: Item): number {
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

export function ItemList({ title, items, type, projectId, onItemUpdate, onBulkUpdate }: ItemListProps) {
  const [copied, setCopied] = useState(false)
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [error, setError] = useState<string | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set())

  // Check if any items have prices
  const hasPrices = useMemo(() => 
    items.some(item => item.buy_price != null && item.buy_price > 0),
    [items]
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case "name":
          comparison = a.item_name.localeCompare(b.item_name)
          break
        case "type":
          const typeA = a.item_type || ""
          const typeB = b.item_type || ""
          comparison = typeA.localeCompare(typeB)
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "total":
          comparison = getItemTotal(a) - getItemTotal(b)
          break
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })
    
    return sorted
  }, [items, sortField, sortDirection])

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

  const handleToggle = useCallback(async (item: Item) => {
    const newCollected = !item.collected
    
    // Clear any previous error
    setError(null)
    
    // Optimistic update - update UI immediately
    onItemUpdate(item.id, newCollected)
    setPendingUpdates(prev => new Set(prev).add(item.id))

    try {
      const response = await fetch(
        `/api/projects/${projectId}/items/${item.id}?type=${type}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collected: newCollected }),
        }
      )

      if (!response.ok) {
        // Revert on failure
        onItemUpdate(item.id, !newCollected)
        setError(`Failed to update "${item.item_name}"`)
      }
    } catch (err) {
      // Revert on failure
      onItemUpdate(item.id, !newCollected)
      setError(`Failed to update "${item.item_name}"`)
      console.error("Failed to update item:", err)
    } finally {
      setPendingUpdates(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [projectId, type, onItemUpdate])

  const handleCheckAll = useCallback(async () => {
    const allCollected = items.every(item => item.collected)
    const newCollected = !allCollected
    
    // Clear any previous error
    setError(null)
    
    // Get items that need to change
    const itemsToUpdate = items.filter(item => item.collected !== newCollected)
    if (itemsToUpdate.length === 0) return
    
    // Optimistic update - update UI immediately
    const updates = itemsToUpdate.map(item => ({ itemId: item.id, collected: newCollected }))
    if (onBulkUpdate) {
      onBulkUpdate(updates)
    } else {
      updates.forEach(({ itemId, collected }) => onItemUpdate(itemId, collected))
    }
    
    // Track pending updates
    const pendingIds = new Set(itemsToUpdate.map(item => item.id))
    setPendingUpdates(prev => new Set([...prev, ...pendingIds]))
    
    // Make API calls in parallel
    const results = await Promise.allSettled(
      itemsToUpdate.map(item =>
        fetch(`/api/projects/${projectId}/items/${item.id}?type=${type}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collected: newCollected }),
        }).then(res => ({ item, ok: res.ok }))
      )
    )
    
    // Check for failures and revert them
    const failures: Item[] = []
    results.forEach((result, index) => {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
        failures.push(itemsToUpdate[index])
      }
    })
    
    if (failures.length > 0) {
      // Revert failed items
      if (onBulkUpdate) {
        onBulkUpdate(failures.map(item => ({ itemId: item.id, collected: !newCollected })))
      } else {
        failures.forEach(item => onItemUpdate(item.id, !newCollected))
      }
      setError(`Failed to update ${failures.length} item(s)`)
    }
    
    // Clear pending state
    setPendingUpdates(prev => {
      const next = new Set(prev)
      pendingIds.forEach(id => next.delete(id))
      return next
    })
  }, [items, projectId, type, onItemUpdate, onBulkUpdate])

  const collectedCount = items.filter((item) => item.collected).length
  const totalCount = items.length
  const allChecked = totalCount > 0 && collectedCount === totalCount
  const someChecked = collectedCount > 0 && collectedCount < totalCount

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {collectedCount} / {totalCount} collected
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {copied ? (
                <>
                  <Check className="size-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy
                  <ChevronDown className="size-4" />
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
      </CardHeader>
      <CardContent>
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 hover:bg-transparent"
                onClick={() => setError(null)}
              >
                <X className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Column Headers */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 mb-2">
          <Checkbox
            checked={someChecked ? "indeterminate" : allChecked}
            onCheckedChange={handleCheckAll}
            disabled={pendingUpdates.size > 0}
            aria-label="Select all items"
          />
          <div className="flex-1 min-w-0">
            <SortHeader
              label="Name"
              field="name"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
          </div>
          <div className="shrink-0 w-44">
            <SortHeader
              label="Type"
              field="type"
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
          {hasPrices && (
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
          )}
        </div>

        {/* Item Rows */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 ${
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
              <div className="shrink-0 w-44">
                <p className="text-sm text-muted-foreground">
                  {item.item_type || "—"}
                </p>
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-mono">{formatNumber(item.quantity)}</p>
              </div>
              {hasPrices && (
                <div className="text-right shrink-0 w-28">
                  <p className="text-sm font-mono text-muted-foreground">
                    {formatISK(getItemTotal(item))}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
