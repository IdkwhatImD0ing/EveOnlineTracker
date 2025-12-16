"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Minus, ShoppingCart } from "lucide-react"
import {
  type UndercutItem,
  type UndercutData,
  type SellOrderItem,
  type SellOrderData,
  type ProgressState,
} from "@/types/market-seeder"
import { UndercutSubtab } from "./undercut-subtab"
import { SellSubtab } from "./sell-subtab"

interface MarketTabProps {
  // Sub-tab state
  activeSubTab: "undercut" | "sell"
  setActiveSubTab: (tab: "undercut" | "sell") => void

  // Undercut data
  undercutData: UndercutData | null
  undercutLoading: boolean
  undercutError: string | null
  undercutCopiedId: number | null
  onUndercutRefresh: () => void
  onUndercutCopyPrice: (item: UndercutItem) => void

  // Sell order data
  sellOrderData: SellOrderData | null
  sellOrderLoading: boolean
  sellOrderError: string | null
  sellProgress: ProgressState | null
  onSellRefresh: () => void

  // Sell filter state
  sellMinQuantity: number
  setSellMinQuantity: (value: number) => void
  sellCompetitionFilter: "all" | "no_competition" | "with_competition"
  setSellCompetitionFilter: (value: "all" | "no_competition" | "with_competition") => void
  sellSortBy: "isk_per_day" | "volume" | "price"
  setSellSortBy: (value: "isk_per_day" | "volume" | "price") => void
  sellMinIskPerDay: number
  setSellMinIskPerDay: (value: number) => void

  // Sell copy state
  sellCopiedNameId: number | null
  sellCopiedPriceId: number | null
  sellCopyAllSuccess: boolean
  onSellCopyName: (item: SellOrderItem) => void
  onSellCopyPrice: (item: SellOrderItem) => void
  onSellCopyAll: () => void

  // Hub factor display
  hubFactorPercent?: string  // e.g. "5%" - for display in labels
}

export function MarketTab({
  activeSubTab,
  setActiveSubTab,
  undercutData,
  undercutLoading,
  undercutError,
  undercutCopiedId,
  onUndercutRefresh,
  onUndercutCopyPrice,
  sellOrderData,
  sellOrderLoading,
  sellOrderError,
  sellProgress,
  onSellRefresh,
  sellMinQuantity,
  setSellMinQuantity,
  sellCompetitionFilter,
  setSellCompetitionFilter,
  sellSortBy,
  setSellSortBy,
  sellMinIskPerDay,
  setSellMinIskPerDay,
  sellCopiedNameId,
  sellCopiedPriceId,
  sellCopyAllSuccess,
  onSellCopyName,
  onSellCopyPrice,
  onSellCopyAll,
  hubFactorPercent = "5%",
}: MarketTabProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs value={activeSubTab} onValueChange={(v: string) => setActiveSubTab(v as "undercut" | "sell")} className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-auto">
          <TabsTrigger value="undercut" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5">
            <Minus className="size-3.5 md:size-4" />
            Undercut
            {undercutData && undercutData.summary.undercut_count > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                {undercutData.summary.undercut_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sell" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2.5">
            <ShoppingCart className="size-3.5 md:size-4" />
            Sell
            {sellOrderData && sellOrderData.summary.total_items > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {sellOrderData.summary.total_items}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="undercut">
          <UndercutSubtab
            data={undercutData}
            loading={undercutLoading}
            error={undercutError}
            copiedId={undercutCopiedId}
            onRefresh={onUndercutRefresh}
            onCopyPrice={onUndercutCopyPrice}
          />
        </TabsContent>

        <TabsContent value="sell">
          <SellSubtab
            data={sellOrderData}
            loading={sellOrderLoading}
            error={sellOrderError}
            progress={sellProgress}
            onRefresh={onSellRefresh}
            minQuantity={sellMinQuantity}
            setMinQuantity={setSellMinQuantity}
            competitionFilter={sellCompetitionFilter}
            setCompetitionFilter={setSellCompetitionFilter}
            sortBy={sellSortBy}
            setSortBy={setSellSortBy}
            minIskPerDay={sellMinIskPerDay}
            setMinIskPerDay={setSellMinIskPerDay}
            copiedNameId={sellCopiedNameId}
            copiedPriceId={sellCopiedPriceId}
            copyAllSuccess={sellCopyAllSuccess}
            onCopyName={onSellCopyName}
            onCopyPrice={onSellCopyPrice}
            onCopyAll={onSellCopyAll}
            hubFactorPercent={hubFactorPercent}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

