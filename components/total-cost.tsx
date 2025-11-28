"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import type { RawMaterial, Component, AdditionalCost } from "@/types/database"

interface TotalCostProps {
  rawMaterials: RawMaterial[]
  components: Component[]
  additionalCosts: AdditionalCost[]
}

function formatISKFull(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatISKShort(amount: number): string {
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

export function TotalCost({ rawMaterials, components, additionalCosts }: TotalCostProps) {
  const [copied, setCopied] = useState(false)

  const allItems = [...rawMaterials, ...components]
  
  const jitaBuyTotal = allItems.reduce((sum, item) => {
    if (item.buy_price === null) return sum
    return sum + item.buy_price * item.quantity
  }, 0)

  const additionalTotal = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0)
  
  const grandTotal = jitaBuyTotal + additionalTotal

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatISKFull(grandTotal))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
      <CardHeader>
        <CardTitle>Total Project Cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jita Buy (Materials + Components)</span>
            <span className="font-mono">{formatISKShort(jitaBuyTotal)} ISK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Additional Costs</span>
            <span className="font-mono">{formatISKShort(additionalTotal)} ISK</span>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Grand Total</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-primary">
                {formatISKShort(grandTotal)} ISK
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Full value: {formatISKFull(grandTotal)} ISK
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

