"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface Material {
  typeId: number
  name: string
  quantity: number
  volume: number
  buyPrice: number
  sellPrice: number
  totalBuyPrice: number
  totalSellPrice: number
  groupName?: string
}

interface MaterialsTableProps {
  title: string
  materials: Material[]
  showType?: boolean
}

function formatISK(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatVolume(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " m³"
}

export function MaterialsTable({ title, materials, showType = true }: MaterialsTableProps) {
  const totalBuy = materials.reduce((sum, m) => sum + m.totalBuyPrice, 0)
  const totalSell = materials.reduce((sum, m) => sum + m.totalSellPrice, 0)
  const totalVolume = materials.reduce((sum, m) => sum + m.volume, 0)

  if (materials.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-right">Quantity</th>
                <th className="pb-2 font-medium text-right">Volume</th>
                {showType && <th className="pb-2 font-medium">Type</th>}
                <th className="pb-2 font-medium text-right">Buy Price</th>
                <th className="pb-2 font-medium text-right">Sell Price</th>
                <th className="pb-2 font-medium text-right">Total (buy)</th>
                <th className="pb-2 font-medium text-right">Total (sell)</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.typeId} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-2 font-medium">{m.name}</td>
                  <td className="py-2 text-right tabular-nums">{m.quantity.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatVolume(m.volume)}
                  </td>
                  {showType && (
                    <td className="py-2 text-muted-foreground">{m.groupName || "—"}</td>
                  )}
                  <td className="py-2 text-right tabular-nums">
                    ISK {formatISK(m.buyPrice)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ISK {formatISK(m.sellPrice)}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium">
                    ISK {formatISK(m.totalBuyPrice)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ISK {formatISK(m.totalSellPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-3">Total</td>
                <td className="pt-3"></td>
                <td className="pt-3 text-right tabular-nums">{formatVolume(totalVolume)}</td>
                {showType && <td className="pt-3"></td>}
                <td className="pt-3"></td>
                <td className="pt-3"></td>
                <td className="pt-3 text-right tabular-nums text-primary">
                  ISK {formatISK(totalBuy)}
                </td>
                <td className="pt-3 text-right tabular-nums">
                  ISK {formatISK(totalSell)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

