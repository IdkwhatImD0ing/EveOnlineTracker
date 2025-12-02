"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface CostSummaryProps {
  costs: {
    materialsCostBuy: number
    materialsCostSell: number
    jobCosts: number
    excessValue: number
    totalCost: number
    costPerUnit: number
    estimatedProfit: number
  }
  systemCostIndex: number
  quantity: number
}

function formatISK(value: number, showSign = false): string {
  const absValue = Math.abs(value)
  let formatted: string
  
  if (absValue >= 1e9) {
    formatted = `${(absValue / 1e9).toFixed(2)}B`
  } else if (absValue >= 1e6) {
    formatted = `${(absValue / 1e6).toFixed(2)}M`
  } else if (absValue >= 1e3) {
    formatted = `${(absValue / 1e3).toFixed(2)}K`
  } else {
    formatted = absValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  
  if (showSign) {
    return value >= 0 ? `+ISK ${formatted}` : `-ISK ${formatted}`
  }
  return `ISK ${formatted}`
}

export function CostSummary({ costs, systemCostIndex, quantity }: CostSummaryProps) {
  const profitClass = costs.estimatedProfit >= 0 ? "text-green-600" : "text-red-600"

  return (
    <Card className="bg-gradient-to-br from-card to-accent/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cost Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Materials cost:</span>
              <span className="font-semibold tabular-nums">{formatISK(costs.materialsCostBuy)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total job costs:</span>
              <span className="font-semibold tabular-nums">{formatISK(costs.jobCosts)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. excess materials value:</span>
              <span className="font-semibold tabular-nums text-amber-600">
                -{formatISK(costs.excessValue)}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Total estimated build cost:</span>
              <span className="font-bold text-lg tabular-nums">{formatISK(costs.totalCost)}</span>
            </div>
          </div>
          
          <div className="space-y-3 sm:border-l sm:pl-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. build cost per unit:</span>
              <span className="font-semibold tabular-nums">{formatISK(costs.costPerUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">System cost index:</span>
              <span className="font-semibold tabular-nums">
                {(systemCostIndex * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold tabular-nums">{quantity.toLocaleString()}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Est. profit per unit:</span>
              <span className={`font-bold text-lg tabular-nums ${profitClass}`}>
                {formatISK(costs.estimatedProfit / quantity, true)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

