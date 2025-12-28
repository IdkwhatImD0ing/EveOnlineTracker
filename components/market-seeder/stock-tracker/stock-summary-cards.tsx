"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatIskShort } from "../utils"

interface StockSummaryCardsProps {
    /** Total number of items being tracked */
    totalItems: number
    /** Number of items with zero stock */
    criticalCount: number
    /** Number of items with less than 3 days of stock */
    warningCount: number
    /** Total daily profit potential across all items */
    dailyProfit: number
    /** Label for total items card (e.g., "Items Tracked", "Essential Items") */
    totalLabel?: string
}

/**
 * Summary cards showing stock status overview
 * Used by Watchlist, Essentials, and Depletion tabs
 */
export function StockSummaryCards({
    totalItems,
    criticalCount,
    warningCount,
    dailyProfit,
    totalLabel = "Items Tracked",
}: StockSummaryCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-4">
            <Card>
                <CardContent className="p-4">
                    <p className="text-2xl font-bold">{totalItems}</p>
                    <p className="text-sm text-muted-foreground">{totalLabel}</p>
                </CardContent>
            </Card>
            <Card className="border-destructive/50">
                <CardContent className="p-4">
                    <p className="text-2xl font-bold text-destructive">
                        {criticalCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Critical (out of stock)</p>
                </CardContent>
            </Card>
            <Card className="border-amber-500/50">
                <CardContent className="p-4">
                    <p className="text-2xl font-bold text-amber-500">
                        {warningCount}
                    </p>
                    <p className="text-sm text-muted-foreground">Warning (&lt;3 days)</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <p className="text-2xl font-bold text-emerald-500">
                        {formatIskShort(dailyProfit)}
                    </p>
                    <p className="text-sm text-muted-foreground">Daily Profit Potential</p>
                </CardContent>
            </Card>
        </div>
    )
}

