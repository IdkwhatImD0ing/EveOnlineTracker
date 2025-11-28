"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Copy, ChevronDown, Check } from "lucide-react"
import type { RawMaterial, Component } from "@/types/database"

type Item = RawMaterial | Component

interface ItemListProps {
  title: string
  items: Item[]
  type: "raw" | "component"
  projectId: string
  onItemUpdate: (itemId: string, collected: boolean) => void
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

function formatISK(amount: number | null): string {
  if (amount === null) return "—"
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

export function ItemList({ title, items, type, projectId, onItemUpdate }: ItemListProps) {
  const [copied, setCopied] = useState(false)

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

  const handleToggle = async (item: Item) => {
    const newCollected = !item.collected
    
    try {
      const response = await fetch(
        `/api/projects/${projectId}/items/${item.id}?type=${type}`,
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
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {items.map((item) => (
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
              <div className="text-right shrink-0">
                <p className="text-sm font-mono">{formatNumber(item.quantity)}</p>
                {item.buy_price && (
                  <p className="text-xs text-muted-foreground">
                    {formatISK(item.buy_price * item.quantity)} ISK
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

