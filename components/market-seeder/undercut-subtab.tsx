"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  Clock,
  Minus,
  Package,
  HelpCircle,
  User,
  Users,
  Ban,
  TrendingDown,
} from "lucide-react"
import { type UndercutItem, type SafeItem, type UndercutData } from "@/types/market-seeder"
import { EveItemIcon } from "@/components/eve-item-icon"

interface UndercutSubtabProps {
  data: UndercutData | null
  loading: boolean
  error: string | null
  copiedId: number | null
  onRefresh: () => void
  onCopyPrice: (item: UndercutItem) => void
}

export function UndercutSubtab({
  data,
  loading,
  error,
  copiedId,
  onRefresh,
  onCopyPrice,
}: UndercutSubtabProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all")

  // Extract unique characters from data
  const characters = useMemo(() => {
    if (!data) return []
    const charMap = new Map<number, string>()
    data.undercut_items.forEach(item => {
      charMap.set(item.character_id, item.character_name)
    })
    data.safe_items.forEach(item => {
      charMap.set(item.character_id, item.character_name)
    })
    return Array.from(charMap.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  // Filter items based on selected character
  const allFilteredUndercutItems = useMemo(() => {
    if (!data || selectedCharacter === "all") return data?.undercut_items ?? []
    const charId = parseInt(selectedCharacter)
    return data.undercut_items.filter(item => item.character_id === charId)
  }, [data, selectedCharacter])

  // Split undercut items into profitable and unprofitable
  const profitableUndercutItems = useMemo(() => {
    return allFilteredUndercutItems.filter(item => item.is_profitable)
  }, [allFilteredUndercutItems])

  const unprofitableUndercutItems = useMemo(() => {
    return allFilteredUndercutItems.filter(item => !item.is_profitable)
  }, [allFilteredUndercutItems])

  const filteredSafeItems = useMemo(() => {
    if (!data || selectedCharacter === "all") return data?.safe_items ?? []
    const charId = parseInt(selectedCharacter)
    return data.safe_items.filter(item => item.character_id === charId)
  }, [data, selectedCharacter])

  // Calculate filtered summary counts
  const filteredSummary = useMemo(() => {
    return {
      undercut_count: allFilteredUndercutItems.length,
      profitable_undercut_count: profitableUndercutItems.length,
      unprofitable_undercut_count: unprofitableUndercutItems.length,
      safe_count: filteredSafeItems.length,
      total_orders_in_structure: allFilteredUndercutItems.length + filteredSafeItems.length,
    }
  }, [allFilteredUndercutItems, profitableUndercutItems, unprofitableUndercutItems, filteredSafeItems])

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Minus className="size-5" />
                Undercut Tracker
              </CardTitle>
              <CardDescription>
                Check if competitors have undercut your sell orders and get copy-pasteable prices to beat them
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
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4 mr-2" />
                    Check Undercuts
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

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
          <Card className={filteredSummary.profitable_undercut_count > 0 ? "border-red-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${filteredSummary.profitable_undercut_count > 0 ? "bg-red-500/10" : "bg-muted"}`}>
                  <AlertTriangle className={`size-6 ${filteredSummary.profitable_undercut_count > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredSummary.profitable_undercut_count}</p>
                  <p className="text-sm text-muted-foreground">Action Needed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={filteredSummary.unprofitable_undercut_count > 0 ? "border-amber-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${filteredSummary.unprofitable_undercut_count > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                  <TrendingDown className={`size-6 ${filteredSummary.unprofitable_undercut_count > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredSummary.unprofitable_undercut_count}</p>
                  <p className="text-sm text-muted-foreground">Below Cost</p>
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
                  <p className="text-2xl font-bold">{filteredSummary.safe_count}</p>
                  <p className="text-sm text-muted-foreground">Lowest Price</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Package className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredSummary.total_orders_in_structure}</p>
                  <p className="text-sm text-muted-foreground">Your Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left Column: Undercut Items and Safe Items */}
        <div className="space-y-6">
          {/* Undercut Items List - Only profitable items */}
          {data && profitableUndercutItems.length > 0 && (
            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-500">
                  <AlertTriangle className="size-5" />
                  Items Being Undercut ({profitableUndercutItems.length})
                </CardTitle>
                <CardDescription>
                  Sorted by days until your order becomes lowest. Click undercut price to copy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profitableUndercutItems.map((item) => {
                    // Color coding for days to lowest
                    const daysColor = item.days_to_lowest === null
                      ? "text-muted-foreground"
                      : item.days_to_lowest > 30
                        ? "text-red-500"
                        : item.days_to_lowest > 7
                          ? "text-amber-500"
                          : "text-emerald-500"

                    return (
                      <div
                        key={item.your_order_id}
                        className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                      >
                        {/* Top row: Item info and Days to Lowest badge */}
                        <div className="flex items-center gap-4 mb-3">
                          <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.type_name)
                              }}
                              className="font-medium truncate hover:underline cursor-pointer text-left"
                              title="Click to copy item name"
                            >
                              {item.type_name}
                            </button>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{item.your_volume_remain} units remaining</span>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="flex items-center gap-1">
                                <User className="size-3" />
                                {item.character_name}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${item.days_to_lowest !== null && item.days_to_lowest > 30 ? "bg-red-500/20" : item.days_to_lowest !== null && item.days_to_lowest > 7 ? "bg-amber-500/20" : "bg-emerald-500/20"} ${daysColor} gap-1`}
                          >
                            <Clock className="size-3" />
                            {item.days_to_lowest !== null
                              ? `${Math.ceil(item.days_to_lowest)} days`
                              : "No data"}
                          </Badge>
                        </div>

                        {/* Bottom row: Stats and copy button */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex-1 grid grid-cols-5 gap-4">
                            <div>
                              <p className="text-muted-foreground text-xs">Your Price</p>
                              <p className="font-medium">{item.your_price_formatted}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Lowest Competitor</p>
                              <p className="font-medium text-red-500">{item.competitor_price_formatted}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Competitors Below</p>
                              <p className="font-medium">{item.competitors_below_count} orders ({item.competitors_below_volume} units)</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Est. Daily Sales</p>
                              <p className="font-medium">{item.estimated_daily_sales.toFixed(1)} units</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Days to Lowest</p>
                              <p className={`font-medium ${daysColor}`}>
                                {item.days_to_lowest !== null
                                  ? `${Math.ceil(item.days_to_lowest)} days`
                                  : "—"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-w-[140px] font-mono"
                            onClick={() => onCopyPrice(item)}
                          >
                            {copiedId === item.your_order_id ? (
                              <>
                                <Check className="size-4 mr-2 text-emerald-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-4 mr-2" />
                                {item.undercut_price_eve}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

              {/* Safe Items List */}
          {data && filteredSafeItems.length > 0 && (
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-emerald-600">
                  <Check className="size-5" />
                  Lowest Price ({filteredSafeItems.length})
                </CardTitle>
                <CardDescription>
                  You have the lowest price on these items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredSafeItems.map((item) => (
                    <div
                      key={item.your_order_id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5"
                    >
                      <EveItemIcon typeId={item.type_id} size={32} className="size-8 rounded" />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.type_name)
                          }}
                          className="font-medium truncate hover:underline cursor-pointer text-left"
                          title="Click to copy item name"
                        >
                          {item.type_name}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.your_volume_remain} units remaining</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {item.character_name}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Your Price</p>
                        <p className="font-medium text-emerald-600">{item.your_price_formatted}</p>
                      </div>
                      {item.next_competitor_price_formatted && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Next Competitor</p>
                          <p className="font-medium">{item.next_competitor_price_formatted}</p>
                        </div>
                      )}
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-600">
                        <Check className="size-3 mr-1" />
                        Lowest
                      </Badge>
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
                    <Minus className="size-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Check Your Orders</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click &quot;Check Undercuts&quot; to see if competitors have undercut your sell orders in the structure
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No undercuts state */}
          {data && profitableUndercutItems.length === 0 && filteredSafeItems.length > 0 && unprofitableUndercutItems.length === 0 && (
            <Alert>
              <Check className="size-4 text-emerald-500" />
              <AlertDescription>
                {selectedCharacter === "all" 
                  ? "All your orders have the lowest price! No action needed."
                  : "All orders for this character have the lowest price! No action needed."}
              </AlertDescription>
            </Alert>
          )}

          {/* No orders in structure */}
          {data && filteredSummary.total_orders_in_structure === 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                {selectedCharacter === "all"
                  ? "You have no sell orders in this structure. Place some orders first to track undercuts."
                  : "This character has no sell orders in this structure."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right Column: Not Worth Undercutting Sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          {data && unprofitableUndercutItems.length > 0 ? (
            <Card className="border-amber-500/30">
              <CardHeader className="py-4">
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <Ban className="size-4" />
                  Not Worth Undercutting ({unprofitableUndercutItems.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Competitor price is below Jita×1.1 + 500 ISK/m³ shipping
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {unprofitableUndercutItems.map((item) => (
                    <div
                      key={item.your_order_id}
                      className="flex items-center gap-2 text-sm py-2 px-3 bg-amber-500/5 border border-amber-500/20 rounded min-w-0"
                    >
                      <EveItemIcon typeId={item.type_id} size={32} className="size-6 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.type_name)
                          }}
                          className="text-xs font-medium truncate hover:underline cursor-pointer text-left block w-full"
                          title="Click to copy item name"
                        >
                          {item.type_name}
                        </button>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <User className="size-2.5" />
                            {item.character_name}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">Lowest</p>
                        <p className="text-xs font-mono text-red-500">{item.competitor_price_formatted}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-muted-foreground">Min Cost</p>
                        <p className="text-xs font-mono text-amber-600">{item.min_profitable_price_formatted || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : data ? (
            <Card className="border-dashed border-muted">
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <div className="mx-auto size-10 rounded-full bg-muted flex items-center justify-center">
                    <Check className="size-5 text-emerald-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">All undercuts are profitable</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Tick size info */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <HelpCircle className="size-4" />
        <span>
          Undercut prices respect EVE&apos;s 4 significant figure tick size (e.g., 1M ISK items have 100 ISK ticks)
        </span>
      </div>
    </div>
  )
}

