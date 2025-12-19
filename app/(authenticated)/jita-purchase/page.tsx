"use client"

import { useState, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  Loader2, 
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Calculator,
  Copy,
  Check,
  Trash2
} from "lucide-react"
import { EveItemIcon } from "@/components/eve-item-icon"

// Types matching the API response
interface ItemPurchaseResult {
  typeId: number
  name: string
  quantityRequested: number
  quantityFulfilled: number
  quantityUnfulfilled: number
  totalCost: number
  avgPrice: number
  lowestPrice: number | null
  highestPricePaid: number | null
  ordersConsumed: number
  status: 'full' | 'partial' | 'unavailable' | 'unknown'
}

interface PurchaseCalculationResponse {
  success: boolean
  items: ItemPurchaseResult[]
  summary: {
    totalItems: number
    fullyAvailable: number
    partiallyAvailable: number
    unavailable: number
    unknownItems: number
    grandTotalCost: number
    grandTotalCostFormatted: string
  }
  failures: string[]
  timing: {
    parseMs: number
    fetchMs: number
    totalMs: number
  }
}

// Example input for placeholder
const EXAMPLE_INPUT = `Charred Micro Circuit 10692
Conductive Polymer 10692
Contaminated Lorentz Fluid 10692
Contaminated Nanite Compound 6416
Damaged Artificial Neural Network 10692
Defective Current Pump 10692
Fried Interface Circuit 9623
Smashed Trigger Unit 10692
Tangled Power Conduit 10692
Tripped Power Circuit 3208`

function formatIsk(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function StatusIcon({ status }: { status: ItemPurchaseResult['status'] }) {
  switch (status) {
    case 'full':
      return <CheckCircle2 className="size-4 text-green-500" />
    case 'partial':
      return <AlertTriangle className="size-4 text-amber-500" />
    case 'unavailable':
      return <XCircle className="size-4 text-red-500" />
    case 'unknown':
      return <HelpCircle className="size-4 text-zinc-500" />
  }
}

function StatusBadge({ status }: { status: ItemPurchaseResult['status'] }) {
  switch (status) {
    case 'full':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Full</Badge>
    case 'partial':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Partial</Badge>
    case 'unavailable':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Unavailable</Badge>
    case 'unknown':
      return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Unknown</Badge>
  }
}

export default function JitaPurchasePage() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PurchaseCalculationResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCalculate = useCallback(async () => {
    if (!input.trim()) {
      setError("Please enter items to calculate")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/jita-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: input,
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [input])

  const handleClear = useCallback(() => {
    setInput("")
    setResult(null)
    setError(null)
  }, [])

  const handleCopyTotal = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.summary.grandTotalCost.toFixed(2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [result])

  const handleLoadExample = useCallback(() => {
    setInput(EXAMPLE_INPUT)
    setResult(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShoppingCart className="size-8 text-blue-400" />
              Jita Purchase Calculator
            </h1>
            <p className="text-muted-foreground mt-1">
              Calculate the total cost to buy items from Jita sell orders
            </p>
          </div>
        </header>

        {/* Input Section */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="size-5" />
              Item List
            </CardTitle>
            <CardDescription>
              Paste your item list with quantities. Supported formats: &quot;Item Name 1000&quot;, &quot;Item Name x1000&quot;, or tab-separated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={EXAMPLE_INPUT}
              className="min-h-[200px] font-mono text-sm bg-background/50"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleCalculate}
                disabled={isLoading || !input.trim()}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="size-4" />
                    Calculate Cost
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={isLoading}
                className="gap-2"
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
              <Button
                variant="ghost"
                onClick={handleLoadExample}
                disabled={isLoading}
                className="text-muted-foreground"
              >
                Load Example
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="py-4 flex items-center gap-3 text-red-400">
              <AlertCircle className="size-5 shrink-0" />
              <p>{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border/40 bg-card/50">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">
                    {formatIsk(result.summary.grandTotalCost)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyTotal}
                    className="mt-2 text-xs gap-1"
                  >
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
                </CardContent>
              </Card>
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-green-400">
                    {result.summary.fullyAvailable}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Fully Available</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">
                    {result.summary.partiallyAvailable}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Partial</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-red-400">
                    {result.summary.unavailable + result.summary.unknownItems}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Unavailable</p>
                </CardContent>
              </Card>
            </div>

            {/* Failures Warning */}
            {result.failures.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Some items could not be found</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        {result.failures.map((failure, idx) => (
                          <li key={idx}>{failure}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items Table */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Item Breakdown</CardTitle>
                <CardDescription>
                  Cost calculated by walking the Jita sell order book from lowest to highest price.
                  Completed in {result.timing.totalMs}ms.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30">
                      <tr className="text-left text-sm">
                        <th className="p-3 font-medium">Item</th>
                        <th className="p-3 font-medium text-right">Qty Requested</th>
                        <th className="p-3 font-medium text-right">Qty Fulfilled</th>
                        <th className="p-3 font-medium text-right">Avg Price</th>
                        <th className="p-3 font-medium text-right">Total Cost</th>
                        <th className="p-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {result.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {item.typeId > 0 && (
                                <EveItemIcon typeId={item.typeId} size={32} className="size-6 rounded" />
                              )}
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.ordersConsumed > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.ordersConsumed} order{item.ordersConsumed !== 1 ? 's' : ''} consumed
                                    {item.lowestPrice && item.highestPricePaid && item.lowestPrice !== item.highestPricePaid && (
                                      <> • {formatIsk(item.lowestPrice)} → {formatIsk(item.highestPricePaid)}</>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {formatNumber(item.quantityRequested)}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {item.quantityFulfilled === item.quantityRequested ? (
                              <span className="text-green-400">{formatNumber(item.quantityFulfilled)}</span>
                            ) : item.quantityFulfilled > 0 ? (
                              <span className="text-amber-400">{formatNumber(item.quantityFulfilled)}</span>
                            ) : (
                              <span className="text-red-400">0</span>
                            )}
                            {item.quantityUnfulfilled > 0 && (
                              <span className="text-red-400 text-xs ml-1">
                                (-{formatNumber(item.quantityUnfulfilled)})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {item.avgPrice > 0 ? formatIsk(item.avgPrice) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono text-sm font-medium">
                            {item.totalCost > 0 ? (
                              <span className="text-blue-400">{formatIsk(item.totalCost)}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <StatusIcon status={item.status} />
                              <span className="hidden md:inline">
                                <StatusBadge status={item.status} />
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 font-medium">
                      <tr>
                        <td className="p-3" colSpan={4}>
                          Grand Total
                        </td>
                        <td className="p-3 text-right font-mono text-lg text-blue-400">
                          {formatIsk(result.summary.grandTotalCost)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Info Section */}
        <Card className="border-border/40 bg-card/30">
          <CardContent className="py-4 text-sm text-muted-foreground space-y-2">
            <p>
              <strong>How it works:</strong> This tool fetches all current sell orders from Jita (The Forge region) 
              for each item and simulates purchasing by consuming orders from lowest to highest price until your 
              requested quantity is fulfilled.
            </p>
            <p>
              <strong>Price accuracy:</strong> Prices are fetched in real-time from ESI. The actual cost may vary 
              slightly due to market changes between calculation and purchase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

