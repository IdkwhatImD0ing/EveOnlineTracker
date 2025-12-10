"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Package,
  Calculator,
  TrendingUp,
  ShoppingCart,
  KeyRound,
  ArrowRight,
  User,
  Wallet,
  BarChart3,
  Tag,
  RefreshCw,
} from "lucide-react"

interface CharacterInfo {
  character_id: number
  character_name: string
}

interface ProjectStats {
  total: number
  recentCount: number
}

interface WalletData {
  balance: number
  balance_formatted: string
}

interface OrdersData {
  total_orders: number
  sell_orders: {
    count: number
    total_value: number
    total_value_formatted: string
  }
  buy_orders: {
    count: number
    total_escrow: number
    total_escrow_formatted: string
  }
}

// Parse JWT to get character info
function parseJWT(token: string): CharacterInfo | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    const characterId = parseInt(payload.sub.split(':')[2])
    return {
      character_id: characterId,
      character_name: payload.name,
    }
  } catch {
    return null
  }
}

const features = [
  {
    title: "Market Seeder",
    description: "Find the most profitable items to import from Jita to your alliance hub",
    href: "/market-seeder",
    icon: ShoppingCart,
    color: "from-emerald-500 to-teal-600",
  },
  {
    title: "Market Opportunities",
    description: "Find undervalued items in Jita based on historical data",
    href: "/market/opportunities",
    icon: BarChart3,
    color: "from-cyan-500 to-blue-600",
  },
  {
    title: "Projects",
    description: "Track your manufacturing projects, materials, and costs",
    href: "/projects",
    icon: Package,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Industry Calculator",
    description: "Calculate blueprint materials with ME/TE bonuses",
    href: "/industry",
    icon: Calculator,
    color: "from-purple-500 to-violet-600",
  },
  {
    title: "Sell Opportunities",
    description: "Analyze your assets for optimal selling times",
    href: "/sell-opportunities",
    icon: TrendingUp,
    color: "from-amber-500 to-orange-600",
  },
]

export default function Dashboard() {
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingEsi, setIsLoadingEsi] = useState(false)

  useEffect(() => {
    // Load character info from stored tokens
    const storedTokens = localStorage.getItem("eve_sso_tokens")
    if (storedTokens) {
      try {
        const tokens = JSON.parse(storedTokens)
        if (tokens.access_token) {
          const info = parseJWT(tokens.access_token)
          if (info) {
            setCharacterInfo(info)
            setAccessToken(tokens.access_token)
          }
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Fetch project stats
    async function fetchStats() {
      try {
        const response = await fetch("/api/projects")
        if (response.ok) {
          const projects = await response.json()
          const now = new Date()
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const recentCount = projects.filter(
            (p: { created_at: string }) => new Date(p.created_at) > weekAgo
          ).length
          setProjectStats({ total: projects.length, recentCount })
        }
      } catch (err) {
        console.error("Failed to fetch project stats:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Fetch ESI data when we have character info
  useEffect(() => {
    if (!characterInfo || !accessToken) return

    async function fetchEsiData() {
      setIsLoadingEsi(true)
      
      try {
        // Fetch wallet and orders in parallel
        const [walletRes, ordersRes] = await Promise.all([
          fetch(`/api/esi/wallet?character_id=${characterInfo.character_id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          }),
          fetch(`/api/esi/character-orders?character_id=${characterInfo.character_id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        ])

        if (walletRes.ok) {
          const wallet = await walletRes.json()
          setWalletData(wallet)
        }

        if (ordersRes.ok) {
          const orders = await ordersRes.json()
          setOrdersData(orders)
        }
      } catch (err) {
        console.error("Failed to fetch ESI data:", err)
      } finally {
        setIsLoadingEsi(false)
      }
    }

    fetchEsiData()
  }, [characterInfo, accessToken])

  const refreshEsiData = () => {
    if (!characterInfo || !accessToken) return
    
    setIsLoadingEsi(true)
    
    Promise.all([
      fetch(`/api/esi/wallet?character_id=${characterInfo.character_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(r => r.ok ? r.json() : null),
      fetch(`/api/esi/character-orders?character_id=${characterInfo.character_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(r => r.ok ? r.json() : null)
    ]).then(([wallet, orders]) => {
      if (wallet) setWalletData(wallet)
      if (orders) setOrdersData(orders)
    }).finally(() => setIsLoadingEsi(false))
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Welcome Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {characterInfo
              ? `Welcome back, ${characterInfo.character_name}`
              : "EVE Online Tracker"}
          </h1>
          <p className="text-muted-foreground">
            Your command center for industry, trading, and market analysis
          </p>
        </header>

        {/* Character Card or Login Prompt */}
        {characterInfo ? (
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20">
            <CardContent className="flex items-center gap-6 p-6">
              <img
                src={`https://images.evetech.net/characters/${characterInfo.character_id}/portrait?size=128`}
                alt={characterInfo.character_name}
                className="size-20 rounded-xl ring-2 ring-primary/30 shadow-lg"
              />
              <div className="flex-1 space-y-1">
                <h2 className="text-xl font-semibold">{characterInfo.character_name}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="size-4" />
                    ID: {characterInfo.character_id}
                  </span>
                  {walletData && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Wallet className="size-4" />
                      {walletData.balance_formatted}
                    </span>
                  )}
                  {ordersData && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <Tag className="size-4" />
                      {ordersData.sell_orders.count} sell orders
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={refreshEsiData} disabled={isLoadingEsi}>
                  {isLoadingEsi ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/callback">
                    <KeyRound className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <KeyRound className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Connect Your EVE Account</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Log in with EVE SSO to access character-specific features like wallet, orders, and market analysis.
              </p>
              <Button asChild>
                <Link href="/api/auth/eve/login">
                  <KeyRound className="size-4 mr-2" />
                  Login with EVE SSO
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Wallet Balance */}
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="size-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Wallet className="size-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoadingEsi ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : walletData ? (
                      walletData.balance_formatted.replace(' ISK', '')
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                </div>
              </CardContent>
            </Card>

            {/* Sell Orders */}
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="size-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Tag className="size-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoadingEsi ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : ordersData ? (
                      ordersData.sell_orders.count
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sell Orders
                    {ordersData && (
                      <span className="ml-1 text-xs text-emerald-500">
                        ({ordersData.sell_orders.total_value_formatted})
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Buy Orders */}
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="size-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <ShoppingCart className="size-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoadingEsi ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : ordersData ? (
                      ordersData.buy_orders.count
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Buy Orders
                    {ordersData && (
                      <span className="ml-1 text-xs text-amber-500">
                        ({ordersData.buy_orders.total_escrow_formatted})
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Projects */}
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="size-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Package className="size-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectStats?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    Projects
                    {projectStats && projectStats.recentCount > 0 && (
                      <span className="ml-1 text-xs text-purple-500">
                        (+{projectStats.recentCount} this week)
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 cursor-pointer group">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div
                      className={`size-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg shrink-0`}
                    >
                      <feature.icon className="size-6 text-white" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <h3 className="font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
                        {feature.title}
                        <ArrowRight className="size-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
