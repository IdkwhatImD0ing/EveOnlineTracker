"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  AlertTriangle,
  Package,
  ShoppingCart,
  DollarSign,
  HelpCircle,
  Ban,
  Filter,
  User,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { type SellOrderItem, type SellOrderData, type ProgressState } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"
import { ProgressBar } from "./progress-bar"

// Types for the item checker feature
interface CheckerCharacterInfo {
  id: number
  name: string
}

interface CheckerOrderInfo {
  name: string
  type_id: number
  lowest_price: number
  lowest_price_formatted: string
  total_volume: number
  characters: CheckerCharacterInfo[]
}

interface CheckerResults {
  with_orders: CheckerOrderInfo[]
  without_orders: string[]
  not_found: string[]
}

interface FilteredOutItem extends SellOrderItem {
  reason: 'quantity' | 'isk_per_day' | 'competition' | 'no_competition'
}

interface SellSubtabProps {
  data: SellOrderData | null
  loading: boolean
  error: string | null
  progress: ProgressState | null
  onRefresh: () => void

  // Filter state
  minQuantity: number
  setMinQuantity: (value: number) => void
  competitionFilter: "all" | "no_competition" | "with_competition"
  setCompetitionFilter: (value: "all" | "no_competition" | "with_competition") => void
  sortBy: "isk_per_day" | "volume" | "price"
  setSortBy: (value: "isk_per_day" | "volume" | "price") => void
  minIskPerDay: number
  setMinIskPerDay: (value: number) => void

  // Copy state
  copiedNameId: number | null
  copiedPriceId: number | null
  copyAllSuccess: boolean
  onCopyName: (item: SellOrderItem) => void
  onCopyPrice: (item: SellOrderItem) => void
  onCopyAll: () => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
}

