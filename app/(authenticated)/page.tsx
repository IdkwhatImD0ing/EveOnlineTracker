"use client"

import { useEffect, useState, useMemo } from "react"
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
  Building2,
  Shield,
} from "lucide-react"
import { useSession } from "@/components/auth-gate"
import type { UserRole } from "@/types/auth"
import { canAccessNav, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"

interface CharacterInfo {
  character_id: number
  character_name: string
}

interface AffiliationData {
  corporation_id: number
  corporation_name: string
  corporation_ticker: string
  alliance_id: number | null
  alliance_name: string | null
  alliance_ticker: string | null
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

// All features with their nav paths for permission checking
const allFeatures = [
  {
    title: "Market Seeder",
    description: "Find the most profitable items to import from Jita to your alliance hub",
    href: "/market-seeder",
    navPath: "/market-seeder",
    icon: ShoppingCart,
    color: "from-emerald-500 to-teal-600",
  },
  {
    title: "Market Opportunities",
    description: "Find undervalued items in Jita based on historical data",
    href: "/jita-opportunities",
    navPath: "/jita-opportunities",
    icon: BarChart3,
    color: "from-cyan-500 to-blue-600",
  },
  {
    title: "Projects",
    description: "Track your manufacturing projects, materials, and costs",
    href: "/projects",
    navPath: "/projects",
    icon: Package,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Industry Calculator",
    description: "Calculate blueprint materials with ME/TE bonuses",
    href: "/industry",
    navPath: "/industry",
    icon: Calculator,
    color: "from-purple-500 to-violet-600",
  },
  {
    title: "Sell Opportunities",
    description: "Analyze your assets for optimal selling times",
    href: "/jita-opportunities",
    navPath: "/jita-opportunities",
    icon: TrendingUp,
    color: "from-amber-500 to-orange-600",
  },
]

// Get features filtered by role
function getAccessibleFeatures(role: UserRole) {
  return allFeatures.filter(feature => canAccessNav(role, feature.navPath))
}

export default function Dashboard() {
  const { session } = useSession()
  const [projectStats, setProjectStats] = useState<ProjectStats | null>(null)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null)
  const [affiliationData, setAffiliationData] = useState<AffiliationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingEsi, setIsLoadingEsi] = useState(false)

  // Get character info from session (memoized to prevent infinite re-renders)
  const mainCharacter = session?.characters?.find(c => c.is_main) || session?.characters?.[0]
  const characterInfo = useMemo<CharacterInfo | null>(() => {
    if (!mainCharacter) return null
    return { 
      character_id: mainCharacter.character_id, 
      character_name: mainCharacter.character_name 
    }
  }, [mainCharacter?.character_id, mainCharacter?.character_name])
  
  const role = session?.user?.role || 'public'

  // Get features accessible to this role
  const features = getAccessibleFeatures(role)

  // Check if role can see wallet/orders (admin only)
  const canSeeWallet = role === 'admin'
  const canSeeProjects = canAccessNav(role, '/projects')

  useEffect(() => {
    // Fetch project stats (only if role can access projects)
    async function fetchStats() {
      if (!canSeeProjects) {
        setIsLoading(false)
        return
      }
      
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
  }, [canSeeProjects])

  // Fetch ESI data when we have a session with characters
  useEffect(() => {
    if (!session?.authenticated || !characterInfo) return

    async function fetchEsiData() {
      setIsLoadingEsi(true)
      
      try {
        // Always fetch affiliation (all roles need this)
        const affiliationRes = await fetch(`/api/esi/character-affiliation?character_id=${characterInfo!.character_id}`)
        if (affiliationRes.ok) {
          const affiliation = await affiliationRes.json()
          setAffiliationData(affiliation)
        }

        // Only fetch wallet and orders for admin
        if (canSeeWallet) {
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
        }
      } catch (err) {
        console.error("Failed to fetch ESI data:", err)
      } finally {
        setIsLoadingEsi(false)
      }
    }

    fetchEsiData()
  }, [session, characterInfo, canSeeWallet])

  const refreshEsiData = async () => {
    if (!session?.authenticated || !characterInfo) return
    
    setIsLoadingEsi(true)
    
    try {
      // Always fetch affiliation
      const affiliation = await fetch(`/api/esi/character-affiliation?character_id=${characterInfo.character_id}`)
        .then(r => r.ok ? r.json() : null)
      if (affiliation) setAffiliationData(affiliation)

      // Only fetch wallet/orders for admin
      if (canSeeWallet) {
        const [wallet, orders] = await Promise.all([
          fetch(`/api/esi/wallet?character_id=${characterInfo.character_id}`)
            .then(r => r.ok ? r.json() : null),
          fetch(`/api/esi/character-orders?character_id=${characterInfo.character_id}`)
            .then(r => r.ok ? r.json() : null)
        ])
        
        if (wallet) setWalletData(wallet)
        if (orders) setOrdersData(orders)
      }
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {characterInfo
                ? `Welcome back, ${characterInfo.character_name}`
                : "EVE Online Tracker"}
            </h1>
            <Badge variant="outline" className={ROLE_COLORS[role]}>
              {ROLE_LABELS[role]}
            </Badge>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            {role === 'slyce' 
              ? "Welcome to the EVE Online Tracker. Features are currently limited."
              : "Your command center for industry, trading, and market analysis"
            }
          </p>
        </header>

        {/* Character Card or Login Prompt */}
        {characterInfo ? (
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="flex items-center gap-4">
                <img
                  src={`https://images.evetech.net/characters/${characterInfo.character_id}/portrait?size=128`}
                  alt={characterInfo.character_name}
                  className="size-16 sm:size-20 rounded-xl ring-2 ring-primary/30 shadow-lg"
                />
                {affiliationData?.alliance_id && (
                  <img
                    src={`https://images.evetech.net/alliances/${affiliationData.alliance_id}/logo?size=64`}
                    alt={affiliationData.alliance_name || "Alliance"}
                    className="size-12 sm:size-14 rounded-lg ring-2 ring-amber-500/30 shadow-lg hidden sm:block"
                    title={affiliationData.alliance_name || undefined}
                  />
                )}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold truncate">{characterInfo.character_name}</h2>
                {/* Corporation & Alliance Info */}
                {affiliationData && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <span className="flex items-center gap-1.5 text-cyan-500">
                      <Building2 className="size-3 sm:size-4" />
                      <span className="font-medium">[{affiliationData.corporation_ticker}]</span>
                      <span className="text-muted-foreground hidden md:inline">{affiliationData.corporation_name}</span>
                    </span>
                    {affiliationData.alliance_id && (
                      <span className="flex items-center gap-1.5 text-amber-500">
                        <Shield className="size-3 sm:size-4" />
                        <span className="font-medium">&lt;{affiliationData.alliance_ticker}&gt;</span>
                        <span className="text-muted-foreground hidden md:inline">{affiliationData.alliance_name}</span>
                        <span className="text-muted-foreground text-xs hidden lg:inline">(ID: {affiliationData.alliance_id})</span>
                      </span>
                    )}
                  </div>
                )}
                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="size-3 sm:size-4" />
                    ID: {characterInfo.character_id}
                  </span>
                  {canSeeWallet && walletData && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <Wallet className="size-3 sm:size-4" />
                      {walletData.total_balance_formatted}
                    </span>
                  )}
                  {canSeeWallet && ordersData && (
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
                {canAccessNav(role, '/callback') && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/callback">
                      <KeyRound className="size-4" />
                    </Link>
                  </Button>
                )}
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

        {/* Quick Stats - only show if there's something to display */}
        {(canSeeWallet || canSeeProjects) && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className={`grid gap-3 md:gap-4 ${canSeeWallet ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 max-w-xs'}`}>
                {/* Wallet Balance - admin only */}
                {canSeeWallet && (
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
                )}

                {/* Sell Orders - admin only */}
                {canSeeWallet && (
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
                )}

                {/* Buy Orders - admin only */}
                {canSeeWallet && (
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
                )}

                {/* Projects - user, pro, admin */}
                {canSeeProjects && (
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
                )}
              </div>
            )}
          </>
        )}

        {/* Features Grid - only show if there are features available */}
        {features.length > 0 ? (
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-lg md:text-xl font-semibold">Features</h2>
            <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Link key={feature.title} href={feature.href}>
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
        ) : (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Limited Access</h3>
              <p className="text-muted-foreground max-w-md">
                {role === 'slyce' 
                  ? "As a Slyce alliance member, your account is verified. Additional features are being developed."
                  : "Your account has limited access. Contact an administrator for more information."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
