"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { 
  ChevronRight, 
  ClipboardList, 
  Check, 
  X, 
  Loader2,
  CheckCircle2,
  AlertCircle 
} from "lucide-react"
import { EveItemIcon } from "@/components/eve-item-icon"
import type { RawMaterial } from "@/types/database"

interface ParsedInventoryItem {
  name: string
  quantity: number
}

interface MatchedItem {
  rawMaterial: RawMaterial
  inventoryQuantity: number
  isSufficient: boolean
}

interface InventoryImportProps {
  rawMaterials: RawMaterial[]
  projectId: string
  onItemsCollected: (itemIds: string[]) => void
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

/**
 * Parse Eve Online inventory export format
 * Format: Item Name\tQuantity\tCategory\t\t\tVolume\tValue
 * Example: "Graphene Nanoribbons\t51,032\tHybrid Polymers\t\t\t76,548 m3\t1,754,317,367.92 ISK"
 */
function parseInventory(text: string): ParsedInventoryItem[] {
  const lines = text.trim().split("\n")
  const items: ParsedInventoryItem[] = []

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = line.split("\t")
    if (parts.length < 2) continue

    const name = parts[0].trim()
    // Remove commas and parse quantity
    const quantityStr = parts[1].replace(/,/g, "").trim()
    const quantity = parseInt(quantityStr, 10)

    if (name && !isNaN(quantity) && quantity > 0) {
      items.push({ name, quantity })
    }
  }

  return items
}

export function InventoryImport({ rawMaterials, projectId, onItemsCollected }: InventoryImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inventoryText, setInventoryText] = useState("")
  const [isApplying, setIsApplying] = useState(false)

  // Parse inventory and match against raw materials
  const matchedItems = useMemo((): MatchedItem[] => {
    if (!inventoryText.trim()) return []

    const parsedItems = parseInventory(inventoryText)
    
    // Create a map of raw material names (lowercase) to raw materials
    const rawMaterialMap = new Map<string, RawMaterial>()
    for (const rm of rawMaterials) {
      rawMaterialMap.set(rm.item_name.toLowerCase(), rm)
    }

    const matched: MatchedItem[] = []
    
    for (const parsed of parsedItems) {
      const rawMaterial = rawMaterialMap.get(parsed.name.toLowerCase())
      if (rawMaterial) {
        matched.push({
          rawMaterial,
          inventoryQuantity: parsed.quantity,
          isSufficient: parsed.quantity >= rawMaterial.quantity,
        })
      }
    }

    // Sort: sufficient items first, then by name
    return matched.sort((a, b) => {
      if (a.isSufficient !== b.isSufficient) {
        return a.isSufficient ? -1 : 1
      }
      return a.rawMaterial.item_name.localeCompare(b.rawMaterial.item_name)
    })
  }, [inventoryText, rawMaterials])

  const sufficientItems = useMemo(
    () => matchedItems.filter(m => m.isSufficient && !m.rawMaterial.collected),
    [matchedItems]
  )

  const handleApply = useCallback(async () => {
    if (sufficientItems.length === 0) return

    setIsApplying(true)

    try {
      // Mark all sufficient items as collected via API
      const itemIds = sufficientItems.map(m => m.rawMaterial.id)
      
      await Promise.all(
        sufficientItems.map(item =>
          fetch(`/api/projects/${projectId}/items/${item.rawMaterial.id}?type=raw`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collected: true }),
          })
        )
      )

      // Notify parent of collected items
      onItemsCollected(itemIds)
      
      // Clear the textarea
      setInventoryText("")
    } catch (err) {
      console.error("Failed to apply inventory:", err)
    } finally {
      setIsApplying(false)
    }
  }, [sufficientItems, projectId, onItemsCollected])

  const handleClear = () => {
    setInventoryText("")
  }

  const uncollectedRawMaterials = rawMaterials.filter(rm => !rm.collected)

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:text-primary transition-colors">
            <ChevronRight className={`size-5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            <ClipboardList className="size-5" />
            <CardTitle className="flex-1">Import Inventory</CardTitle>
            {uncollectedRawMaterials.length > 0 && (
              <span className="text-sm text-muted-foreground font-normal">
                {uncollectedRawMaterials.length} items remaining
              </span>
            )}
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste your Eve Online inventory to automatically mark items as collected. 
                Copy items from your inventory (Ctrl+C) and paste below.
              </p>
              <Textarea
                placeholder="Paste inventory here...&#10;&#10;Example:&#10;Graphene Nanoribbons&#9;51,032&#9;Hybrid Polymers&#9;&#9;&#9;76,548 m3&#9;1,754,317,367.92 ISK"
                value={inventoryText}
                onChange={(e) => setInventoryText(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
              />
            </div>

            {/* Preview Section */}
            {matchedItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Matched Items ({matchedItems.length})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-green-500" />
                      {sufficientItems.length} sufficient
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="size-3 text-amber-500" />
                      {matchedItems.length - sufficientItems.length - matchedItems.filter(m => m.rawMaterial.collected).length} insufficient
                    </span>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <div className="w-6" />
                    <div className="flex-1">Item</div>
                    <div className="w-28 text-right">Required</div>
                    <div className="w-28 text-right">Inventory</div>
                    <div className="w-20 text-right">Status</div>
                  </div>

                  {/* Items */}
                  <div className="divide-y max-h-[300px] overflow-y-auto">
                    {matchedItems.map((match) => (
                      <div
                        key={match.rawMaterial.id}
                        className={`flex items-center gap-3 px-3 py-2 ${
                          match.rawMaterial.collected 
                            ? "opacity-50 bg-muted/30" 
                            : match.isSufficient 
                              ? "bg-green-500/5" 
                              : ""
                        }`}
                      >
                        <EveItemIcon 
                          typeId={match.rawMaterial.type_id} 
                          size={32} 
                          className="size-6 shrink-0 rounded" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            match.rawMaterial.collected ? "line-through" : ""
                          }`}>
                            {match.rawMaterial.item_name}
                          </p>
                        </div>
                        <div className="w-28 text-right">
                          <span className="text-sm font-mono">
                            {formatNumber(match.rawMaterial.quantity)}
                          </span>
                        </div>
                        <div className="w-28 text-right">
                          <span className={`text-sm font-mono ${
                            match.isSufficient ? "text-green-500" : "text-amber-500"
                          }`}>
                            {formatNumber(match.inventoryQuantity)}
                          </span>
                        </div>
                        <div className="w-20 text-right">
                          {match.rawMaterial.collected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="size-3" />
                              Done
                            </span>
                          ) : match.isSufficient ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="size-3" />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <AlertCircle className="size-3" />
                              Need more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    disabled={isApplying}
                  >
                    <X className="size-4 mr-1" />
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={isApplying || sufficientItems.length === 0}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="size-4 mr-1 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="size-4 mr-1" />
                        Mark {sufficientItems.length} as Collected
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Empty state when no matches */}
            {inventoryText.trim() && matchedItems.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No matching items found. Make sure you&apos;re pasting a valid Eve Online inventory export.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

