"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
  LogIn,
  ArrowUpDown,
  DollarSign,
  Package,
  Percent,
} from "lucide-react"

interface TokenData {
  access_token: string
  refresh_token: string
  expires_in: number
}

interface Asset {
  type_id: number
  type_name: string
  total_quantity: number
  locations: number
}

interface SellOpportunity {
  type_id: number
  type_name: string
  quantity: number
  current_sell_price: number
  all_time_high: number
  mean_price: number
  percent_of_ath: number
  percent_of_mean: number
  total_value: number
  recommendation: "sell" | "hold" | "wait"
  recommendation_text: string
}

interface OpportunitySummary {
  total_items: number
  sell_now_count: number
  hold_count: number
  wait_count: number
  total_value: number
  sell_now_value: number
  items_with_ath_data: number
}

interface SkippedInfo {
  count: number
  reason: string
  items: string[]
}

interface CachedData {
  opportunities: SellOpportunity[]
  summary: OpportunitySummary
  timestamp: number
  characterId: number
}

type SortField = "percent_of_ath" | "total_value" | "quantity" | "type_name"
type SortDirection = "asc" | "desc"

const CACHE_KEY = "eve_sell_opportunities_cache"

function formatISK(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`
  } else if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(2)
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function getRecommendationStyles(recommendation: string) {
  switch (recommendation) {
    case "sell":
      return {
        badge: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
        icon: TrendingUp,
        iconColor: "text-emerald-500",
        row: "bg-emerald-500/5",
      }
    case "hold":
      return {
        badge: "bg-amber-500/20 text-amber-600 border-amber-500/30",
        icon: Minus,
        iconColor: "text-amber-500",
        row: "bg-amber-500/5",
      }
    case "wait":
      return {
        badge: "bg-red-500/20 text-red-600 border-red-500/30",
        icon: TrendingDown,
        iconColor: "text-red-500",
        row: "bg-red-500/5",
      }
    default:
      return {
        badge: "bg-muted text-muted-foreground",
        icon: Minus,
        iconColor: "text-muted-foreground",
        row: "",
      }
  }
}

/**
 * Check if JWT token is expired (with 60 second buffer)
 */
function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(base64))
    const expiry = payload.exp * 1000 // ms
    return Date.now() >= expiry - 60000
  } catch {
    return true
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const response = await fetch("/api/auth/eve/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function SellOpportunitiesTab() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [characterName, setCharacterName] = useState<string | null>(null)
  const [characterId, setCharacterId] = useState<number | null>(null)

  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadingOpportunities, setLoadingOpportunities] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [opportunities, setOpportunities] = useState<SellOpportunity[]>([])
  const [summary, setSummary] = useState<OpportunitySummary | null>(null)
  const [skipped, setSkipped] = useState<SkippedInfo | null>(null)
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null)

  const [sortField, setSortField] = useState<SortField>("percent_of_ath")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [filterRecommendation, setFilterRecommendation] = useState<string | null>(null)

  /**
   * Get a valid access token, refreshing if needed
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const savedTokens = localStorage.getItem("eve_sso_tokens")
    if (!savedTokens) return null

    try {
      const parsed = JSON.parse(savedTokens) as TokenData

      if (isTokenExpired(parsed.access_token)) {
        const newTokens = await refreshAccessToken(parsed.refresh_token)
        if (!newTokens) {
          localStorage.removeItem("eve_sso_tokens")
          setIsLoggedIn(false)
          setAccessToken(null)
          return null
        }

        localStorage.setItem("eve_sso_tokens", JSON.stringify(newTokens))
        setAccessToken(newTokens.access_token)

        const base64Url = newTokens.access_token.split(".")[1]
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
        const payload = JSON.parse(atob(base64))
        setCharacterName(payload.name)

        return newTokens.access_token
      }

      return parsed.access_token
    } catch {
      return null
    }
  }, [])

  // Check for saved tokens and load cached data
  useEffect(() => {
    const checkTokens = async () => {
      const savedTokens = localStorage.getItem("eve_sso_tokens")
      if (!savedTokens) {
        setIsLoggedIn(false)
        return
      }

      try {
        const parsed = JSON.parse(savedTokens) as TokenData

        // Parse character info from token (even if expired, just for display)
        const base64Url = parsed.access_token.split(".")[1]
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
        const payload = JSON.parse(atob(base64))
        setCharacterName(payload.name)
        const charId = parseInt(payload.sub.split(":")[2])
        setCharacterId(charId)

        // Load cached data for this character
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          try {
            const cache = JSON.parse(cachedData) as CachedData
            if (cache.characterId === charId) {
              setOpportunities(cache.opportunities)
              setSummary(cache.summary)
              setCacheTimestamp(cache.timestamp)
            }
          } catch {
            // ignore invalid cache
          }
        }

        const validToken = await getValidToken()
        if (validToken) {
          setAccessToken(validToken)
          setIsLoggedIn(true)
        } else {
          setIsLoggedIn(false)
        }
      } catch {
        setIsLoggedIn(false)
      }
    }

    checkTokens()
  }, [getValidToken])

  const fetchOpportunities = async () => {
    setLoadingAssets(true)
    setError(null)

    try {
      const token = await getValidToken()
      if (!token) {
        setError("Session expired. Please login again.")
        setIsLoggedIn(false)
        setLoadingAssets(false)
        return
      }

      // Step 1: Fetch character assets
      const assetsResponse = await fetch("/api/esi/character-assets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!assetsResponse.ok) {
        const data = await assetsResponse.json()
        if (assetsResponse.status === 401) {
          localStorage.removeItem("eve_sso_tokens")
          setIsLoggedIn(false)
          throw new Error("Session expired. Please login again.")
        }
        throw new Error(data.error || "Failed to fetch assets")
      }

      const assetsData = await assetsResponse.json()
      const assets: Asset[] = assetsData.assets

      if (assets.length === 0) {
        setError("No assets found in Jita 4-4 for this character")
        setLoadingAssets(false)
        return
      }

      setLoadingAssets(false)
      setLoadingOpportunities(true)

      // Step 2: Analyze sell opportunities
      const opportunitiesResponse = await fetch("/api/sell-opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assets: assets.map((a) => ({
            type_id: a.type_id,
            type_name: a.type_name,
            quantity: a.total_quantity,
          })),
        }),
      })

      if (!opportunitiesResponse.ok) {
        const data = await opportunitiesResponse.json()
        throw new Error(data.error || "Failed to analyze opportunities")
      }

      const opportunitiesData = await opportunitiesResponse.json()
      const newOpportunities = opportunitiesData.opportunities
      const newSummary = opportunitiesData.summary
      const newSkipped = opportunitiesData.skipped || null
      const now = Date.now()

      setOpportunities(newOpportunities)
      setSummary(newSummary)
      setSkipped(newSkipped)
      setCacheTimestamp(now)

      if (characterId) {
        const cacheData: CachedData = {
          opportunities: newOpportunities,
          summary: newSummary,
          timestamp: now,
          characterId: characterId,
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoadingAssets(false)
      setLoadingOpportunities(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const sortedOpportunities = useMemo(() => {
    return [...opportunities]
      .filter((o) => !filterRecommendation || o.recommendation === filterRecommendation)
      .sort((a, b) => {
        let comparison = 0
        switch (sortField) {
          case "percent_of_ath":
            comparison = a.percent_of_ath - b.percent_of_ath
            break
          case "total_value":
            comparison = a.total_value - b.total_value
            break
          case "quantity":
            comparison = a.quantity - b.quantity
            break
          case "type_name":
            comparison = a.type_name.localeCompare(b.type_name)
            break
        }
        return sortDirection === "asc" ? comparison : -comparison
      })
  }, [filterRecommendation, opportunities, sortDirection, sortField])

  // Loading placeholder while checking login
  if (isLoggedIn === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-6">
            <LogIn className="size-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            This feature requires EVE SSO login to access your character&apos;s assets. Make sure to grant the assets
            permission when logging in.
          </p>
          <Button onClick={() => (window.location.href = "/api/auth/eve/login")} className="gap-2">
            <LogIn className="size-4" />
            Login with EVE SSO
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Sell Opportunities</CardTitle>
              <CardDescription>
                {characterName ? `${characterName} • Jita 4-4` : "Find the best time to sell your items"}
                {cacheTimestamp && (
                  <span className="ml-2 text-muted-foreground">• Updated {new Date(cacheTimestamp).toLocaleString()}</span>
                )}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOpportunities}
              disabled={loadingAssets || loadingOpportunities}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${(loadingAssets || loadingOpportunities) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {(loadingAssets || loadingOpportunities) && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground mr-3" />
            <span className="text-muted-foreground">
              {loadingAssets ? "Fetching assets from EVE..." : "Analyzing market opportunities..."}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && !loadingAssets && !loadingOpportunities && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <TrendingUp className="size-4" />
                <span className="text-xs font-medium uppercase">Sell Now</span>
              </div>
              <div className="text-2xl font-bold">{summary.sell_now_count}</div>
              <div className="text-sm text-muted-foreground">{formatISK(summary.sell_now_value)} ISK</div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Minus className="size-4" />
                <span className="text-xs font-medium uppercase">Hold</span>
              </div>
              <div className="text-2xl font-bold">{summary.hold_count}</div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <TrendingDown className="size-4" />
                <span className="text-xs font-medium uppercase">Wait</span>
              </div>
              <div className="text-2xl font-bold">{summary.wait_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="size-4" />
                <span className="text-xs font-medium uppercase">Total Value</span>
              </div>
              <div className="text-2xl font-bold">{formatISK(summary.total_value)}</div>
              <div className="text-sm text-muted-foreground">ISK</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skipped Items Info */}
      {skipped && skipped.count > 0 && !loadingAssets && !loadingOpportunities && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            <span className="font-medium">{skipped.count} items</span> skipped (no market history):{" "}
            {skipped.items.join(", ")}
            {skipped.count > 10 && " ..."}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Buttons */}
      {summary && !loadingAssets && !loadingOpportunities && (
        <div className="flex flex-wrap gap-2">
          <Button variant={filterRecommendation === null ? "default" : "outline"} size="sm" onClick={() => setFilterRecommendation(null)}>
            All ({summary.total_items})
          </Button>
          <Button
            variant={filterRecommendation === "sell" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRecommendation("sell")}
            className={filterRecommendation === "sell" ? "bg-emerald-600 hover:bg-emerald-700" : "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"}
          >
            <TrendingUp className="size-3 mr-1" />
            Sell ({summary.sell_now_count})
          </Button>
          <Button
            variant={filterRecommendation === "hold" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRecommendation("hold")}
            className={filterRecommendation === "hold" ? "bg-amber-600 hover:bg-amber-700" : "border-amber-500/40 text-amber-600 hover:bg-amber-500/10"}
          >
            <Minus className="size-3 mr-1" />
            Hold ({summary.hold_count})
          </Button>
          <Button
            variant={filterRecommendation === "wait" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRecommendation("wait")}
            className={filterRecommendation === "wait" ? "bg-red-600 hover:bg-red-700" : "border-red-500/40 text-red-600 hover:bg-red-500/10"}
          >
            <TrendingDown className="size-3 mr-1" />
            Wait ({summary.wait_count})
          </Button>
        </div>
      )}

      {/* Opportunities Table */}
      {sortedOpportunities.length > 0 && !loadingAssets && !loadingOpportunities && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">
                    <button onClick={() => handleSort("type_name")} className="flex items-center gap-1 hover:text-foreground">
                      Item
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <button onClick={() => handleSort("quantity")} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      <Package className="size-3" />
                      Qty
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Current</th>
                  <th className="px-4 py-3 font-medium text-right">Mean</th>
                  <th className="px-4 py-3 font-medium text-right">ATH</th>
                  <th className="px-4 py-3 font-medium text-right">
                    <button onClick={() => handleSort("percent_of_ath")} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      <Percent className="size-3" />
                      % of ATH
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    <button onClick={() => handleSort("total_value")} className="flex items-center gap-1 hover:text-foreground ml-auto">
                      <DollarSign className="size-3" />
                      Value
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedOpportunities.map((opp) => {
                  const styles = getRecommendationStyles(opp.recommendation)
                  const Icon = styles.icon

                  return (
                    <tr key={opp.type_id} className={`border-b/60 hover:bg-muted/30 transition-colors ${styles.row}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{opp.type_name}</div>
                        <div className="text-xs text-muted-foreground">ID: {opp.type_id}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatNumber(opp.quantity)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatISK(opp.current_sell_price)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {opp.mean_price > 0 ? formatISK(opp.mean_price) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {opp.all_time_high > 0 ? formatISK(opp.all_time_high) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`inline-flex items-center gap-1 font-bold ${styles.iconColor}`}>
                          <Icon className="size-4" />
                          {opp.percent_of_ath}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium">{formatISK(opp.total_value)} ISK</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={styles.badge}>
                          {opp.recommendation.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {opportunities.length === 0 && !loadingAssets && !loadingOpportunities && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Click the refresh button to load your character&apos;s assets in Jita 4-4.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


