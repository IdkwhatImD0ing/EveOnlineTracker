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

// Session response from /api/auth/session
interface SessionResponse {
  authenticated: boolean
  user?: {
    id: string
    main_character_id: number
    main_character_name: string
    allowed: boolean
  }
  characters?: Array<{
    id: string
    character_id: number
    character_name: string
    is_main: boolean
  }>
}

interface CharacterInfo {
  character_id: number
  character_name: string
}

interface ProjectStats {
  total: number
  recentCount: number
}

interface WalletData {
  total_balance: number
  total_balance_formatted: string
  wallets: Array<{
    character_id: number
    character_name: string
    balance: number
    balance_formatted: string
  }>
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
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingEsi, setIsLoadingEsi] = useState(false)

  useEffect(() => {
    // Load session from API
    async function fetchSession() {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const sessionData: SessionResponse = await response.json()
          setSession(sessionData)
          // Find main character or use first character
          const mainChar = sessionData.characters?.find(c => c.is_main) || sessionData.characters?.[0]
          if (mainChar) {
            setCharacterInfo({
              character_id: mainChar.character_id,
              character_name: mainChar.character_name,
            })
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err)
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

    fetchSession()
    fetchStats()
  }, [])

  // Fetch ESI data when we have a session with characters
  useEffect(() => {
    if (!session?.authenticated || !characterInfo) return

    async function fetchEsiData() {
      setIsLoadingEsi(true)
      
      try {
        // Fetch wallet and orders in parallel (server handles auth via session cookie)
        const [walletRes, ordersRes] = await Promise.all([
          fetch(`/api/esi/wallet?character_id=${characterInfo!.character_id}`),
          fetch(`/api/esi/character-orders?character_id=${characterInfo!.character_id}`)
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
  }, [session, characterInfo])

  const refreshEsiData = async () => {
    if (!session?.authenticated || !characterInfo) return
    
    setIsLoadingEsi(true)
    
    try {
      const [wallet, orders] = await Promise.all([
        fetch(`/api/esi/wallet?character_id=${characterInfo.character_id}`)
          .then(r => r.ok ? r.json() : null),
        fetch(`/api/esi/character-orders?character_id=${characterInfo.character_id}`)
          .then(r => r.ok ? r.json() : null)
      ])
      
      if (wallet) setWalletData(wallet)
      if (orders) setOrdersData(orders)
    } catch (err) {
      console.error("Failed to refresh ESI data:", err)
    } finally {
      setIsLoadingEsi(false)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
        {/* Welcome Header */}
        <header className="space-y-1 md:space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {characterInfo
              ? `Welcome back, ${characterInfo.character_name}`
              : "EVE Online Tracker"}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Your command center for industry, trading, and market analysis
          </p>
        </header>

        {/* Character Card or Login Prompt */}
        {characterInfo ? (
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
              <img
                src={`https://images.evetech.net/characters/${characterInfo.character_id}/portrait?size=128`}
                alt={characterInfo.character_name}
                className="size-16 sm:size-20 rounded-xl ring-2 ring-primary/30 shadow-lg"
              />
              <div className="flex-1 space-y-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold truncate">{characterInfo.character_name}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="size-3 sm:size-4" />
                    ID: {characterInfo.character_id}
                  </span>
                  {walletData && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Wallet className="size-3 sm:size-4" />
                      {walletData.total_balance_formatted}
                    </span>
                  )}
                  {ordersData && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <Tag className="size-3 sm:size-4" />
                      {ordersData.sell_orders.count} sell orders
                    </span>
                  )}
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 self-end sm:self-auto">
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
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Wallet Balance */}
            <Card>
              <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-6">
                <div className="size-9 md:size-12 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Wallet className="size-4 md:size-6 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold truncate">
                    {isLoadingEsi ? (
                      <Loader2 className="size-4 md:size-5 animate-spin" />
                    ) : walletData ? (
                      walletData.total_balance_formatted.replace(' ISK', '')
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">Wallet</p>
                </div>
              </CardContent>
            </Card>

            {/* Sell Orders */}
            <Card>
              <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-6">
                <div className="size-9 md:size-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Tag className="size-4 md:size-6 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold">
                    {isLoadingEsi ? (
                      <Loader2 className="size-4 md:size-5 animate-spin" />
                    ) : ordersData ? (
                      ordersData.sell_orders.count
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    <span className="hidden md:inline">Sell Orders</span>
                    <span className="md:hidden">Sell</span>
                    {ordersData && (
                      <span className="ml-1 text-xs text-emerald-500 hidden lg:inline">
                        ({ordersData.sell_orders.total_value_formatted})
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Buy Orders */}
            <Card>
              <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-6">
                <div className="size-9 md:size-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="size-4 md:size-6 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold">
                    {isLoadingEsi ? (
                      <Loader2 className="size-4 md:size-5 animate-spin" />
                    ) : ordersData ? (
                      ordersData.buy_orders.count
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    <span className="hidden md:inline">Buy Orders</span>
                    <span className="md:hidden">Buy</span>
                    {ordersData && (
                      <span className="ml-1 text-xs text-amber-500 hidden lg:inline">
                        ({ordersData.buy_orders.total_escrow_formatted})
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Projects */}
            <Card>
              <CardContent className="flex items-center gap-2.5 md:gap-4 p-3 md:p-6">
                <div className="size-9 md:size-12 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Package className="size-4 md:size-6 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold">{projectStats?.total || 0}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Projects
                    {projectStats && projectStats.recentCount > 0 && (
                      <span className="ml-1 text-xs text-purple-500 hidden md:inline">
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
        <div className="space-y-3 md:space-y-4">
          <h2 className="text-lg md:text-xl font-semibold">Features</h2>
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 cursor-pointer group active:scale-[0.98]">
                  <CardContent className="flex items-start gap-3 md:gap-4 p-4 md:p-6">
                    <div
                      className={`size-10 md:size-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg shrink-0`}
                    >
                      <feature.icon className="size-5 md:size-6 text-white" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <h3 className="text-sm md:text-base font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
                        {feature.title}
                        <ArrowRight className="size-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all hidden sm:block" />
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
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
