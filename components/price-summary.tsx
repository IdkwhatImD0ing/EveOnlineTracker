"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import type { RawMaterial } from "@/types/database"

interface PriceSummaryProps {
  rawMaterials: RawMaterial[]
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

type PriceType = "buy" | "sell" | "split"

function CopyablePrice({ 
  label, 
  amount, 
  colorClass 
}: { 
  label: string
  amount: number 
  colorClass: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatISKFull(amount))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-lg font-semibold ${colorClass}`}>
          {formatISKShort(amount)} ISK
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

export function PriceSummary({ rawMaterials }: PriceSummaryProps) {
  const calculateTotal = (priceType: PriceType): number => {
    return rawMaterials.reduce((sum, item) => {
      const price = item[`${priceType}_price`]
      if (price === null) return sum
      return sum + price * item.quantity
    }, 0)
  }

  const totals = {
    buy: calculateTotal("buy"),
    sell: calculateTotal("sell"),
    split: calculateTotal("split"),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jita Prices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <CopyablePrice
          label="Jita Buy"
          amount={totals.buy}
          colorClass="text-green-400"
        />
        <CopyablePrice
          label="Jita Sell"
          amount={totals.sell}
          colorClass="text-red-400"
        />
        <CopyablePrice
          label="Jita Split"
          amount={totals.split}
          colorClass="text-yellow-400"
        />
      </CardContent>
    </Card>
  )
}

