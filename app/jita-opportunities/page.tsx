"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, BarChart3 } from "lucide-react"
import { SellOpportunitiesTab } from "@/components/jita-opportunities/sell-opportunities-tab"
import { MarketOpportunitiesTab } from "@/components/jita-opportunities/market-opportunities-tab"

type JitaOpportunitiesTab = "sell" | "market"

function normalizeTab(value: string | null): JitaOpportunitiesTab {
  if (value === "market") return "market"
  return "sell"
}

export default function JitaOpportunitiesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = useMemo(() => normalizeTab(searchParams.get("tab")), [searchParams])

  // Ensure URL always has a tab param (canonical, supports refresh/bookmarking)
  useEffect(() => {
    const current = searchParams.get("tab")
    if (current !== "sell" && current !== "market") {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tab)
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [pathname, router, searchParams, tab])

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <TrendingUp className="size-8" />
              Jita Opportunities
            </h1>
            <p className="text-muted-foreground">
              Sell timing for your assets + market opportunity discovery, in one place
            </p>
          </div>
        </header>

        <Tabs
          value={tab}
          onValueChange={(v: string) => {
            const next = normalizeTab(v)
            const params = new URLSearchParams(searchParams.toString())
            params.set("tab", next)
            router.replace(`${pathname}?${params.toString()}`)
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="sell" className="gap-2">
              <TrendingUp className="size-4" />
              Sell Opportunities
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-2">
              <BarChart3 className="size-4" />
              Market Opportunities
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sell" className="space-y-6">
            <SellOpportunitiesTab />
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <MarketOpportunitiesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