export function SellSubtab({
  data,
  loading,
  error,
  progress,
  onRefresh,
  minQuantity,
  setMinQuantity,
  competitionFilter,
  setCompetitionFilter,
  sortBy,
  setSortBy,
  minIskPerDay,
  setMinIskPerDay,
  copiedNameId,
  copiedPriceId,
  copyAllSuccess,
  onCopyName,
  onCopyPrice,
  onCopyAll,
  hubFactorPercent = "5%",
}: SellSubtabProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all")
  
  // Item Checker state
  const [checkerExpanded, setCheckerExpanded] = useState(false)
  const [checkerInput, setCheckerInput] = useState("")
  const [checkerLoading, setCheckerLoading] = useState(false)
  const [checkerError, setCheckerError] = useState<string | null>(null)
  const [checkerResults, setCheckerResults] = useState<CheckerResults | null>(null)

  // Parse item names from EVE inventory export format
  // Format: "Item Name\t123\tGroup\t\tSlot\t5 m3\t1,234.56 ISK"
  const parseItemNames = (text: string): string[] => {
    const lines = text.trim().split('\n')
    const names: string[] = []
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      
      // Split by tab and take the first column (item name)
      const columns = trimmedLine.split('\t')
      const itemName = columns[0]?.trim()
      
      if (itemName) {
        names.push(itemName)
      }
    }
    
    return names
  }

  // Handle checking items
  const handleCheckItems = async () => {
    const itemNames = parseItemNames(checkerInput)
    
    if (itemNames.length === 0) {
      setCheckerError("No item names found. Paste items from EVE inventory.")
      return
    }
    
    setCheckerLoading(true)
    setCheckerError(null)
    setCheckerResults(null)
    
    try {
      const response = await fetch('/api/esi/check-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_names: itemNames }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to check orders')
      }
      
      const data = await response.json()
      setCheckerResults({
        with_orders: data.with_orders,
        without_orders: data.without_orders,
        not_found: data.not_found,
      })
    } catch (err) {
      setCheckerError(err instanceof Error ? err.message : 'Failed to check orders')
    } finally {
      setCheckerLoading(false)
    }
  }

  // Extract unique characters from data (both sellable items and items with existing orders)
  const characters = useMemo(() => {
    if (!data) return []
    const charMap = new Map<number, string>()
    
    // Include characters from sellable items
    data.items.forEach(item => {
      if (item.characters) {
        item.characters.forEach(char => {
          charMap.set(char.id, char.name)
        })
      }
    })
    
    // Also include characters from items with existing orders
    data.items_with_existing_orders.forEach(item => {
      if (item.characters) {
        item.characters.forEach(char => {
          charMap.set(char.id, char.name)
        })
      }
    })
    
    return Array.from(charMap.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!data) return []

    return data.items
      .filter(item => {
        if (item.quantity < minQuantity) return false
        if (item.isk_per_day < minIskPerDay) return false
        if (competitionFilter === "no_competition" && item.has_competition) return false
        if (competitionFilter === "with_competition" && !item.has_competition) return false
        // Character filter: show items where selected character has inventory
        if (selectedCharacter !== "all" && item.characters) {
          const charId = parseInt(selectedCharacter)
          if (!item.characters.some(c => c.id === charId)) return false
        }
        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "isk_per_day":
            return b.isk_per_day - a.isk_per_day
          case "volume":
            return b.estimated_daily_sales - a.estimated_daily_sales
          case "price":
            return b.sell_price - a.sell_price
          default:
            return 0
        }
      })
  }, [data, minQuantity, minIskPerDay, competitionFilter, sortBy, selectedCharacter])

  // Calculate "do not sell" items (items filtered out from the main list)
  const doNotSellItems = useMemo(() => {
    if (!data) return { existingOrders: [], filteredOut: [] }

    const filteredOut: FilteredOutItem[] = data.items
      .filter(item => !filteredItems.includes(item))
      // Also filter by character if one is selected
      .filter(item => {
        if (selectedCharacter === "all") return true
        if (!item.characters) return false
        const charId = parseInt(selectedCharacter)
        return item.characters.some(c => c.id === charId)
      })
      .map(item => {
        let reason: FilteredOutItem['reason'] = 'quantity'
        if (item.quantity < minQuantity) reason = 'quantity'
        else if (item.isk_per_day < minIskPerDay) reason = 'isk_per_day'
        else if (competitionFilter === "no_competition" && item.has_competition) reason = 'competition'
        else if (competitionFilter === "with_competition" && !item.has_competition) reason = 'no_competition'
        return { ...item, reason }
      })

    // Get items with existing orders from the main items list (now includes pricing)
    // Filter by selected character if one is selected
    const existingOrders = data.items
      .filter(item => item.has_existing_order)
      .filter(item => {
        if (selectedCharacter === "all") return true
        if (!item.characters) return false
        const charId = parseInt(selectedCharacter)
        return item.characters.some(c => c.id === charId)
      })

    return {
      existingOrders,
      filteredOut,
    }
  }, [data, filteredItems, minQuantity, minIskPerDay, competitionFilter, selectedCharacter])

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="size-5" />
                Sell Order Generator
              </CardTitle>
              <CardDescription>
                Generate optimal sell prices for your inventory in 3T7. Uses tiered markup for items with no competition.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Character Filter */}
              {data && characters.length > 1 && (
                <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                  <SelectTrigger className="w-[200px]">
                    {selectedCharacter === "all" ? (
                      <div className="flex items-center gap-2">
                        <Users className="size-4" />
                        <span>All Characters</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://images.evetech.net/characters/${selectedCharacter}/portrait?size=32`}
                          alt=""
                          className="size-5 rounded-full"
                        />
                        <span className="truncate">
                          {characters.find(c => c.id.toString() === selectedCharacter)?.name}
                        </span>
                      </div>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="size-5" />
                        <span>All Characters</span>
                      </div>
                    </SelectItem>
                    {characters.map(char => (
                      <SelectItem key={char.id} value={char.id.toString()}>
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://images.evetech.net/characters/${char.id}/portrait?size=32`}
                            alt=""
                            className="size-5 rounded-full"
                          />
                          <span>{char.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={onRefresh}
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4 mr-2" />
                    Generate Sell Orders
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Bar */}
      {progress && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <ProgressBar progress={progress} />
          </CardContent>
        </Card>
      )}

      {/* Item Checker */}
      <Collapsible open={checkerExpanded} onOpenChange={setCheckerExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="size-4" />
                  Check If I Have Sell Orders
                  {checkerResults && (
                    <Badge variant="secondary" className="ml-2">
                      {checkerResults.with_orders.length} listed, {checkerResults.without_orders.length} unlisted
                    </Badge>
                  )}
                </CardTitle>
                {checkerExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="checker-input">
                  Paste items from EVE inventory (tab-separated format)
                </Label>
                <Textarea
                  id="checker-input"
                  placeholder="ORE Ice Harvester	3	Strip Miner		High	15 m3	539,595,525.42 ISK
Zeugma Integrated Analyzer		Data Miners		Medium	5 m3	530,611,313.87 ISK"
                  value={checkerInput}
                  onChange={(e) => setCheckerInput(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCheckItems}
                  disabled={checkerLoading || !checkerInput.trim()}
                >
                  {checkerLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="size-4 mr-2" />
                      Check Orders
                    </>
                  )}
                </Button>
                {checkerResults && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCheckerResults(null)
                      setCheckerInput("")
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Error display */}
              {checkerError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{checkerError}</AlertDescription>
                </Alert>
              )}

              {/* Results */}
              {checkerResults && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Has My Orders */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="size-4 text-emerald-500" />
                      I Have Orders ({checkerResults.with_orders.length})
                    </h4>
                    {checkerResults.with_orders.length > 0 ? (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {checkerResults.with_orders.map((item) => (
                          <div 
                            key={item.type_id} 
                            className="flex items-center gap-2 text-sm py-1.5 px-2 bg-emerald-500/10 border border-emerald-500/20 rounded"
                          >
                            <EveItemIcon typeId={item.type_id} size={32} className="size-5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="truncate text-xs block">{item.name}</span>
                              {item.characters && item.characters.length > 0 && (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {item.characters.map(c => c.name).join(', ')}
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground font-mono text-xs shrink-0">
                              {item.lowest_price_formatted}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">You have no orders for these items</p>
                    )}
                  </div>

                  {/* No Orders */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Check className="size-4 text-blue-500" />
                      No Orders Yet ({checkerResults.without_orders.length})
                    </h4>
                    {checkerResults.without_orders.length > 0 ? (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {checkerResults.without_orders.map((name, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-2 text-sm py-1.5 px-2 bg-blue-500/10 border border-blue-500/20 rounded"
                          >
                            <span className="flex-1 truncate text-xs">{name}</span>
                            <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-600">
                              Can Sell
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">You already have orders for all items</p>
                    )}
                  </div>

                  {/* Not Found */}
                  {checkerResults.not_found.length > 0 && (
                    <div className="space-y-2 md:col-span-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500" />
                        Not Found ({checkerResults.not_found.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {checkerResults.not_found.map((name, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filter Controls */}
      {data && data.items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="min-quantity" className="whitespace-nowrap">Min Quantity:</Label>
                <Input
                  id="min-quantity"
                  type="number"
                  min={1}
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Competition:</Label>
                <div className="flex gap-1">
                  <Button
                    variant={competitionFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={competitionFilter === "no_competition" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("no_competition")}
                    className={competitionFilter === "no_competition" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    No Competition
                  </Button>
                  <Button
                    variant={competitionFilter === "with_competition" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCompetitionFilter("with_competition")}
                    className={competitionFilter === "with_competition" ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    With Competition
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Sort by:</Label>
                <div className="flex gap-1">
                  <Button
                    variant={sortBy === "isk_per_day" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("isk_per_day")}
                  >
                    ISK/Day
                  </Button>
                  <Button
                    variant={sortBy === "volume" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("volume")}
                  >
                    Volume
                  </Button>
                  <Button
                    variant={sortBy === "price" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("price")}
                  >
                    Price
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="min-isk-day" className="whitespace-nowrap">Min ISK/Day:</Label>
                <Input
                  id="min-isk-day"
                  type="number"
                  min={0}
                  step={1000}
                  value={minIskPerDay}
                  onChange={(e) => setMinIskPerDay(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28"
                  placeholder="0"
                />
              </div>
              <span className="text-sm text-muted-foreground ml-auto">
                Showing {filteredItems.length} of {data.items.length} items
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopyAll}
                disabled={filteredItems.length === 0}
                className="gap-2"
              >
                {copyAllSuccess ? (
                  <>
                    <Check className="size-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy All ({filteredItems.length})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_items}</p>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <Check className="size-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_no_competition}</p>
                  <p className="text-sm text-muted-foreground">No Competition</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="size-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_with_competition}</p>
                  <p className="text-sm text-muted-foreground">With Competition</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="size-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total_isk_per_day_formatted}</p>
                  <p className="text-sm text-muted-foreground">Est. ISK/Day</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content: Side-by-side layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left Column: Sell Orders */}
        <div className="space-y-6">
          {/* Sell Order Items Table */}
          {data && filteredItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Sell Orders ({filteredItems.length} items)
                </CardTitle>
                <CardDescription>
                  Sorted by ISK/day (highest first). Items with no competition use tiered markup pricing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.type_id}
                      className={`p-4 rounded-lg border transition-colors ${item.has_competition
                        ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                        }`}
                    >
                      {/* Top row: Item info */}
                      <div className="flex items-center gap-4 mb-3">
                        <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.type_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.quantity.toLocaleString()} units</span>
                            {item.characters && item.characters.length > 0 && (
                              <>
                                <span className="text-muted-foreground/50">•</span>
                                <span className="flex items-center gap-1">
                                  <User className="size-3" />
                                  {item.characters.length === 1 ? (
                                    item.characters[0].name
                                  ) : (
                                    `${item.characters.length} characters`
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Character portraits for multi-character items */}
                        {item.characters && item.characters.length > 1 && (
                          <div className="flex -space-x-2">
                            {item.characters.slice(0, 3).map(char => (
                              <img
                                key={char.id}
                                src={`https://images.evetech.net/characters/${char.id}/portrait?size=32`}
                                alt={char.name}
                                title={char.name}
                                className="size-6 rounded-full border-2 border-background"
                              />
                            ))}
                            {item.characters.length > 3 && (
                              <div className="size-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                                +{item.characters.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                        {item.has_existing_order && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/20 text-blue-600"
                          >
                            Has Order
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={item.has_competition ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"}
                        >
                          {item.has_competition ? "Competition" : "No Competition"}
                        </Badge>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1 grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-muted-foreground text-xs">Sell Price</p>
                            <p className="font-medium">{item.sell_price_formatted}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Jita Price</p>
                            <p className="font-medium text-muted-foreground">{item.jita_price_formatted}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Vol/Day ({hubFactorPercent})</p>
                            <p className="font-medium">{item.estimated_daily_sales.toFixed(2)} units</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">ISK/Day</p>
                            <p className="font-medium text-blue-500">{item.isk_per_day_formatted}</p>
                          </div>
                        </div>

                        {/* Copy buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-[100px]"
                            onClick={() => onCopyName(item)}
                          >
                            {copiedNameId === item.type_id ? (
                              <>
                                <Check className="size-4 mr-2 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-4 mr-2" />
                                Name
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-[140px] font-mono"
                            onClick={() => onCopyPrice(item)}
                          >
                            {copiedPriceId === item.type_id ? (
                              <>
                                <Check className="size-4 mr-2 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-4 mr-2" />
                                {item.sell_price_eve}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!data && !loading && !error && (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingCart className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Generate Sell Orders</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click &quot;Generate Sell Orders&quot; to analyze your 3T7 inventory and get optimal sell prices
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No items state */}
          {data && data.items.length === 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                No sellable items found in your 3T7 inventory. Items need Jita price data to generate sell orders.
              </AlertDescription>
            </Alert>
          )}

          {/* All items filtered out */}
          {data && data.items.length > 0 && filteredItems.length === 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                All {data.items.length} items filtered out. Try lowering the minimum quantity filter.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right Column: Do Not Sell */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          {data && (doNotSellItems.existingOrders.length > 0 || doNotSellItems.filteredOut.length > 0) ? (
            <Card className="border-muted">
              <CardHeader className="py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ban className="size-4 text-muted-foreground" />
                  Do Not Sell ({doNotSellItems.existingOrders.length + doNotSellItems.filteredOut.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Existing Orders - these items have full pricing info now */}
                {doNotSellItems.existingOrders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ShoppingCart className="size-4 text-blue-500" />
                      Has Existing Orders ({doNotSellItems.existingOrders.length})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {doNotSellItems.existingOrders.map((item) => (
                        <div key={item.type_id} className="flex items-center gap-2 text-sm py-1.5 px-2 bg-blue-500/5 rounded min-w-0">
                          <EveItemIcon typeId={item.type_id} size={32} className="size-5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="truncate text-xs block">{item.type_name}</span>
                            {item.order_characters && item.order_characters.length > 0 && (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {item.order_characters.map(c => c.name).join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs block">{item.sell_price_formatted}</span>
                            <span className="text-[10px] text-muted-foreground">{item.quantity.toLocaleString()} units</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtered Out */}
                {doNotSellItems.filteredOut.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Filter className="size-4 text-amber-500" />
                      Filtered Out ({doNotSellItems.filteredOut.length})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {doNotSellItems.filteredOut.map((item) => (
                        <div key={item.type_id} className="flex items-center gap-2 text-sm py-1 px-2 bg-amber-500/5 rounded min-w-0">
                          <EveItemIcon typeId={item.type_id} size={32} className="size-5 shrink-0" />
                          <span className="flex-1 truncate text-xs">{item.type_name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0 px-1">
                            {item.reason === 'quantity' ? 'Qty'
                              : item.reason === 'isk_per_day' ? 'ISK'
                                : item.reason === 'competition' ? 'Comp'
                                  : item.reason === 'no_competition' ? 'NoComp'
                                    : '?'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : data ? (
            <Card className="border-dashed border-muted">
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <div className="mx-auto size-10 rounded-full bg-muted flex items-center justify-center">
                    <Check className="size-5 text-emerald-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">All items can be sold</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Pricing info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="size-4" />
        <span>
          No competition: tiered markup (4x for &lt;500K, 3x for &lt;2M, 2x for &lt;10M, 1.7x for &lt;50M, 1.4x for ≥50M). With competition: 1-tick undercut.
        </span>
      </div>
    </div>
  )
}

