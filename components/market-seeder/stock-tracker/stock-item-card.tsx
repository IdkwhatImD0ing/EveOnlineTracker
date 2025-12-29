"use client"

import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { EveItemIcon } from "@/components/eve-item-icon"

/**
 * Urgency level for stock items
 */
export type UrgencyLevel = 'critical' | 'warning' | 'ok' | 'none'

/**
 * Normalized stock item for display
 * Both WatchlistItem and DepletionPrediction can be mapped to this interface
 */
export interface StockItemData {
  typeId: number
  name: string
  categoryName: string | null
  groupName: string | null
  stock: number
  estimatedDailySales: number
  daysUntilStockout: number | null
  dailyProfit: number
  urgencyLevel: UrgencyLevel
  // Optional extras for specific tabs
  priorityScore?: number
}

/**
 * Simplified card for items before stock data is loaded
 */
interface StockItemCardSimpleProps {
  typeId: number
  name: string
  categoryName: string | null
  groupName: string | null
  actions?: ReactNode
}

export function StockItemCardSimple({ typeId, name, categoryName, groupName, actions }: StockItemCardSimpleProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <EveItemIcon typeId={typeId} size={64} className="size-10 shrink-0 rounded" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {categoryName} • {groupName}
            </div>
          </div>
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
